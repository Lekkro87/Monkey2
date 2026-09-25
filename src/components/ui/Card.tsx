import clsx from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

export function Card({ title, subtitle, actions, icon, className, bodyClassName, children }: CardProps) {
  return (
    <section className={clsx('rounded-xl border border-line bg-panel/90 shadow-lg shadow-black/20 fade-in', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-line/70 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="text-muted">{icon}</span>}
            <div className="min-w-0">
              {title && <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {actions}
    </div>
  );
}

export function PageHeader({ title, description, actions, icon }: { title: string; description?: string; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 accent-text">{icon}</div>}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
