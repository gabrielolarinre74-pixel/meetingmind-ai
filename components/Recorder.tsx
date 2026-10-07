'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Plus, Square, Users } from 'lucide-react';
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
  const [levels, setLevels] = useState<number[]>(() => Array(36).fill(0));

  const recRef = useRef<SpeechRec | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const speakerRef = useRef(current);
  const activeRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
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
    cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevels(Array(36).fill(0));
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
      startMeter(stream);
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

  // Live input level so people can see the microphone is actually picking them up
  function startMeter(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      const data = new Uint8Array(analyser.frequencyBinCount);
      let last = 0;
      const tick = (t: number) => {
        rafRef.current = requestAnimationFrame(tick);
        if (t - last < 70) return;
        last = t;
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setLevels((prev) => [...prev.slice(1), Math.min(1, peak * 2.2)]);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      /* metering is optional */
    }
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

  const label = status === 'recording' ? 'Recording' : status === 'processing' ? 'Writing your notes' : 'Ready when you are';

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-white">
        <div className={cn('pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-gradient blur-3xl transition-opacity duration-700', status === 'recording' ? 'opacity-70' : 'opacity-30')} />
        <div className="relative">
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/30"
            placeholder="Meeting title (optional)"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={status !== 'idle'}
          />
          <div className="mt-10 text-center">
            <div className="flex items-center justify-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-white/60">
              {status === 'recording' && <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />}
              {label}
            </div>
            <div className="mt-2 font-mono text-[56px] font-medium tabular-nums tracking-tight">{formatTime(seconds)}</div>
          </div>
          <div className="mt-6 flex h-20 items-center justify-center gap-[3px]" aria-hidden>
            {levels.map((l, i) => (
              <span
                key={i}
                className={cn('w-[5px] rounded-full transition-[height] duration-75', status === 'recording' ? 'bg-gradient-to-t from-brand-600 to-brand-300' : 'bg-white/15')}
                style={{ height: `${status === 'recording' ? Math.max(6, l * 80) : 6 + ((i * 7) % 5) * 2}px` }}
              />
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            {status === 'idle' && <Button size="lg" className="w-full rounded-2xl" onClick={start}><Mic /> Start recording</Button>}
            {status === 'recording' && <Button size="lg" className="w-full rounded-2xl bg-white text-ink-950 shadow-none hover:bg-white/90 hover:brightness-100" onClick={stop}><Square className="fill-current" /> Stop and write notes</Button>}
            {status === 'processing' && <Button size="lg" disabled className="w-full rounded-2xl"><Loader2 className="animate-spin" /> Working…</Button>}
          </div>
          <p className="mt-4 text-center text-[12px] leading-relaxed text-white/45">
            {hasSR ? 'Live captions use your browser’s speech recognition. Audio is never uploaded unless you turn on the AI engine.' : 'Live captions need Chrome or Edge. With an API key, audio is transcribed by Whisper instead.'}
          </p>
        </div>
      </div>

      <div className="panel flex min-h-[460px] flex-col p-6">
        <div className="mb-4">
          <div className="mb-2.5 flex items-center gap-2 text-[14px] font-extrabold"><Users className="h-4 w-4 text-brand-600" />Who is speaking?</div>
          <div className="flex flex-wrap items-center gap-2">
            {speakers.map((s) => (
              <button key={s} onClick={() => setCurrent(s)} className={cn('h-8 rounded-lg px-3 text-[13px] font-bold transition', current === s ? 'bg-ink-950 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200')}>
                {s}
              </button>
            ))}
            <div className="flex items-center overflow-hidden rounded-lg border border-ink-200 focus-within:border-brand-400">
              <input className="h-8 w-32 bg-transparent px-2.5 text-[13px] outline-none placeholder:text-ink-400" placeholder="Add person" value={newSpeaker} maxLength={30} onChange={(e) => setNewSpeaker(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSpeaker()} />
              <button className="grid h-8 w-8 place-items-center border-l border-ink-200 text-ink-600 hover:bg-ink-50" onClick={addSpeaker} aria-label="Add speaker"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          <p className="mt-2 text-[12.5px] text-ink-500">Tap a name when someone starts talking. Lines are labelled so each action item gets the right owner.</p>
        </div>
        <div className="dot-grid flex-1 space-y-3 overflow-y-auto rounded-xl border border-ink-100 p-4 text-[14px] leading-relaxed">
          {segments.length === 0 && !interim && (
            <div className="grid h-full place-items-center text-center text-[13px] text-ink-400">The live transcript will appear here as people speak.</div>
          )}
          {segments.map((s, i) => (
            <p key={i} className="animate-rise rounded-lg bg-white/90 px-3 py-2 shadow-card">
              <span className="mr-2 font-mono text-[11px] text-ink-400">{formatTime(s.time)}</span>
              <b className="font-extrabold">{s.speaker}</b> <span className="text-ink-700">{s.text}</span>
            </p>
          ))}
          {interim && <p className="px-3 italic text-ink-500">{interim}</p>}
        </div>
      </div>
    </div>
  );
}
