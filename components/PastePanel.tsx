'use client';

import { useState } from 'react';
import { Loader2, Sparkles, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { createMeeting } from '@/lib/process';
import { parseTranscript, speakerStats } from '@/lib/transcript';
import { SAMPLE_TRANSCRIPTS } from '@/lib/samples';
import type { Meeting } from '@/lib/types';

const MAX = 100_000;

export default function PastePanel({ onDone }: { onDone: (m: Meeting) => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const segments = parseTranscript(text);
  const speakers = speakerStats(segments).map((s) => s.speaker);

  const submit = async () => {
    if (segments.length === 0 || text.trim().split(/\s+/).length < 15) return void toast.error('Paste at least a few sentences of transcript or notes.');
    setBusy(true);
    try {
      onDone(await createMeeting(segments, 'paste', { title }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="panel p-6">
        <input
          className="mb-4 w-full bg-transparent text-[22px] font-extrabold tracking-tight outline-none placeholder:text-ink-300"
          maxLength={120}
          placeholder="Untitled meeting"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Title"
        />
        <textarea
          id="text"
          className="min-h-[380px] w-full resize-y rounded-xl border border-ink-200 bg-ink-50/60 p-4 font-mono text-[13px] leading-relaxed outline-none transition placeholder:text-ink-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
          maxLength={MAX}
          placeholder={'Maya: Thanks for joining. Today we need to agree on the launch date.\nDaniel: I think we should aim for the 15th.\n\nTimestamps like [00:12], WebVTT and SRT are supported.'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Transcript or notes"
        />
        <div className="mt-2 flex justify-between text-[12px] text-ink-500">
          <span>{text.trim() ? `${segments.length} line${segments.length === 1 ? '' : 's'} detected` : 'Paste a transcript, or try a sample on the right.'}</span>
          <span className="tabular-nums">{text.length.toLocaleString()} / {MAX.toLocaleString()}</span>
        </div>
        <Button size="lg" className="mt-4 w-full" onClick={submit} disabled={busy || !text.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Write my notes
        </Button>
      </div>
      <div className="space-y-3">
        <div className="panel p-5">
          <div className="eyebrow mb-3">Try a sample</div>
          <div className="space-y-2">
            {SAMPLE_TRANSCRIPTS.map((s) => (
              <button key={s.title} className="w-full rounded-xl border border-ink-200 px-3.5 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40" onClick={() => { setText(s.text); setTitle(s.title); }}>
                <div className="text-[13.5px] font-bold">{s.title}</div>
                <div className="mt-0.5 line-clamp-1 text-[12px] text-ink-500">{s.text.replace(/\s+/g, ' ').slice(0, 80)}</div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-ink-400">Fictional conversations for trying the app.</p>
        </div>
        <div className="panel p-5">
          <div className="mb-2 flex items-center gap-2 text-[13.5px] font-extrabold"><Users className="h-4 w-4 text-brand-600" />Speakers</div>
          {speakers.length ? (
            <div className="flex flex-wrap gap-1.5">{speakers.map((s) => <span key={s} className="chip bg-ink-100 text-ink-700">{s}</span>)}</div>
          ) : (
            <p className="text-[12.5px] text-ink-500">None detected yet. Use “Name: text” lines to get owners on tasks. Voice notes without names work too.</p>
          )}
        </div>
      </div>
    </div>
  );
}
