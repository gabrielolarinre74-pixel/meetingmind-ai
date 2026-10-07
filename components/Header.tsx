'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ListChecks, Mic, Settings, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SettingsDialog from '@/components/SettingsDialog';
import { useSettings } from '@/lib/store';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Meetings', icon: LayoutGrid },
  { href: '/actions/', label: 'Action items', icon: ListChecks },
];

export default function Header() {
  const path = usePathname();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const logo = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.svg`;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-300/20 bg-white/70 backdrop-blur-xl">
      <div className="max-width flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={36} height={36} className="h-9 w-9" />
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-tight">
              Meeting<span className="text-brand-500">Mind</span>
            </div>
            <div className="hidden text-[11px] text-ink-500 sm:block">by Gabriel.ATH</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? path === '/' || path.startsWith('/meeting') : path.startsWith(href.replace(/\/$/, ''));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-500 transition hover:text-ink-900',
                  active && 'bg-brand-50 text-brand-700',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            className="ml-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-500 hover:text-ink-900"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
            <span className={cn('chip hidden lg:inline-flex', settings.engine === 'ai' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
              {settings.engine === 'ai' ? `AI · ${settings.model}` : 'Demo engine'}
            </span>
          </button>
          <Button asChild size="sm" className="ml-1 h-9">
            <Link href="/new/">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">New meeting</span>
            </Link>
          </Button>
        </nav>
      </div>
      <SettingsDialog open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
