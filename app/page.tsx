'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, AudioLines, CalendarClock, CircleCheckBig, ClipboardPaste, Clock3, FileUp, Gavel, ListTodo, Mic, Search, Trash2 } from 'lucide-react';
import { deleteMeeting, getMeetings, saveMeetings, useMeetings } from '@/lib/store';
import { sampleMeetings } from '@/lib/seed';
import { searchMeetings } from '@/lib/search';
import { bucketOf, formatDueDate, resolveDue } from '@/lib/dates';
import { meetingHealth } from '@/lib/health';
import { cn, formatDuration } from '@/lib/utils';
import type { Meeting } from '@/lib/types';

const SOURCE: Record<Meeting['source'], string> = { live: 'Recorded', audio: 'Audio', upload: 'File', paste: 'Pasted', sample: 'Sample' };

function Progress({ done, total }: { done: number; total: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const p = total ? done / total : 0;
  return (
    <span className="flex items-center gap-2 text-[12px] font-semibold tabular-nums text-ink-600" title={`${done} of ${total} tasks done`}>
      <svg width="22" height="22" viewBox="0 0 22 22" className="-rotate-90">
        <circle cx="11" cy="11" r={r} fill="none" stroke="#e7e5e4" strokeWidth="3" />
        <circle cx="11" cy="11" r={r} fill="none" stroke={p === 1 ? '#10b981' : '#f43f32'} strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      </svg>
      {done}/{total}
    </span>
  );
}

export default function Dashboard() {
  const meetings = useMeetings();
  const [query, setQuery] = useState('');

  // First visit: load the sample meetings so the app isn't empty
  useEffect(() => {
    if (!localStorage.getItem('mm-seeded') && getMeetings().length === 0) {
      saveMeetings(sampleMeetings());
      localStorage.setItem('mm-seeded', '1');
    }
  }, []);

  const results = useMemo(() => searchMeetings(meetings, query), [meetings, query]);
  const now = new Date();
  const openTasks = meetings.flatMap((m) => (m.analysis?.actionItems || []).filter((a) => !a.done).map((item) => ({ item, meeting: m, date: resolveDue(item.due, new Date(m.createdAt)) })));
  const upcoming = openTasks.filter((t) => t.date).sort((a, b) => a.date!.getTime() - b.date!.getTime()).slice(0, 4);
  const minutes = Math.round(meetings.reduce((n, m) => n + (m.durationSec || 0), 0) / 60);
  const decisions = meetings.reduce((n, m) => n + (m.analysis?.decisions.length || 0), 0);

  const CAPTURE = [
    { href: '/new/?mode=record', icon: Mic, title: 'Record', text: 'Live captions with speaker tags' },
    { href: '/new/?mode=upload', icon: FileUp, title: 'Upload', text: 'Zoom, Meet, Teams or audio files' },
    { href: '/new/?mode=paste', icon: ClipboardPaste, title: 'Paste', text: 'Any transcript or rough notes' },
  ];

  return (
    <div className="shell py-10">
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-ink-950 p-7 text-white md:p-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-brand-gradient opacity-60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-brand-600 opacity-20 blur-3xl" />
        <div className="relative grid items-end gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/80">
              <AudioLines className="h-3.5 w-3.5 text-brand-400" /> Meeting notes that turn into next steps
            </span>
            <h1 className="mt-5 text-[34px] font-extrabold leading-[1.08] tracking-tight md:text-[44px]">
              Leave every meeting with <span className="text-gradient">owners, dates and a recap</span> already written.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/60">
              MeetingMind turns a conversation into a summary, decisions, action items with real due dates, a follow-up email and a calendar file you can import.
            </p>
          </div>
          <div className="grid gap-2.5">
            {CAPTURE.map(({ href, icon: Icon, title, text }) => (
              <Link key={href} href={href} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/25 hover:bg-white/[0.08]">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-gradient shadow-glow"><Icon className="h-5 w-5" /></span>
                <span className="flex-1">
                  <span className="block text-[15px] font-bold">{title}</span>
                  <span className="block text-[13px] text-white/55">{text}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-10 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="panel grid grid-cols-2 divide-ink-200 sm:grid-cols-4 sm:divide-x">
          {[
            { label: 'Meetings', value: meetings.length, hint: 'stored in this browser', icon: AudioLines },
            { label: 'Open tasks', value: openTasks.length, hint: `${openTasks.filter((t) => t.item.owner).length} with an owner`, icon: ListTodo },
            { label: 'Decisions', value: decisions, hint: 'recorded in recaps', icon: Gavel },
            { label: 'Minutes captured', value: minutes, hint: 'of conversation', icon: Clock3 },
          ].map(({ label, value, hint, icon: Icon }) => (
            <div key={label} className="flex flex-col justify-between gap-6 p-5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-700"><Icon className="h-[18px] w-[18px]" /></span>
              <div>
                <div className="text-[34px] font-extrabold leading-none tracking-tight tabular-nums">{value}</div>
                <div className="mt-2 text-[13px] font-bold">{label}</div>
                <div className="text-[12px] text-ink-500">{hint}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="eyebrow">Coming up</span>
            <Link href="/actions/" className="text-[12px] font-bold text-brand-700 hover:underline">All tasks</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-[13px] text-ink-500">No dated tasks yet. Due dates mentioned in meetings appear here.</p>
          ) : (
            <ul className="space-y-2.5">
              {upcoming.map(({ item, meeting, date }) => {
                const b = bucketOf(date, now);
                return (
                  <li key={meeting.id + item.id} className="flex items-center gap-3">
                    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg text-center leading-none', b === 'overdue' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-800')}>
                      <span>
                        <span className="block text-[9px] font-bold uppercase">{date!.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="block text-[14px] font-extrabold">{date!.getDate()}</span>
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{item.task}</span>
                      <span className="block truncate text-[11.5px] text-ink-500">{item.owner || 'Unassigned'} · {b === 'overdue' ? 'overdue' : formatDueDate(date!, now)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-extrabold tracking-tight">Meetings</h2>
            <p className="text-[13px] text-ink-500">Search covers titles, summaries, tasks and every line of every transcript.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input className="field h-10 pl-9" placeholder="Search meetings" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search meetings" />
          </div>
        </div>
        <div className="panel overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1fr)_110px_90px_90px_120px_40px] gap-4 border-b border-ink-200 bg-ink-50 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 md:grid">
            <span>Meeting</span><span>Health</span><span>Length</span><span>Tasks</span><span>Date</span><span />
          </div>
          {results.length === 0 ? (
            <div className="dot-grid p-14 text-center text-[14px] text-ink-500">{meetings.length ? 'No meeting matches your search.' : 'No meetings yet. Record, upload or paste your first one.'}</div>
          ) : (
            results.map(({ meeting: m, snippet }) => {
              const items = m.analysis?.actionItems || [];
              const health = meetingHealth(m);
              return (
                <article key={m.id} className="group relative grid items-center gap-x-4 gap-y-2 border-b border-ink-100 px-5 py-4 transition last:border-0 hover:bg-ink-50/70 md:grid-cols-[minmax(0,1fr)_110px_90px_90px_120px_40px]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/meeting/?id=${encodeURIComponent(m.id)}`} className="truncate text-[15px] font-bold after:absolute after:inset-0">{m.title}</Link>
                      <span className="chip shrink-0 bg-ink-100 text-ink-600">{SOURCE[m.source]}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-500">{snippet || m.analysis?.summary || 'Not analysed yet.'}</p>
                  </div>
                  <span>{health && <span className={cn('chip', health.grade === 'Great' ? 'bg-emerald-50 text-emerald-700' : health.grade === 'Good' ? 'bg-amber-50 text-amber-800' : 'bg-brand-50 text-brand-700')}>{health.score} · {health.grade}</span>}</span>
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-600">{m.durationSec ? <><Clock3 className="h-3.5 w-3.5 text-ink-400" />{formatDuration(m.durationSec)}</> : '—'}</span>
                  <Progress done={items.filter((i) => i.done).length} total={items.length} />
                  <span className="flex items-center gap-1.5 text-[12.5px] text-ink-500"><CalendarClock className="h-3.5 w-3.5 text-ink-400" />{new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <button
                    className="relative z-10 grid h-8 w-8 place-items-center rounded-lg text-ink-400 opacity-0 transition hover:bg-brand-50 hover:text-brand-700 focus:opacity-100 group-hover:opacity-100"
                    onClick={() => confirm(`Delete "${m.title}"?`) && deleteMeeting(m.id)}
                    aria-label={`Delete ${m.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
