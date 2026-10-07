'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarClock, Download, ListChecks, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { upsertMeeting, useMeetings } from '@/lib/store';
import { cn, downloadFile } from '@/lib/utils';

type Filter = 'open' | 'done' | 'all';

export default function ActionItemsPage() {
  const meetings = useMeetings();
  const [filter, setFilter] = useState<Filter>('open');
  const [owner, setOwner] = useState('');

  const all = useMemo(
    () => meetings.flatMap((m) => (m.analysis?.actionItems || []).map((item) => ({ item, meeting: m }))),
    [meetings],
  );
  const owners = [...new Set(all.map((x) => x.item.owner || 'Unassigned'))].sort();
  const rows = all.filter(({ item }) => (filter === 'all' || (filter === 'open' ? !item.done : item.done)) && (!owner || (item.owner || 'Unassigned') === owner));

  const toggle = (meetingId: string, itemId: string) => {
    const m = meetings.find((x) => x.id === meetingId);
    if (!m?.analysis) return;
    upsertMeeting({ ...m, analysis: { ...m.analysis, actionItems: m.analysis.actionItems.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) } });
  };

  const exportCsv = () => {
    const esc = (s = '') => `"${s.replace(/"/g, '""')}"`;
    const csv = ['Task,Owner,Due,Status,Meeting', ...all.map(({ item, meeting }) => [esc(item.task), esc(item.owner), esc(item.due), item.done ? 'Done' : 'Open', esc(meeting.title)].join(','))].join('\n');
    downloadFile('action-items.csv', csv, 'text/csv');
  };

  return (
    <div className="max-width py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight"><ListChecks className="h-7 w-7 text-brand-500" />Action items</h1>
          <p className="mt-1 text-ink-500">Every next step from every meeting, in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-xl bg-ink-300/15 p-1">
            {(['open', 'done', 'all'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium capitalize text-ink-500', filter === f && 'bg-white text-ink-900 shadow')}>{f}</button>
            ))}
          </div>
          <select className="field h-10 w-44 py-0" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by owner">
            <option value="">Everyone</option>
            {owners.map((o) => <option key={o}>{o}</option>)}
          </select>
          <Button variant="outline" onClick={exportCsv} disabled={!all.length}><Download className="h-4 w-4" />CSV</Button>
        </div>
      </div>
      <div className="card divide-y divide-ink-300/20">
        {rows.length === 0 && <p className="p-10 text-center text-ink-500">{all.length ? 'Nothing here. Nice work!' : 'Action items from your meetings will show up here.'}</p>}
        {rows.map(({ item, meeting }) => (
          <div key={`${meeting.id}-${item.id}`} className="flex items-start gap-3 p-4">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-500" checked={item.done} onChange={() => toggle(meeting.id, item.id)} aria-label={`Mark "${item.task}" as done`} />
            <div className="min-w-0 flex-1">
              <div className={cn('font-medium', item.done && 'text-ink-300 line-through')}>{item.task}</div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-ink-500">
                <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{item.owner || 'Unassigned'}</span>
                {item.due && <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{item.due}</span>}
                <Link className="text-brand-600 hover:underline" href={`/meeting/?id=${encodeURIComponent(meeting.id)}`}>{meeting.title}</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
