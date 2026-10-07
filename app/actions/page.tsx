'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarPlus, Check, Download, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { upsertMeeting, useMeetings } from '@/lib/store';
import { BUCKET_LABEL, bucketOf, formatDueDate, resolveDue, toICS } from '@/lib/dates';
import type { DueBucket } from '@/lib/dates';
import { cn, downloadFile } from '@/lib/utils';

type Filter = 'open' | 'done' | 'all';
const ORDER: DueBucket[] = ['overdue', 'today', 'week', 'later', 'none'];
const DOT: Record<DueBucket, string> = { overdue: 'bg-brand-500', today: 'bg-amber-500', week: 'bg-ink-950', later: 'bg-ink-400', none: 'bg-ink-200' };

export default function ActionItemsPage() {
  const meetings = useMeetings();
  const [filter, setFilter] = useState<Filter>('open');
  const [owner, setOwner] = useState('');
  const now = useMemo(() => new Date(), []);

  const all = useMemo(
    () => meetings.flatMap((m) => (m.analysis?.actionItems || []).map((item) => {
      const date = resolveDue(item.due, new Date(m.createdAt));
      return { item, meeting: m, date, bucket: bucketOf(date, now) };
    })),
    [meetings, now],
  );
  const owners = [...new Set(all.map((x) => x.item.owner || 'Unassigned'))].sort();
  const rows = all.filter(({ item }) => (filter === 'all' || (filter === 'open' ? !item.done : item.done)) && (!owner || (item.owner || 'Unassigned') === owner));
  const groups = ORDER.map((b) => ({ bucket: b, rows: rows.filter((r) => r.bucket === b).sort((x, y) => (x.date?.getTime() || 0) - (y.date?.getTime() || 0)) })).filter((g) => g.rows.length);
  const counts = { open: all.filter((x) => !x.item.done).length, overdue: all.filter((x) => !x.item.done && x.bucket === 'overdue').length, done: all.filter((x) => x.item.done).length };

  const toggle = (meetingId: string, itemId: string) => {
    const m = meetings.find((x) => x.id === meetingId);
    if (!m?.analysis) return;
    upsertMeeting({ ...m, analysis: { ...m.analysis, actionItems: m.analysis.actionItems.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) } });
  };

  const exportCsv = () => {
    const esc = (s = '') => `"${s.replace(/"/g, '""')}"`;
    const csv = ['Task,Owner,Due,Date,Status,Meeting', ...all.map(({ item, meeting, date }) => [esc(item.task), esc(item.owner), esc(item.due), date ? date.toISOString().slice(0, 10) : '', item.done ? 'Done' : 'Open', esc(meeting.title)].join(','))].join('\n');
    downloadFile('action-items.csv', csv, 'text/csv');
  };
  const exportIcs = () => {
    const tasks = rows.filter((r) => r.date && !r.item.done).map((r) => ({ item: r.item, meetingTitle: r.meeting.title, date: r.date! }));
    if (!tasks.length) return toast.error('None of these tasks has a due date yet.');
    downloadFile('meetingmind-tasks.ics', toICS(tasks), 'text/calendar');
    toast.success(`${tasks.length} task${tasks.length === 1 ? '' : 's'} exported`);
  };

  return (
    <div className="shell py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">Across all meetings</div>
          <h1 className="text-[32px] font-extrabold tracking-tight">Action items</h1>
          <p className="mt-1 text-[15px] text-ink-500">
            <b className="text-ink-950">{counts.open}</b> open{counts.overdue ? <>, <b className="text-brand-700">{counts.overdue} overdue</b></> : null} · {counts.done} done. Spoken dates like “Friday” are turned into real days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-ink-100 p-1">
            {(['open', 'done', 'all'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn('h-8 rounded-lg px-3 text-[13px] font-bold capitalize text-ink-500 transition', filter === f && 'bg-white text-ink-950 shadow-card')}>{f}</button>
            ))}
          </div>
          <select className="field h-10 w-40 py-0" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by owner">
            <option value="">Everyone</option>
            {owners.map((o) => <option key={o}>{o}</option>)}
          </select>
          <Button variant="outline" onClick={exportCsv} disabled={!all.length}><Download />CSV</Button>
          <Button variant="dark" onClick={exportIcs} disabled={!all.length}><CalendarPlus />Calendar</Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="panel dot-grid p-16 text-center text-[14px] text-ink-500">{all.length ? 'Nothing here. Nice work.' : 'Action items from your meetings will show up here.'}</div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ bucket, rows: list }) => (
            <section key={bucket}>
              <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-extrabold">
                <span className={cn('h-2 w-2 rounded-full', DOT[bucket])} />{BUCKET_LABEL[bucket]}<span className="font-semibold text-ink-400">{list.length}</span>
              </h2>
              <div className="panel divide-y divide-ink-100">
                {list.map(({ item, meeting, date }) => (
                  <div key={`${meeting.id}-${item.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-ink-50/70">
                    <button
                      className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition', item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-300 hover:border-brand-500')}
                      onClick={() => toggle(meeting.id, item.id)}
                      aria-label={`Mark "${item.task}" as ${item.done ? 'open' : 'done'}`}
                      aria-pressed={item.done}
                    >
                      {item.done && <Check className="h-3 w-3" strokeWidth={3.5} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-[14px] font-semibold', item.done && 'text-ink-400 line-through')}>{item.task}</div>
                      <Link className="text-[12px] text-ink-500 hover:text-brand-700" href={`/meeting/?id=${encodeURIComponent(meeting.id)}`}>{meeting.title}</Link>
                    </div>
                    <span className="hidden items-center gap-1.5 text-[12.5px] font-semibold text-ink-600 sm:flex"><UserRound className="h-3.5 w-3.5 text-ink-400" />{item.owner || 'Unassigned'}</span>
                    <span className={cn('w-28 text-right text-[12.5px] font-semibold tabular-nums', bucket === 'overdue' && !item.done ? 'text-brand-700' : 'text-ink-500')}>
                      {date ? formatDueDate(date, now) : item.due || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
