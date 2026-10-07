'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Plus, Square, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { createMeeting } from '@/lib/process';
import { transcribeAudio, validateAi } from '@/lib/ai';
import { getSettings } from '@/lib/store';
import { formatTime } from '@/lib/transcript';
import { cn } from '@/lib/utils';
import type { Meeting, Segment } from '@/lib/types';

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib yet)
type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function pickMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
}

export default function Recorder({ onDone }: { onDone: (m: Meeting) => void }) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState('');
  const [speakers, setSpeakers] = useState<string[]>(['Me']);
  const [current, setCurrent] = useState('Me');
  const [newSpeaker, setNewSpeaker] = useState('');
  const [title, setTitle] = useState('');
  const [hasSR, setHasSR] = useState(true);

  const recRef = useRef<SpeechRec | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const speakerRef = useRef(current);
  const activeRef = useRef(false);
  speakerRef.current = current;

  useEffect(() => setHasSR(!!getSpeechRecognition()), []);

  useEffect(() => {
    if (status !== 'recording') return;
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [status]);

  // Always release the microphone when leaving the page
  useEffect(() => () => stopEverything(), []);

  function stopEverything() {
    activeRef.current = false;
    recRef.current?.stop();
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function start() {
    const settings = getSettings();
    const canWhisper = settings.engine === 'ai' && !validateAi(settings);
    const SR = getSpeechRecognition();
    if (!SR && !canWhisper) {
      toast.error('Live transcription is not supported in this browser. Use Chrome or Edge, or add an API key to transcribe with Whisper.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (canWhisper) {
        const mimeType = pickMimeType();
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
        rec.start(1000);
        mediaRef.current = rec;
      }
    } catch {
      toast.error('Microphone access was blocked. Allow it in your browser settings and try again.');
      return;
    }
    setSegments([]);
    setSeconds(0);
    startRef.current = Date.now();
    activeRef.current = true;
    if (SR) {
      const r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = navigator.language || 'en-US';
      r.onresult = (e) => {
        let live = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const text = res[0].transcript.trim();
          if (!text) continue;
          if (res.isFinal) {
            const time = (Date.now() - startRef.current) / 1000;
            const sentence = text.charAt(0).toUpperCase() + text.slice(1) + (/[.!?]$/.test(text) ? '' : '.');
            setSegments((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.speaker === speakerRef.current && last.text.length < 500) {
                return [...prev.slice(0, -1), { ...last, text: `${last.text} ${sentence}` }];
              }
              return [...prev, { speaker: speakerRef.current, time, text: sentence }];
            });
          } else live += `${text} `;
        }
        setInterim(live);
      };
      r.onerror = (e) => e.error !== 'no-speech' && e.error !== 'aborted' && toast.error(`Speech recognition: ${e.error}`);
      // Chrome stops recognition after a pause; restart while we're still recording
      r.onend = () => activeRef.current && r.start();
      r.start();
      recRef.current = r;
    }
    setStatus('recording');
  }

  async function stop() {
    const duration = Math.floor((Date.now() - startRef.current) / 1000);
    setStatus('processing');
    setInterim('');
    const media = mediaRef.current;
    const audioDone = new Promise<Blob | null>((resolve) => {
      if (!media || media.state !== 'recording') return resolve(null);
      // use the recorder's real MIME type (the browser records webm/ogg/mp4, not mp3)
      media.onstop = () => resolve(new Blob(chunksRef.current, { type: media.mimeType || 'audio/webm' }));
    });
    stopEverything();
    const audio = await audioDone;
    try {
      let segs = segments;
      const settings = getSettings();
      if (audio && audio.size > 0 && settings.engine === 'ai' && !validateAi(settings)) {
        toast.loading('Transcribing with Whisper…', { id: 'tx' });
        const ext = (audio.type.split('/')[1] || 'webm').split(';')[0];
        try {
          const whisper = await transcribeAudio(audio, `meeting.${ext}`, settings);
          if (whisper.some((s) => s.text)) segs = whisper;
        } catch (e) {
          toast.error(`${(e as Error).message} Using the live transcript instead.`);
        }
        toast.dismiss('tx');
      }
      if (!segs.length || segs.every((s) => !s.text.trim())) {
        toast.error('Nothing was captured. Check your microphone and try again.');
        setStatus('idle');
        return;
      }
      onDone(await createMeeting(segs, 'live', { title, durationSec: duration }));
    } catch (e) {
      toast.error((e as Error).message);
      setStatus('idle');
    }
  }

  const addSpeaker = () => {
    const name = newSpeaker.trim().slice(0, 30);
    if (!name || speakers.includes(name)) return;
    setSpeakers([...speakers, name]);
    setCurrent(name);
    setNewSpeaker('');
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <div className="card flex flex-col items-center p-6">
        <input className="field mb-6 text-center" placeholder="Meeting title (optional)" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} disabled={status !== 'idle'} />
        <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
          <div className={cn('recording-box absolute h-full w-full rounded-full p-[12%] pt-[17%]', status === 'recording' && 'record-animation')}>
            <div className="h-full w-full rounded-full" style={{ background: 'linear-gradient(#E31C1CD6, #003EB6CC)' }} />
          </div>
          <div className="z-10 text-center text-white">
            <div className="text-5xl font-light tabular-nums tracking-tight">{formatTime(seconds)}</div>
            <div className="mt-1 text-xs uppercase tracking-widest opacity-80">{status === 'recording' ? 'Recording' : status === 'processing' ? 'Processing' : 'Ready'}</div>
          </div>
        </div>
        <div className="mt-8">
          {status === 'idle' && (
            <Button size="lg" className="rounded-full px-8" onClick={start}><Mic className="h-5 w-5" /> Start recording</Button>
          )}
          {status === 'recording' && (
            <Button size="lg" variant="dark" className="rounded-full px-8" onClick={stop}><Square className="h-4 w-4 fill-current" /> Stop & analyse</Button>
          )}
          {status === 'processing' && (
            <Button size="lg" disabled className="rounded-full px-8"><Loader2 className="h-5 w-5 animate-spin" /> Working…</Button>
          )}
        </div>
        {!hasSR && <p className="mt-4 text-center text-xs text-amber-700">Live captions need Chrome or Edge. With an API key, audio is transcribed by Whisper instead.</p>}
      </div>

      <div className="card flex min-h-[420px] flex-col p-5">
        <div className="mb-3">
          <div className="section-title"><UserRound className="h-4 w-4" />Who is speaking?</div>
          <div className="flex flex-wrap items-center gap-2">
            {speakers.map((s) => (
              <button key={s} onClick={() => setCurrent(s)} className={cn('rounded-full border px-3 py-1 text-sm transition', current === s ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-300/50 hover:border-brand-400')}>
                {s}
              </button>
            ))}
            <div className="flex items-center">
              <input className="field h-8 w-32 rounded-r-none py-1" placeholder="Add person" value={newSpeaker} onChange={(e) => setNewSpeaker(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSpeaker()} />
              <button className="flex h-8 items-center rounded-r-xl bg-brand-500 px-2 text-white" onClick={addSpeaker} aria-label="Add speaker"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-500">Tap a name when someone starts talking. Their words are labelled in the transcript so action items get the right owner.</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-ink-300/10 p-4 text-sm leading-relaxed">
          {segments.length === 0 && !interim && <p className="text-ink-500">The live transcript will appear here…</p>}
          {segments.map((s, i) => (
            <p key={i}>
              <span className="mr-2 font-mono text-xs text-ink-300">{formatTime(s.time)}</span>
              <b className="text-brand-700">{s.speaker}:</b> {s.text}
            </p>
          ))}
          {interim && <p className="italic text-ink-500">{interim}</p>}
        </div>
      </div>
    </div>
  );
}
