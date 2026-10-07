'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardPaste, FileUp, Mic } from 'lucide-react';
import Recorder from '@/components/Recorder';
import UploadPanel from '@/components/UploadPanel';
import PastePanel from '@/components/PastePanel';
import { cn } from '@/lib/utils';
import type { Meeting } from '@/lib/types';

type Mode = 'record' | 'upload' | 'paste';

const TABS = [
  { id: 'record' as const, label: 'Record', hint: 'Live captions', icon: Mic },
  { id: 'upload' as const, label: 'Upload', hint: 'Transcript or audio', icon: FileUp },
  { id: 'paste' as const, label: 'Paste', hint: 'Text or notes', icon: ClipboardPaste },
];

function NewMeeting() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = (params.get('mode') as Mode) || 'record';
  const [mode, setMode] = useState<Mode>(['record', 'upload', 'paste'].includes(initial) ? initial : 'record');
  const done = (m: Meeting) => router.push(`/meeting/?id=${encodeURIComponent(m.id)}`);

  return (
    <div className="shell py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-2">New meeting</div>
          <h1 className="text-[32px] font-extrabold tracking-tight">Capture the conversation</h1>
          <p className="mt-1 text-[15px] text-ink-500">Notes, decisions and owned next steps come out the other side in seconds.</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-ink-100 p-1">
          {TABS.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={cn('flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-left transition', mode === id ? 'bg-white shadow-card' : 'text-ink-500 hover:text-ink-950')}
              aria-pressed={mode === id}
            >
              <span className={cn('grid h-8 w-8 place-items-center rounded-lg', mode === id ? 'bg-brand-gradient text-white' : 'bg-white/70')}><Icon className="h-4 w-4" /></span>
              <span className="hidden sm:block">
                <span className="block text-[13px] font-extrabold text-ink-950">{label}</span>
                <span className="block text-[11.5px] text-ink-500">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      {mode === 'record' && <Recorder onDone={done} />}
      {mode === 'upload' && <UploadPanel onDone={done} />}
      {mode === 'paste' && <PastePanel onDone={done} />}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NewMeeting />
    </Suspense>
  );
}
