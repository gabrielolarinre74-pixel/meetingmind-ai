'use client';

import { useEffect, useState } from 'react';
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} />
      <aside role="dialog" aria-label="Settings" className="relative h-full w-full max-w-md space-y-5 overflow-y-auto bg-white p-6 shadow-2xl animate-in slide-in-from-right">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div>
          <span className="label">Analysis engine</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['demo', FlaskConical, 'Demo engine', 'Offline. No key. Rule-based extraction.'],
                ['ai', Sparkles, 'AI model', 'OpenAI-compatible API for richer notes + Whisper.'],
              ] as const
            ).map(([id, Icon, name, desc]) => (
              <button
                key={id}
                onClick={() => set('engine', id)}
                className={cn('rounded-xl border-2 p-3 text-left transition', draft.engine === id ? 'border-brand-500 bg-brand-50' : 'border-ink-300/40')}
              >
                <Icon className="mb-1 h-4 w-4 text-brand-600" />
                <div className="text-sm font-semibold">{name}</div>
                <div className="text-xs text-ink-500">{desc}</div>
              </button>
            ))}
          </div>
        </div>
        {draft.engine === 'ai' && (
          <div className="space-y-4 rounded-xl bg-brand-50/60 p-4">
            <div>
              <label className="label" htmlFor="key">API key</label>
              <div className="relative">
                <input id="key" className="field pr-10" type={show ? 'text' : 'password'} autoComplete="off" placeholder="sk-…" value={draft.apiKey} onChange={(e) => set('apiKey', e.target.value)} />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" onClick={() => setShow(!show)} aria-label="Toggle key visibility">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-ink-500">Stored only in this browser and sent only to the URL below.</p>
            </div>
            <div>
              <label className="label" htmlFor="url">API base URL</label>
              <input id="url" className="field" value={draft.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="model">Notes model</label>
                <input id="model" className="field" value={draft.model} onChange={(e) => set('model', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="tmodel">Transcription</label>
                <input id="tmodel" className="field" value={draft.transcribeModel} onChange={(e) => set('transcribeModel', e.target.value)} />
              </div>
            </div>
          </div>
        )}
        <div>
          <label className="label" htmlFor="name">Your name (for recap emails)</label>
          <input id="name" className="field" maxLength={60} value={draft.yourName} onChange={(e) => set('yourName', e.target.value)} placeholder="e.g. Alex" />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button className="w-full" onClick={save}>Save settings</Button>
      </aside>
    </div>
  );
}
