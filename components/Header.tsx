'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CalendarCheck2, Mic, Rows3, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SettingsDialog from '@/components/SettingsDialog';
import { useMeetings, useSettings } from '@/lib/store';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Meetings', icon: Rows3 },
  { href: '/actions/', label: 'Action items', icon: CalendarCheck2 },
];

export default function Header() {
  const path = usePathname();
  const settings = useSettings();
  const meetings = useMeetings();
  const [open, setOpen] = useState(false);
  const logo = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.svg`;
  const openTasks = meetings.flatMap((m) => m.analysis?.actionItems || []).filter((a) => !a.done).length;

  // "," opens settings from anywhere (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === ',' && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable) setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink-200/80 bg-white/80 backdrop-blur-xl">
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={32} height={32} className="h-8 w-8" />
          <span className="leading-none">
            <span className="block text-[16px] font-extrabold tracking-tight">MeetingMind</span>
            <span className="mt-0.5 hidden text-[11px] font-semibold text-ink-400 sm:block">by Gabriel.ATH</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 rounded-xl bg-ink-100 p-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? path === '/' || path.startsWith('/meeting') : path.startsWith(href.replace(/\/$/, ''));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] font-bold text-ink-500 transition hover:text-ink-950',
                  active && 'bg-white text-ink-950 shadow-card',
                )}
              >
                <Icon className={cn('h-4 w-4', active && 'text-brand-600')} />
                <span className="hidden md:inline">{label}</span>
                {href === '/actions/' && openTasks > 0 && <span className="rounded-md bg-ink-950 px-1.5 text-[10.5px] leading-[18px] text-white">{openTasks}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="flex h-9 items-center gap-2 rounded-xl px-2.5 text-[12.5px] font-semibold text-ink-600 transition hover:bg-ink-100 hover:text-ink-950"
            aria-label="Settings"
          >
            <span className={cn('h-2 w-2 rounded-full', settings.engine === 'ai' ? 'bg-brand-500' : 'bg-emerald-500')} />
            <span className="hidden lg:inline">{settings.engine === 'ai' ? settings.model : 'Demo mode'}</span>
            <Settings2 className="h-4 w-4" />
          </button>
          <Button asChild size="sm" className="h-9 px-3.5">
            <Link href="/new/">
              <Mic />
              <span className="hidden sm:inline">New meeting</span>
            </Link>
          </Button>
        </div>
      </div>
      <SettingsDialog open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
