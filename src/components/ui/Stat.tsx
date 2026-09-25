import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatSignedPercent } from '@/utils/format';

/** Veränderung als farbiger Pfeil (positiv = grün, sofern nicht invertiert). */
export function Delta({ value, invert = false, format = formatSignedPercent, className }: { value: number | null; invert?: boolean; format?: (v: number) => string; className?: string }) {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 1e-9) return <span className={clsx('text-xs text-muted', className)}>±0</span>;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-xs font-semibold tabular', good ? 'text-emerald-400' : 'text-red-400', className)}>
      <Icon size={13} />
      {format(value)}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  delta?: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'good' | 'bad' | 'warn';
  onClick?: () => void;
}

export function StatCard({ label, value, icon, delta, hint, tone = 'default', onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'fade-in rounded-xl border bg-panel/90 p-4 shadow-lg shadow-black/20 transition',
        tone === 'bad' ? 'border-red-500/40' : tone === 'warn' ? 'border-amber-500/40' : tone === 'good' ? 'border-emerald-500/30' : 'border-line',
        onClick && 'cursor-pointer hover:border-slate-500',
      )}
    >
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="font-medium uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight tabular">{value}</div>
      <div className="mt-1 flex min-h-[18px] items-center gap-2 text-xs text-muted">
        {delta}
        {hint && <span className="truncate">{hint}</span>}
      </div>
    </div>
  );
}

export function MiniStat({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-lg border border-line/70 bg-surface/50 px-3 py-2', className)}>
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

export function KeyValue({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-center justify-between gap-3 py-1 text-sm', className)}>
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium tabular">{value}</span>
    </div>
  );
}
