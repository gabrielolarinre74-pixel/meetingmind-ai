'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, Copy, Download, Gavel, HelpCircle, Lightbulb, ListChecks, Loader2, Mail, Plus, RefreshCw, Search, Trash2, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { deleteMeeting, upsertMeeting, useMeetings } from '@/lib/store';
import { runAnalysis } from '@/lib/process';
import { meetingToMarkdown } from '@/lib/markdown';
import { formatTime, speakerStats } from '@/lib/transcript';
import { copyText, cn, downloadFile, formatDuration, formatTimestamp } from '@/lib/utils';
import type { ActionItem, Meeting } from '@/lib/types';

const SENTIMENT = {
  positive: 'bg-emerald-50 text-emerald-700',
  neutral: 'bg-ink-300/15 text-ink-500',
  tense: 'bg-amber-50 text-amber-700',
};

function Section({ title, icon: Icon, children, className }: { title: string; icon: typeof Users; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('card p-5', className)}>
      <h2 className="section-title"><Icon className="h-4 w-4 text-brand-500" />{title}</h2>
      {children}
    </section>
  );
}

function MeetingView({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [newTask, setNewTask] = useState('');
  const a = meeting.analysis;
  const stats = useMemo(() => speakerStats(meeting.segments), [meeting.segments]);

  const update = (patch: Partial<Meeting>) => upsertMeeting({ ...meeting, ...patch });
  const updateItems = (items: ActionItem[]) => a && update({ analysis: { ...a, actionItems: items } });

  const reanalyse = async () => {
    setBusy(true);
    const analysis = await runAnalysis(meeting.segments);
    // keep completed state for tasks that still exist
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

  const filtered = q.trim() ? meeting.segments.filter((s) => s.text.toLowerCase().includes(q.toLowerCase()) || s.speaker?.toLowerCase().includes(q.toLowerCase())) : meeting.segments;
  const highlight = (text: string) => {
    if (!q.trim()) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i} className="rounded bg-yellow-200 px-0.5">{p}</mark> : p));
  };
  const email = a?.followUpEmail || '';
  const subject = email.match(/^Subject: (.*)$/m)?.[1] || meeting.title;
  const body = email.replace(/^Subject: .*\n+/, '');

  return (
    <div className="max-width py-8">
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" />All meetings</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none focus:rounded-lg focus:ring-4 focus:ring-brand-500/15"
            value={meeting.title}
            maxLength={120}
            onChange={(e) => update({ title: e.target.value })}
            aria-label="Meeting title"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <span>{formatTimestamp(meeting.createdAt)}</span>
            {meeting.durationSec ? <span>· {formatDuration(meeting.durationSec)}</span> : null}
            {a && <span className={cn('chip', SENTIMENT[a.sentiment])}>{a.sentiment} tone</span>}
            {a && <span className="chip bg-brand-50 text-brand-700">{a.engine === 'ai' ? 'AI notes' : 'Demo engine notes'}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={reanalyse} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Regenerate</Button>
          <Button variant="outline" onClick={() => downloadFile(`${meeting.title.replace(/[^\w-]+/g, '-').toLowerCase()}.md`, meetingToMarkdown(meeting))}><Download className="h-4 w-4" />Export</Button>
          <Button variant="danger" size="icon" onClick={() => { if (confirm('Delete this meeting?')) { deleteMeeting(meeting.id); router.push('/'); } }} aria-label="Delete meeting"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {a && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Section title="Summary" icon={Lightbulb}>
              <p className="leading-relaxed">{a.summary}</p>
              {a.topics.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">{a.topics.map((t) => <span key={t} className="chip bg-brand-50 text-brand-700">#{t}</span>)}</div>
              )}
              {a.keyPoints.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-ink-300/20 pt-4 text-sm">
                  {a.keyPoints.map((k, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />{k}</li>)}
                </ul>
              )}
            </Section>

            <Section title={`Action items (${a.actionItems.filter((i) => !i.done).length} open)`} icon={ListChecks}>
              <ul className="divide-y divide-ink-300/20">
                {a.actionItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-2.5">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-brand-500"
                      checked={item.done}
                      onChange={() => updateItems(a.actionItems.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
                      aria-label={`Mark "${item.task}" as done`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-sm', item.done && 'text-ink-300 line-through')}>{item.task}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <input
                          className="w-28 rounded-md border border-transparent bg-ink-300/10 px-2 py-0.5 text-xs outline-none focus:border-brand-400"
                          placeholder="Owner"
                          value={item.owner || ''}
                          maxLength={40}
                          onChange={(e) => updateItems(a.actionItems.map((i) => (i.id === item.id ? { ...i, owner: e.target.value || undefined } : i)))}
                        />
                        <input
                          className="w-28 rounded-md border border-transparent bg-ink-300/10 px-2 py-0.5 text-xs outline-none focus:border-brand-400"
                          placeholder="Due"
                          value={item.due || ''}
                          maxLength={40}
                          onChange={(e) => updateItems(a.actionItems.map((i) => (i.id === item.id ? { ...i, due: e.target.value || undefined } : i)))}
                        />
                      </div>
                    </div>
                    <button className="text-ink-300 hover:text-rose-600" onClick={() => updateItems(a.actionItems.filter((i) => i.id !== item.id))} aria-label="Remove task"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <input className="field" placeholder="Add a task…" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
                <Button variant="outline" onClick={addTask} aria-label="Add task"><Plus className="h-4 w-4" /></Button>
              </div>
            </Section>

            <div className="grid gap-5 md:grid-cols-2">
              <Section title="Decisions" icon={Gavel}>
                {a.decisions.length ? (
                  <ul className="space-y-2 text-sm">{a.decisions.map((d, i) => <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{d}</li>)}</ul>
                ) : <p className="text-sm text-ink-500">No firm decisions recorded.</p>}
              </Section>
              <Section title="Open questions" icon={HelpCircle}>
                {a.openQuestions.length ? (
                  <ul className="space-y-2 text-sm">{a.openQuestions.map((d, i) => <li key={i} className="flex gap-2"><HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{d}</li>)}</ul>
                ) : <p className="text-sm text-ink-500">Nothing left hanging.</p>}
              </Section>
            </div>
          </div>

          <div className="space-y-5">
            <Section title="Follow-up email" icon={Mail}>
              <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-ink-300/10 p-3 font-sans text-[13px] leading-relaxed">{email}</pre>
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" onClick={() => copyText(email).then(() => toast.success('Email copied'))}><Copy className="h-4 w-4" />Copy</Button>
                <Button variant="outline" asChild><a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}><Mail className="h-4 w-4" />Open</a></Button>
              </div>
            </Section>
            {stats.length > 0 && (
              <Section title="Talk time" icon={Users}>
                <ul className="space-y-3">
                  {stats.map((s) => (
                    <li key={s.speaker}>
                      <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{s.speaker}</span><span className="tabular-nums text-ink-500">{Math.round(s.share * 100)}% · {s.turns} turns</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-300/20"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500" style={{ width: `${s.share * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      )}

      <section className="card mt-5 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title !mb-0">Transcript</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input className="field h-9 pl-9" placeholder="Find in transcript" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="max-h-[480px] space-y-3 overflow-y-auto text-sm leading-relaxed">
          {filtered.map((s, i) => (
            <p key={i} className="flex gap-3">
              {s.time !== undefined && <span className="w-12 shrink-0 pt-0.5 text-right font-mono text-xs text-ink-300">{formatTime(s.time)}</span>}
              <span>{s.speaker && <b className="mr-1 text-brand-700">{s.speaker}:</b>}{highlight(s.text)}</span>
            </p>
          ))}
          {filtered.length === 0 && <p className="text-ink-500">No lines match “{q}”.</p>}
        </div>
      </section>
    </div>
  );
}

function MeetingPage() {
  const id = useSearchParams().get('id');
  const meetings = useMeetings();
  const meeting = meetings.find((m) => m.id === id);
  if (!meeting)
    return (
      <div className="max-width py-20 text-center">
        <h1 className="text-2xl font-semibold">Meeting not found</h1>
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
