import clsx from 'clsx';
import { formatNumber } from '@/utils/format';

export function ProgressBar({ value, max = 1, tone = 'accent', className, height = 'h-2' }: { value: number; max?: number; tone?: 'accent' | 'good' | 'bad' | 'warn' | 'muted'; className?: string; height?: string }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const color = tone === 'accent' ? 'accent-bg' : tone === 'good' ? 'bg-emerald-400' : tone === 'bad' ? 'bg-red-400' : tone === 'warn' ? 'bg-amber-400' : 'bg-slate-500';
  return (
    <div className={clsx('w-full overflow-hidden rounded-full bg-white/8', height, className)}>
      <div className={clsx('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

/** Balken für einen Punktwert 0–100 mit Farbstufen. */
export function ScoreBar({ label, value, hint, compact = false }: { label: string; value: number; hint?: string; compact?: boolean }) {
  const tone = value >= 75 ? 'good' : value >= 50 ? 'accent' : value >= 30 ? 'warn' : 'bad';
  return (
    <div className={clsx(compact ? 'space-y-0.5' : 'space-y-1')} title={hint}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular font-semibold">{formatNumber(value)}</span>
      </div>
      <ProgressBar value={value} max={100} tone={tone} height={compact ? 'h-1.5' : 'h-2'} />
    </div>
  );
}
