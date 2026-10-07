import { describe, expect, it } from 'vitest';
import { bucketOf, foldLine, resolveDue, toICS } from '@/lib/dates';
// Wednesday 7 October 2026
const WED = new Date(2026, 9, 7, 15, 30);
const iso = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);

describe('resolveDue', () => {
  it('handles relative days', () => {
    expect(iso(resolveDue('Today', WED))).toBe('2026-10-07');
    expect(iso(resolveDue('Tomorrow', WED))).toBe('2026-10-08');
    expect(iso(resolveDue('End of week', WED))).toBe('2026-10-09');
    expect(iso(resolveDue('Next week', WED))).toBe('2026-10-16');
    expect(iso(resolveDue('End of month', WED))).toBe('2026-10-31');
  });

  it('handles weekdays and "next" weekdays', () => {
    expect(iso(resolveDue('Friday', WED))).toBe('2026-10-09');
    expect(iso(resolveDue('Monday', WED))).toBe('2026-10-12');
    expect(iso(resolveDue('Wednesday', WED))).toBe('2026-10-14'); // never the same day
    expect(iso(resolveDue('Next Friday', WED))).toBe('2026-10-16');
    expect(iso(resolveDue('by Thursday', WED))).toBe('2026-10-08');
  });

  it('handles calendar dates and rolls into next year', () => {
    expect(iso(resolveDue('March 12', WED))).toBe('2027-03-12');
    expect(iso(resolveDue('12th of October', WED))).toBe('2026-10-12');
    expect(iso(resolveDue('Oct 2', WED))).toBe('2026-10-02');
    expect(resolveDue('31 June', WED)).toBeNull();
    expect(resolveDue('soon', WED)).toBeNull();
    expect(resolveDue(undefined, WED)).toBeNull();
  });

  it('buckets dates', () => {
    expect(bucketOf(new Date(2026, 9, 6), WED)).toBe('overdue');
    expect(bucketOf(new Date(2026, 9, 7, 9), WED)).toBe('today');
    expect(bucketOf(new Date(2026, 9, 12), WED)).toBe('week');
    expect(bucketOf(new Date(2026, 10, 1), WED)).toBe('later');
    expect(bucketOf(null, WED)).toBe('none');
  });
});

describe('ICS export', () => {
  it('writes valid all-day events with escaped text', () => {
    const ics = toICS([{ item: { id: 'a1', task: 'Send quote, v2; final', owner: 'Maya', due: 'Friday', done: false }, meetingTitle: 'Kickoff', date: new Date(2026, 9, 9) }], WED);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261009');
    expect(ics).toContain('DTEND;VALUE=DATE:20261010');
    expect(ics).toContain('SUMMARY:Send quote\\, v2\\; final (Maya)');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('folds long lines at 75 octets', () => {
    const folded = foldLine(`DESCRIPTION:${'x'.repeat(200)}`);
    for (const l of folded.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'x'.repeat(200)}`);
  });
});

