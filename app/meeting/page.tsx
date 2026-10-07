'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, CalendarPlus, Check, CircleHelp, Copy, Download, Gavel, HeartPulse, Loader2, Mail, MessageSquareText, Plus, RefreshCw, Search, Sparkles, Trash2, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { deleteMeeting, upsertMeeting, useMeetings } from '@/lib/store';
import { runAnalysis } from '@/lib/process';
import { meetingToMarkdown } from '@/lib/markdown';
import { formatTime, speakerStats } from '@/lib/transcript';
import { formatDueDate, resolveDue, toICS } from '@/lib/dates';
import { meetingHealth } from '@/lib/health';
import { copyText, cn, downloadFile, formatDuration, formatTimestamp } from '@/lib/utils';
import type { ActionItem, Meeting } from '@/lib/types';

const TONE = {
  positive: { cls: 'bg-emerald-50 text-emerald-700', label: 'Positive tone' },
  neutral: { cls: 'bg-ink-100 text-ink-600', label: 'Neutral tone' },
  tense: { cls: 'bg-amber-50 text-amber-800', label: 'Tense moments' },
};
const SPEAKER_COLORS = ['#f43f32', '#0a0a0a', '#f59e0b', '#10b981', '#3b82f6', '#78716c'];
const slug = (s: string) => s.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').toLowerCase();

function Block({ title, icon: Icon, action, children, className }: { title: string; icon: typeof Gavel; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('panel p-6', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight"><Icon className="h-[18px] w-[18px] text-brand-600" />{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MeetingView({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [newTask, setNewTask] = useState('');
  const [tab, setTab] = useState<'email' | 'transcript' | 'health'>('email');
  const a = meeting.analysis;
  const stats = useMemo(() => speakerStats(meeting.segments), [meeting.segments]);
  const health = useMemo(() => meetingHealth(meeting), [meeting]);
  const colorOf = (name?: string) => SPEAKER_COLORS[Math.max(0, stats.findIndex((s) => s.speaker === name)) % SPEAKER_COLORS.length];
  const created = new Date(meeting.createdAt);

  const update = (patch: Partial<Meeting>) => upsertMeeting({ ...meeting, ...patch });
  const updateItems = (items: ActionItem[]) => a && update({ analysis: { ...a, actionItems: items } });
  const patchItem = (id: string, patch: Partial<ActionItem>) => a && updateItems(a.actionItems.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const reanalyse = async () => {
    setBusy(true);
    const analysis = await runAnalysis(meeting.segments);
    const done = new Set(a?.actionItems.filter((i) => i.done).map((i) => i.task.toLowerCase()));
    analysis.actionItems = analysis.actionItems.map((i) => ({ ...i, done: done.has(i.task.toLowerCase()) }));
    update({ analysis });
    setBusy(false);
    toast.success(`Notes regenerated with the ${analysis.engine === 'ai' ? 'AI model' : 'demo engine'}`);
  };

  const addTask = () => {
    const t = newTask.trim().slice(0, 200);
    if (!t || !a) return;
    updateItems([...a.actionItems, { id: `manual-${Date.now()}`, task: t, done: false }]);
    setNewTask('');
  };

  const exportCalendar = () => {
    if (!a) return;
    const tasks = a.actionItems.filter((i) => !i.done).map((item) => ({ item, meetingTitle: meeting.title, date: resolveDue(item.due, created) })).filter((t) => t.date) as { item: ActionItem; meetingTitle: string; date: Date }[];
    if (!tasks.length) return toast.error('No open task has a due date yet. Add one, e.g. "Friday".');
    downloadFile(`${slug(meeting.title)}-tasks.ics`, toICS(tasks), 'text/calendar');
    toast.success(`${tasks.length} task${tasks.length === 1 ? '' : 's'} exported to your calendar file`);
  };

  const filtered = q.trim() ? meeting.segments.filter((s) => s.text.toLowerCase().includes(q.toLowerCase()) || s.speaker?.toLowerCase().includes(q.toLowerCase())) : meeting.segments;
  const highlight = (text: string) => {
    if (!q.trim()) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i} className="rounded bg-brand-100 px-0.5 text-brand-800">{p}</mark> : p));
  };
  const email = a?.followUpEmail || '';
  const subject = email.match(/^Subject: (.*)$/m)?.[1] || meeting.title;
  const body = email.replace(/^Subject: .*\n+/, '');
  const open = a?.actionItems.filter((i) => !i.done).length || 0;

  return (
    <div className="shell py-8">
      <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-950"><ArrowLeft className="h-4 w-4" />Meetings</Link>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            className="w-full rounded-lg bg-transparent text-[30px] font-extrabold tracking-tight outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 md:text-[36px]"
            value={meeting.title}
            maxLength={120}
            onChange={(e) => update({ title: e.target.value })}
            aria-label="Meeting title"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-500">
            <span>{formatTimestamp(meeting.createdAt)}</span>
            {meeting.durationSec ? <><span className="text-ink-300">·</span><span>{formatDuration(meeting.durationSec)}</span></> : null}
            {stats.length > 0 && <><span className="text-ink-300">·</span><span>{stats.length} speaker{stats.length === 1 ? '' : 's'}</span></>}
            {a && <span className={cn('chip ml-1', TONE[a.sentiment].cls)}>{TONE[a.sentiment].label}</span>}
            {a && <span className="chip bg-ink-950 text-white"><Sparkles className="h-3 w-3" />{a.engine === 'ai' ? 'AI notes' : 'Demo engine'}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={reanalyse} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}Regenerate</Button>
          <Button variant="outline" onClick={() => downloadFile(`${slug(meeting.title)}.md`, meetingToMarkdown(meeting))}><Download />Markdown</Button>
          <Button variant="danger" size="icon" onClick={() => { if (confirm('Delete this meeting?')) { deleteMeeting(meeting.id); router.push('/'); } }} aria-label="Delete meeting"><Trash2 /></Button>
        </div>
      </div>

      {a && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-5">
            <section className="panel overflow-hidden">
              <div className="h-1.5 bg-brand-gradient" />
              <div className="p-6">
                <div className="eyebrow mb-2">Summary</div>
                <p className="text-[16px] leading-relaxed text-ink-800">{a.summary}</p>
                {a.topics.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{a.topics.map((t) => <span key={t} className="chip bg-ink-100 text-ink-700">{t}</span>)}</div>}
                {a.keyPoints.length > 0 && (
                  <ul className="mt-5 space-y-2.5 border-t border-ink-100 pt-5 text-[14px] text-ink-700">
                    {a.keyPoints.map((k, i) => <li key={i} className="flex gap-3"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />{k}</li>)}
                  </ul>
                )}
              </div>
            </section>

            <Block
              title={`Action items · ${open} open`}
              icon={Check}
              action={<Button variant="outline" size="sm" onClick={exportCalendar}><CalendarPlus />Add to calendar</Button>}
            >
              <ul className="-mx-2">
                {a.actionItems.map((item) => {
                  const date = resolveDue(item.due, created);
                  return (
                    <li key={item.id} className="group flex items-start gap-3 rounded-xl px-2 py-2.5 transition hover:bg-ink-50">
                      <button
                        className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition', item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-300 hover:border-brand-500')}
                        onClick={() => patchItem(item.id, { done: !item.done })}
                        aria-label={`Mark "${item.task}" as ${item.done ? 'open' : 'done'}`}
                        aria-pressed={item.done}
                      >
                        {item.done && <Check className="h-3 w-3" strokeWidth={3.5} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={cn('text-[14px] font-semibold', item.done && 'text-ink-400 line-through')}>{item.task}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <input className="w-28 rounded-md bg-ink-100 px-2 py-1 text-[12px] font-semibold text-ink-700 outline-none placeholder:font-medium placeholder:text-ink-400 focus:bg-white focus:ring-2 focus:ring-brand-300" placeholder="+ Owner" value={item.owner || ''} maxLength={40} onChange={(e) => patchItem(item.id, { owner: e.target.value || undefined })} aria-label="Owner" />
                          <input className="w-28 rounded-md bg-ink-100 px-2 py-1 text-[12px] font-semibold text-ink-700 outline-none placeholder:font-medium placeholder:text-ink-400 focus:bg-white focus:ring-2 focus:ring-brand-300" placeholder="+ Due" value={item.due || ''} maxLength={40} onChange={(e) => patchItem(item.id, { due: e.target.value || undefined })} aria-label="Due" />
                          {date && <span className="text-[11.5px] font-medium text-ink-400">→ {formatDueDate(date)}</span>}
                        </div>
                      </div>
                      <button className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 opacity-0 transition hover:bg-brand-50 hover:text-brand-700 group-hover:opacity-100" onClick={() => updateItems(a.actionItems.filter((i) => i.id !== item.id))} aria-label="Remove task"><X className="h-4 w-4" /></button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex gap-2">
                <input className="field h-10" placeholder="Add a task and press Enter" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
                <Button variant="dark" size="icon" className="h-10 w-10" onClick={addTask} aria-label="Add task"><Plus /></Button>
              </div>
            </Block>

            <div className="grid gap-5 md:grid-cols-2">
              <Block title="Decisions" icon={Gavel}>
                {a.decisions.length ? (
                  <ol className="space-y-3 text-[14px] text-ink-700">{a.decisions.map((d, i) => <li key={i} className="flex gap-3"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-ink-950 text-[11px] font-bold text-white">{i + 1}</span>{d}</li>)}</ol>
                ) : <p className="text-[13px] text-ink-500">No firm decision was recorded.</p>}
              </Block>
              <Block title="Open questions" icon={CircleHelp}>
                {a.openQuestions.length ? (
                  <ul className="space-y-3 text-[14px] text-ink-700">{a.openQuestions.map((d, i) => <li key={i} className="flex gap-3"><span className="mt-[7px] h-2 w-2 shrink-0 rounded-full border-2 border-amber-500" />{d}</li>)}</ul>
                ) : <p className="text-[13px] text-ink-500">Nothing left hanging.</p>}
              </Block>
            </div>
          </div>

          <aside className="panel overflow-hidden lg:sticky lg:top-24">
            <div className="flex border-b border-ink-200 p-1.5">
              {([['email', 'Recap email', Mail], ['transcript', 'Transcript', MessageSquareText], ['health', 'Health', HeartPulse]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setTab(id)} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold transition', tab === id ? 'bg-ink-950 text-white' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-950')}>
                  <Icon className="h-4 w-4" />{label}
                  {id === 'health' && health && <span className={cn('rounded px-1 text-[10.5px]', tab === id ? 'bg-white/15' : 'bg-ink-100')}>{health.score}</span>}
                </button>
              ))}
            </div>

            {tab === 'email' && (
              <div className="p-5">
                <div className="rounded-xl border border-ink-200">
                  <div className="border-b border-ink-100 px-4 py-2.5 text-[12.5px]"><span className="text-ink-400">Subject </span><span className="font-bold">{subject}</span></div>
                  <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap px-4 py-3 font-sans text-[13px] leading-relaxed text-ink-800">{body}</pre>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" onClick={() => copyText(email).then(() => toast.success('Email copied'))}><Copy />Copy email</Button>
                  <Button variant="outline" asChild><a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}><Mail />Open</a></Button>
                </div>
              </div>
            )}

            {tab === 'transcript' && (
              <div className="p-5">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input className="field h-9 pl-9" placeholder="Find in transcript" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find in transcript" />
                </div>
                <div className="max-h-[520px] space-y-3.5 overflow-y-auto pr-1 text-[13.5px] leading-relaxed">
                  {filtered.map((s, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="mt-0.5 h-auto w-1 shrink-0 rounded-full" style={{ background: colorOf(s.speaker) }} />
                      <div className="min-w-0">
                        <div className="mb-0.5 flex items-center gap-2 text-[12px]">
                          {s.speaker && <b className="font-extrabold">{s.speaker}</b>}
                          {s.time !== undefined && <span className="font-mono text-[11px] text-ink-400">{formatTime(s.time)}</span>}
                        </div>
                        <p className="text-ink-700">{highlight(s.text)}</p>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && <p className="text-ink-500">No lines match “{q}”.</p>}
                </div>
              </div>
            )}

            {tab === 'health' && health && (
              <div className="p-5">
                <div className="mb-5 flex items-center gap-4">
                  <div className="relative grid h-16 w-16 place-items-center">
                    <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f5f5f4" strokeWidth="4" />
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#hg)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(health.score / 100) * 97.4} 97.4`} />
                      <defs><linearGradient id="hg"><stop offset="0" stopColor="#ff6b4a" /><stop offset="1" stopColor="#c81e1e" /></linearGradient></defs>
                    </svg>
                    <span className="text-[17px] font-extrabold tabular-nums">{health.score}</span>
                  </div>
                  <div>
                    <div className="text-[16px] font-extrabold">{health.grade}</div>
                    <div className="text-[12.5px] text-ink-500">{health.checks.filter((c) => c.ok).length} of {health.checks.length} checks passed</div>
                  </div>
                </div>
                <ul className="space-y-3">
                  {health.checks.map((c) => (
                    <li key={c.id} className="flex gap-3">
                      <span className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full', c.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600')}>{c.ok ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}</span>
                      <div><div className="text-[13.5px] font-bold">{c.label}</div><div className="text-[12.5px] text-ink-500">{c.detail}</div></div>
                    </li>
                  ))}
                </ul>
                {stats.length > 0 && (
                  <div className="mt-6 border-t border-ink-100 pt-5">
                    <div className="eyebrow mb-3">Talk time</div>
                    <div className="mb-3 flex h-2.5 overflow-hidden rounded-full">
                      {stats.map((s) => <div key={s.speaker} style={{ width: `${s.share * 100}%`, background: colorOf(s.speaker) }} />)}
                    </div>
                    <ul className="space-y-1.5">
                      {stats.map((s) => (
                        <li key={s.speaker} className="flex items-center justify-between text-[13px]">
                          <span className="flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(s.speaker) }} />{s.speaker}</span>
                          <span className="tabular-nums text-ink-500">{Math.round(s.share * 100)}% · {s.turns} turns</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function MeetingPage() {
  const id = useSearchParams().get('id');
  const meetings = useMeetings();
  const meeting = meetings.find((m) => m.id === id);
  if (!meeting)
    return (
      <div className="shell py-24 text-center">
        <h1 className="text-2xl font-extrabold">Meeting not found</h1>
        <p className="mt-2 text-ink-500">It may have been deleted, or it was saved in another browser.</p>
        <Button asChild className="mt-6"><Link href="/">Back to meetings</Link></Button>
      </div>
    );
  return <MeetingView meeting={meeting} />;
}

export default function Page() {
  return (
    <Suspense>
      <MeetingPage />
    </Suspense>
  );
}
