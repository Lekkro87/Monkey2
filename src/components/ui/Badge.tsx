import clsx from 'clsx';
import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'info' | 'accent';

const TONES: Record<Tone, string> = {
  neutral: 'bg-white/5 text-muted border-white/10',
  good: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  bad: 'bg-red-500/10 text-red-300 border-red-500/25',
  warn: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  info: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  accent: 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-ink border-[color-mix(in_srgb,var(--accent)_45%,transparent)]',
};

export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}
