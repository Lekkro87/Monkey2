import clsx from 'clsx';
import { CATEGORIES } from '@/data/categories';
import { FEATURE_LABELS } from '@/data/componentCatalog';
import { Badge } from '@/components/ui/Badge';
import { ScoreBar } from '@/components/ui/Progress';
import { KeyValue } from '@/components/ui/Stat';
import { ATTRIBUTE_LABELS } from '@/systems/products/design';
import { DEV_PHASES } from '@/systems/products/phases';
import type { Product, ProductAttributes, ProductCategoryId, ProductSpecSummary, ProductStatus } from '@/types';
import { formatNumber } from '@/utils/format';

const STATUS_LABELS: Record<ProductStatus, { label: string; tone: 'neutral' | 'info' | 'good' | 'warn' | 'bad' | 'accent' }> = {
  draft: { label: 'Entwurf', tone: 'neutral' },
  development: { label: 'In Entwicklung', tone: 'info' },
  ready: { label: 'Marktreif', tone: 'accent' },
  on_sale: { label: 'Im Verkauf', tone: 'good' },
  discontinued: { label: 'Eingestellt', tone: 'neutral' },
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  const info = STATUS_LABELS[status];
  return <Badge tone={info.tone}>{info.label}</Badge>;
}

export function AttributeGrid({ category, attributes, columns = 2 }: { category: ProductCategoryId; attributes: ProductAttributes; columns?: 1 | 2 }) {
  const relevant = CATEGORIES[category].relevantAttributes;
  return (
    <div className={clsx('grid gap-x-5 gap-y-2.5', columns === 2 ? 'sm:grid-cols-2' : '')}>
      {relevant.map((key) => (
        <ScoreBar key={key} label={ATTRIBUTE_LABELS[key]} value={attributes[key]} compact />
      ))}
    </div>
  );
}

export function SpecList({ specs }: { specs: ProductSpecSummary }) {
  return (
    <div className="divide-y divide-line/50">
      <KeyValue label="Leistungsaufnahme" value={`${formatNumber(specs.powerDraw, specs.powerDraw < 20 ? 1 : 0)} W`} />
      <KeyValue label="Wärme / Kühlleistung" value={specs.coolingCapacity > 0 ? `${formatNumber(specs.heat)} W / ${formatNumber(specs.coolingCapacity)} W` : `${formatNumber(specs.heat)} W (passiv)`} />
      <KeyValue
        label="Temperatur unter Last"
        value={<span className={specs.temperature >= 90 ? 'text-red-400' : specs.temperature >= 80 ? 'text-amber-300' : ''}>{formatNumber(specs.temperature)} °C</span>}
      />
      <KeyValue label="Lautstärke" value={specs.noiseDb > 0 ? `${formatNumber(specs.noiseDb)} dB` : 'lautlos'} />
      {specs.batteryHours !== null && <KeyValue label="Akkulaufzeit" value={`${formatNumber(specs.batteryHours, 1)} h`} />}
      {specs.throttling < 0.999 && <KeyValue label="Drosselung" value={<span className="text-amber-300">−{formatNumber((1 - specs.throttling) * 100)} % Leistung</span>} />}
      {specs.psuHeadroom !== null && <KeyValue label="Netzteil-Reserve" value={`${formatNumber((specs.psuHeadroom - 1) * 100)} %`} />}
      {specs.displayLabel && <KeyValue label="Display" value={specs.displayLabel} />}
      {specs.features.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2">
          {specs.features.map((f) => (
            <Badge key={f} tone="info">
              {FEATURE_LABELS[f]}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** Fortschrittsanzeige über alle Lebenszyklus-Phasen eines Produkts. */
export function LifecycleStepper({ product }: { product: Product }) {
  const steps = [...DEV_PHASES.map((p) => p.name), 'Verkaufsstart'];
  let current: number;
  if (product.status === 'draft') current = -1;
  else if (product.status === 'development') current = product.development?.phaseIndex ?? 0;
  else if (product.status === 'ready') current = DEV_PHASES.length;
  else current = DEV_PHASES.length + 1;
  return (
    <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const progress = active && product.development ? product.development.phaseProgress : 0;
        return (
          <li key={step} className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className={clsx('h-full rounded-full', done ? 'bg-emerald-400' : 'accent-bg')} style={{ width: done ? '100%' : active ? `${Math.max(4, progress * 100)}%` : '0%' }} />
            </div>
            <div className={clsx('text-[10px] leading-tight', done ? 'text-emerald-300' : active ? 'text-ink' : 'text-muted')}>{step}</div>
          </li>
        );
      })}
    </ol>
  );
}
