import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGameStore } from '@/store/gameStore';

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', title, children, action }: { tone?: 'info' | 'warn' | 'bad' | 'good'; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const styles = {
    info: 'border-sky-500/30 bg-sky-500/5 text-sky-200',
    warn: 'border-amber-500/35 bg-amber-500/5 text-amber-100',
    bad: 'border-red-500/40 bg-red-500/10 text-red-100',
    good: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100',
  }[tone];
  const Icon = tone === 'bad' ? XCircle : tone === 'warn' ? AlertTriangle : tone === 'good' ? CheckCircle2 : Info;
  return (
    <div className={clsx('flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm', styles)}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className="mt-0.5 text-[13px] opacity-90">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span title={text} className="inline-flex cursor-help text-muted/70 hover:text-muted">
      <Info size={13} />
    </span>
  );
}

export function ToastContainer() {
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = toast.kind === 'error' ? XCircle : toast.kind === 'warning' ? AlertTriangle : toast.kind === 'success' ? CheckCircle2 : Info;
        const color =
          toast.kind === 'error'
            ? 'border-red-500/40 text-red-100'
            : toast.kind === 'warning'
              ? 'border-amber-500/40 text-amber-100'
              : toast.kind === 'success'
                ? 'border-emerald-500/35 text-emerald-100'
                : 'border-sky-500/35 text-sky-100';
        return (
          <div key={toast.id} role="status" className={clsx('pointer-events-auto fade-in flex items-start gap-2.5 rounded-xl border bg-panel/95 px-3.5 py-3 text-sm shadow-xl shadow-black/40 backdrop-blur', color)}>
            <Icon size={17} className="mt-0.5 shrink-0" />
            <span className="flex-1">{toast.message}</span>
            <button type="button" className="text-muted hover:text-ink" onClick={() => dismiss(toast.id)} aria-label="Schließen">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
