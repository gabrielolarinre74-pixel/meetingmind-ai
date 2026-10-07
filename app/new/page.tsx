'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardPaste, Mic, Upload } from 'lucide-react';
import Recorder from '@/components/Recorder';
import UploadPanel from '@/components/UploadPanel';
import PastePanel from '@/components/PastePanel';
import { cn } from '@/lib/utils';
import type { Meeting } from '@/lib/types';

type Mode = 'record' | 'upload' | 'paste';

function NewMeeting() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = (params.get('mode') as Mode) || 'record';
  const [mode, setMode] = useState<Mode>(['record', 'upload', 'paste'].includes(initial) ? initial : 'record');
  const done = (m: Meeting) => router.push(`/meeting/?id=${encodeURIComponent(m.id)}`);

  const TABS = [
    { id: 'record' as const, label: 'Record', icon: Mic },
    { id: 'upload' as const, label: 'Upload file', icon: Upload },
    { id: 'paste' as const, label: 'Paste text', icon: ClipboardPaste },
  ];

  return (
    <div className="max-width max-w-4xl py-10">
      <h1 className="text-3xl font-semibold tracking-tight">New meeting</h1>
      <p className="mt-1 text-ink-500">Capture a conversation and get notes, decisions and next steps in seconds.</p>
      <div className="mt-6 inline-flex gap-1 rounded-2xl bg-ink-300/15 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn('flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition', mode === id && 'bg-white text-ink-900 shadow')}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {mode === 'record' && <Recorder onDone={done} />}
        {mode === 'upload' && <UploadPanel onDone={done} />}
        {mode === 'paste' && <PastePanel onDone={done} />}
      </div>
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
