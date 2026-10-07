import type { ActionItem } from './types';

// ---------------------------------------------------------------------------
// Turn the due phrases found in meetings ("Friday", "next week", "March 12",
// "end of month") into real dates, group tasks by urgency and export them as
// an .ics calendar file that Google Calendar, Outlook and Apple Calendar open.
// ---------------------------------------------------------------------------

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Friday of the week containing d (weeks start on Monday). */
const fridayOf = (d: Date) => addDays(d, 5 - (((d.getDay() + 6) % 7) + 1));

/** Resolve a due phrase relative to when the meeting happened. Returns null if it can't be pinned to a day. */
export function resolveDue(due: string | undefined, from: Date): Date | null {
  if (!due) return null;
  const s = due.toLowerCase().replace(/^(by|on|before|until)\s+/, '').trim();
  const base = startOfDay(from);

  if (/^(today|tonight|end of (the )?day|eod)$/.test(s)) return base;
  if (s === 'tomorrow') return addDays(base, 1);
  if (/^(end of (the )?week|eow|this week)$/.test(s)) return fridayOf(base) < base ? base : fridayOf(base);
  if (s === 'next week') return fridayOf(addDays(base, 7));
  if (/^end of (the )?month$/.test(s)) return new Date(base.getFullYear(), base.getMonth() + 1, 0);

  const day = s.match(/^(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (day) {
    const target = DAYS.indexOf(day[2]);
    let diff = (target - base.getDay() + 7) % 7 || 7; // the next occurrence, never today
    if (day[1]) {
      // "next Friday" means the Friday of next week
      const nextMonday = addDays(base, ((8 - base.getDay()) % 7) || 7);
      diff = Math.round((addDays(nextMonday, (target + 6) % 7).getTime() - base.getTime()) / 86400000);
    }
    return addDays(base, diff);
  }

  const dm = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)$/) || null;
  const md = s.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/) || null;
  const parts = dm ? { d: Number(dm[1]), m: dm[2] } : md ? { d: Number(md[2]), m: md[1] } : null;
  if (parts) {
    const month = MONTHS.indexOf(parts.m.slice(0, 3));
    if (month < 0 || parts.d < 1 || parts.d > 31) return null;
    let date = new Date(base.getFullYear(), month, parts.d);
    if (date.getMonth() !== month) return null; // e.g. 31 June
    // a date well before the meeting refers to next year ("Jan 10" said in December)
    if (date.getTime() < base.getTime() - 60 * 86400000) date = new Date(base.getFullYear() + 1, month, parts.d);
    return date;
  }
  return null;
}

export type DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none';

export const BUCKET_LABEL: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  week: 'Next 7 days',
  later: 'Later',
  none: 'No due date',
};

export function bucketOf(date: Date | null, now: Date): DueBucket {
  if (!date) return 'none';
  const today = startOfDay(now).getTime();
  const t = startOfDay(date).getTime();
  if (t < today) return 'overdue';
  if (t === today) return 'today';
  if (t <= today + 7 * 86400000) return 'week';
  return 'later';
}

export function formatDueDate(d: Date, now = new Date()): string {
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

// --- iCalendar ---------------------------------------------------------------

const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

/** Fold lines longer than 75 octets, as RFC 5545 requires. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export interface CalendarTask {
  item: ActionItem;
  meetingTitle: string;
  date: Date;
}

export function toICS(tasks: CalendarTask[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gabriel.ATH//MeetingMind//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const { item, meetingTitle, date } of tasks) {
    const title = item.owner ? `${item.task} (${item.owner})` : item.task;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscape(item.id)}-${ymd(date)}@meetingmind`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(date, 1))}`,
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape(`From the meeting "${meetingTitle}"${item.due ? `. Due: ${item.due}` : ''}`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
