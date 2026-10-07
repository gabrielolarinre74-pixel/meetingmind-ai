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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
        className={cn(
          'dot-grid flex min-h-[380px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-white p-10 text-center transition',
          drag ? 'border-brand-500 bg-brand-50 ring-8 ring-brand-500/10' : 'border-ink-200 hover:border-brand-300',
        )}
      >
        <input type="file" className="hidden" accept=".txt,.vtt,.srt,.md,audio/*" onChange={(e) => handle(e.target.files?.[0])} disabled={!!busy} />
        {busy ? (
          <>
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-brand-600" />
            <div className="text-[16px] font-extrabold">{busy}</div>
          </>
        ) : (
          <>
            <span className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow"><UploadCloud className="h-7 w-7" /></span>
            <div className="text-[20px] font-extrabold tracking-tight">Drop a file here</div>
            <div className="mt-1 text-[14px] text-ink-500">or <span className="font-bold text-brand-700 underline underline-offset-4">browse your computer</span></div>
          </>
        )}
      </label>
      <div className="space-y-3">
        <div className="panel p-5">
          <div className="mb-2 flex items-center gap-2 text-[14px] font-extrabold"><FileText className="h-4 w-4 text-brand-600" />Transcripts</div>
          <p className="text-[13px] leading-relaxed text-ink-500">Zoom, Google Meet and Teams exports (.vtt, .srt) or plain .txt and .md notes, up to 2 MB. Works offline in demo mode.</p>
        </div>
        <div className="panel p-5">
          <div className="mb-2 flex items-center gap-2 text-[14px] font-extrabold"><FileAudio className="h-4 w-4 text-brand-600" />Audio</div>
          <p className="text-[13px] leading-relaxed text-ink-500">mp3, m4a, wav or webm up to 25 MB, transcribed with Whisper. Needs the AI engine and your own API key.</p>
        </div>
      </div>
    </div>
  );
}
