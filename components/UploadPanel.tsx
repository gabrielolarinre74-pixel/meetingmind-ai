'use client';

import { useState } from 'react';
import { FileAudio, FileText, Loader2, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { createMeeting } from '@/lib/process';
import { transcribeAudio, validateAi } from '@/lib/ai';
import { getSettings } from '@/lib/store';
import { parseTranscript } from '@/lib/transcript';
import { cn } from '@/lib/utils';
import type { Meeting } from '@/lib/types';

const TEXT_EXT = /\.(txt|vtt|srt|md)$/i;
const AUDIO_EXT = /\.(mp3|m4a|wav|webm|ogg|mp4|mpeg|mpga)$/i;

export default function UploadPanel({ onDone }: { onDone: (m: Meeting) => void }) {
  const [busy, setBusy] = useState('');
  const [drag, setDrag] = useState(false);

  const handle = async (file?: File) => {
    if (!file) return;
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    try {
      if (TEXT_EXT.test(file.name)) {
        if (file.size > 2_000_000) throw new Error('Transcript files must be under 2 MB.');
        setBusy('Reading transcript…');
        const segments = parseTranscript(await file.text());
        if (!segments.length) throw new Error('That file looks empty.');
        setBusy('Analysing…');
        onDone(await createMeeting(segments, 'upload', { title }));
      } else if (AUDIO_EXT.test(file.name) || file.type.startsWith('audio/')) {
        const s = getSettings();
        if (s.engine !== 'ai' || validateAi(s)) throw new Error('Audio transcription needs the AI engine. Add an API key in Settings, or upload a transcript instead.');
        setBusy('Transcribing audio…');
        const segments = await transcribeAudio(file, file.name, s);
        setBusy('Analysing…');
        onDone(await createMeeting(segments, 'audio', { title }));
      } else {
        throw new Error('Unsupported file. Use .txt, .vtt, .srt, .md or an audio file.');
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      className={cn('card flex cursor-pointer flex-col items-center justify-center border-2 border-dashed p-14 text-center transition', drag ? 'border-brand-500 bg-brand-50' : 'border-ink-300/50 hover:border-brand-400')}
    >
      <input type="file" className="hidden" accept=".txt,.vtt,.srt,.md,audio/*" onChange={(e) => handle(e.target.files?.[0])} disabled={!!busy} />
      {busy ? (
        <>
          <Loader2 className="mb-3 h-10 w-10 animate-spin text-brand-500" />
          <div className="font-semibold">{busy}</div>
        </>
      ) : (
        <>
          <UploadCloud className="mb-3 h-10 w-10 text-brand-500" />
          <div className="text-lg font-semibold">Drop a file or click to browse</div>
          <div className="mt-4 grid gap-3 text-left text-sm text-ink-500 sm:grid-cols-2">
            <div className="flex gap-2 rounded-xl bg-ink-300/10 p-3"><FileText className="h-5 w-5 shrink-0 text-brand-500" /><span><b className="text-ink-900">Transcripts</b><br />Zoom, Meet & Teams .vtt / .srt, or .txt / .md notes. Works offline.</span></div>
            <div className="flex gap-2 rounded-xl bg-ink-300/10 p-3"><FileAudio className="h-5 w-5 shrink-0 text-brand-500" /><span><b className="text-ink-900">Audio</b><br />mp3, m4a, wav, webm up to 25 MB. Transcribed with Whisper (AI engine).</span></div>
          </div>
        </>
      )}
    </label>
  );
}
