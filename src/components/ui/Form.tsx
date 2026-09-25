import clsx from 'clsx';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block space-y-1.5', className)}>
      <span className="block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted/80">{hint}</span>}
    </label>
  );
}

const INPUT = 'w-full rounded-lg border border-line bg-surface/70 px-3 py-2 text-sm text-ink outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] disabled:opacity-50';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...props} className={clsx(INPUT, props.className)} />;
}

export function NumberInput({ value, onChange, min, max, step, className, suffix, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))}
        className={clsx(INPUT, 'tabular', suffix && 'pr-10', className)}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={clsx(INPUT, 'cursor-pointer pr-8', className)}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx('inline-flex items-center gap-2 text-left text-sm', disabled && 'opacity-40')}
    >
      <span className={clsx('relative inline-block h-5 w-9 shrink-0 rounded-full transition', checked ? 'accent-bg' : 'bg-white/15')}>
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label && <span className="text-muted">{label}</span>}
    </button>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, size = 'sm' }: { value: T; options: { value: T; label: ReactNode; disabled?: boolean }[]; onChange: (value: T) => void; size?: 'xs' | 'sm' }) {
  return (
    <div className="inline-flex max-w-full flex-wrap rounded-lg border border-line bg-surface/60 p-0.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={clsx(
            'rounded-md font-medium transition',
            size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
            value === option.value ? 'accent-bg text-white shadow' : 'text-muted hover:text-ink',
            option.disabled && 'cursor-not-allowed opacity-35',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
