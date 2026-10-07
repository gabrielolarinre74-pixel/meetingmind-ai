'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, EyeOff, FlaskConical, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { getSettings, saveSettings } from '@/lib/store';
import { validateAi, type AiSettings } from '@/lib/ai';
import { cn } from '@/lib/utils';

export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<AiSettings>(getSettings());
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(getSettings());
      setError('');
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!open) return null;
  const set = <K extends keyof AiSettings>(k: K, v: AiSettings[K]) => setDraft({ ...draft, [k]: v });

  const save = () => {
    const problem = validateAi(draft);
    if (problem) return setError(problem);
    saveSettings({ ...draft, apiKey: draft.apiKey.trim() });
    toast.success('Settings saved');
    onClose();
  };

  // Portal to <body>: the sticky header uses backdrop-filter, which would otherwise trap a fixed overlay inside it
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Settings" className="relative w-full max-w-[520px] animate-rise overflow-hidden rounded-3xl bg-white shadow-lift">
        <div className="h-1 bg-brand-gradient" />
        <div className="flex items-start justify-between px-6 pb-2 pt-5">
          <div>
            <h2 className="text-[19px] font-extrabold tracking-tight">Settings</h2>
            <p className="text-[13px] text-ink-500">Choose how notes are written. Everything stays in this browser.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></Button>
        </div>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-4">
          <div>
            <span className="label">Notes engine</span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['demo', FlaskConical, 'Offline', 'Built-in extraction. No key, nothing leaves your device.'],
                  ['ai', Sparkles, 'AI model', 'Any OpenAI-compatible API, plus Whisper for audio.'],
                ] as const
              ).map(([id, Icon, name, desc]) => (
                <button
                  key={id}
                  onClick={() => set('engine', id)}
                  aria-pressed={draft.engine === id}
                  className={cn('rounded-2xl border p-4 text-left transition', draft.engine === id ? 'border-ink-950 ring-4 ring-ink-950/5' : 'border-ink-200 hover:border-ink-300')}
                >
                  <span className={cn('mb-3 grid h-8 w-8 place-items-center rounded-lg', draft.engine === id ? 'bg-brand-gradient text-white' : 'bg-ink-100 text-ink-600')}><Icon className="h-4 w-4" /></span>
                  <div className="text-[14px] font-extrabold">{name}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-ink-500">{desc}</div>
                </button>
              ))}
            </div>
          </div>
          {draft.engine === 'ai' && (
            <div className="space-y-4 rounded-2xl border border-ink-100 bg-ink-50/70 p-4">
              <div>
                <label className="label" htmlFor="key">API key</label>
                <div className="relative">
                  <input id="key" className="field pr-10 font-mono" type={show ? 'text' : 'password'} autoComplete="off" placeholder="sk-…" value={draft.apiKey} onChange={(e) => set('apiKey', e.target.value)} />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" onClick={() => setShow(!show)} aria-label="Toggle key visibility">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[12px] text-ink-500">Saved only in this browser and sent only to the base URL below.</p>
              </div>
              <div>
                <label className="label" htmlFor="url">Base URL</label>
                <input id="url" className="field font-mono" value={draft.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="model">Notes model</label>
                  <input id="model" className="field font-mono" value={draft.model} onChange={(e) => set('model', e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="tmodel">Transcription</label>
                  <input id="tmodel" className="field font-mono" value={draft.transcribeModel} onChange={(e) => set('transcribeModel', e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="label" htmlFor="name">Your name</label>
            <input id="name" className="field" maxLength={60} value={draft.yourName} onChange={(e) => set('yourName', e.target.value)} placeholder="Used to sign recap emails" />
          </div>
          {error && <p className="rounded-lg bg-brand-50 px-3 py-2 text-[13px] font-semibold text-brand-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-ink-100 bg-ink-50/50 px-6 py-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="dark" onClick={save}>Save settings</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
