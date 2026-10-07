'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, FileText, Mic, Search, Sparkles, Trash2, Upload, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteMeeting, getMeetings, saveMeetings, useMeetings } from '@/lib/store';
import { sampleMeetings } from '@/lib/seed';
import { searchMeetings } from '@/lib/search';
import { formatDuration, formatTimestamp } from '@/lib/utils';
import type { Meeting } from '@/lib/types';

const SOURCE_LABEL: Record<Meeting['source'], string> = { live: 'Live recording', audio: 'Audio file', upload: 'Transcript file', paste: 'Pasted', sample: 'Sample' };

export default function Dashboard() {
  const meetings = useMeetings();
  const [query, setQuery] = useState('');

  // First visit: load the sample meetings so the demo isn't empty
  useEffect(() => {
    if (!localStorage.getItem('mm-seeded') && getMeetings().length === 0) {
      saveMeetings(sampleMeetings());
      localStorage.setItem('mm-seeded', '1');
    }
  }, []);

  const results = useMemo(() => searchMeetings(meetings, query), [meetings, query]);
  const openItems = meetings.flatMap((m) => m.analysis?.actionItems || []).filter((a) => !a.done).length;
  const minutes = Math.round(meetings.reduce((n, m) => n + (m.durationSec || 0), 0) / 60);
  const decisions = meetings.reduce((n, m) => n + (m.analysis?.decisions.length || 0), 0);

  return (
    <div className="max-width py-10">
      <section className="mb-10 grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <span className="chip mb-4 bg-brand-100 text-brand-700">
            <Sparkles className="h-3.5 w-3.5" /> AI meeting assistant for busy teams
          </span>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Stop taking notes.{' '}
            <span className="bg-gradient-to-r from-brand-500 to-fuchsia-500 bg-clip-text text-transparent">Start closing loops.</span>
          </h1>
          <p className="mt-4 max-w-xl text-ink-500">
            Record a call, upload a Zoom/Meet/Teams transcript or a voice note. MeetingMind pulls out the decisions, the action items with owners and due dates,
            and writes the follow-up email for you.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/new/?mode=record"><Mic className="h-5 w-5" /> Record a meeting</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/new/?mode=upload"><Upload className="h-5 w-5" /> Upload</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/new/?mode=paste"><ClipboardPaste className="h-5 w-5" /> Paste transcript</Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Meetings', value: meetings.length, icon: FileText },
            { label: 'Open action items', value: openItems, icon: CheckCircle2 },
            { label: 'Minutes captured', value: minutes, icon: Clock },
            { label: 'Decisions logged', value: decisions, icon: Sparkles },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="card p-5">
              <Icon className="mb-3 h-5 w-5 text-brand-500" />
              <div className="text-3xl font-semibold tabular-nums">{value}</div>
              <div className="text-sm text-ink-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Your meetings</h2>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input className="field pl-9" placeholder="Search transcripts, tasks, summaries…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search meetings" />
          </div>
        </div>
        {results.length === 0 ? (
          <div className="card grid place-items-center p-12 text-center text-ink-500">
            {meetings.length ? 'No meeting matches your search.' : 'No meetings yet. Record or upload your first one.'}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map(({ meeting: m, snippet }) => {
              const items = m.analysis?.actionItems || [];
              const done = items.filter((i) => i.done).length;
              return (
                <article key={m.id} className="card group relative flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-200">
                  <div className="mb-2 flex items-center justify-between text-xs text-ink-500">
                    <span>{formatTimestamp(m.createdAt)}</span>
                    <span className="chip bg-ink-300/15 text-ink-500">{SOURCE_LABEL[m.source]}</span>
                  </div>
                  <Link href={`/meeting/?id=${encodeURIComponent(m.id)}`} className="text-lg font-semibold leading-snug after:absolute after:inset-0">
                    {m.title}
                  </Link>
                  <p className="mt-2 line-clamp-3 text-sm text-ink-500">{snippet || m.analysis?.summary || 'Not analysed yet.'}</p>
                  <div className="mt-auto flex items-center justify-between pt-4 text-xs text-ink-500">
                    <span className="flex items-center gap-3">
                      {m.durationSec ? <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDuration(m.durationSec)}</span> : null}
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{done}/{items.length} done</span>
                    </span>
                    <button
                      className="relative z-10 rounded-lg p-1.5 text-ink-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                      onClick={() => confirm(`Delete "${m.title}"?`) && deleteMeeting(m.id)}
                      aria-label={`Delete ${m.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {items.length > 0 && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-300/20">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500" style={{ width: `${(done / items.length) * 100}%` }} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
