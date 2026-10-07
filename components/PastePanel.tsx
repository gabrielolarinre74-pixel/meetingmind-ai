'use client';

import { useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
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
    if (segments.length === 0 || text.trim().split(/\s+/).length < 15) return alert('Paste at least a few sentences of transcript or notes.');
    setBusy(true);
    try {
      onDone(await createMeeting(segments, 'paste', { title }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="title">Title (optional)</label>
        <input id="title" className="field" maxLength={120} placeholder="We'll suggest one if you leave this empty" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <div className="flex items-end justify-between">
          <label className="label" htmlFor="text">Transcript or notes</label>
          <div className="mb-1.5 flex gap-1">
            {SAMPLE_TRANSCRIPTS.map((s, i) => (
              <button key={s.title} className="chip bg-ink-300/15 text-ink-500 hover:bg-brand-50 hover:text-brand-700" onClick={() => { setText(s.text); setTitle(s.title); }}>
                Sample {i + 1}
              </button>
            ))}
          </div>
        </div>
        <textarea
          id="text"
          className="field min-h-72 font-mono text-[13px] leading-relaxed"
          maxLength={MAX}
          placeholder={'Maya: Thanks for joining. Today we need to agree on the launch date.\nDaniel: I think we should aim for the 15th.\n\nTimestamps like [00:12] and WebVTT/SRT are supported.'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-1 flex justify-between text-xs text-ink-500">
          <span>{speakers.length ? `Speakers detected: ${speakers.join(', ')}` : 'No speaker labels detected (that’s fine for voice notes).'}</span>
          <span>{text.length.toLocaleString()}/{MAX.toLocaleString()}</span>
        </div>
      </div>
      <Button size="lg" className="w-full" onClick={submit} disabled={busy}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />} Generate notes
      </Button>
    </div>
  );
}
