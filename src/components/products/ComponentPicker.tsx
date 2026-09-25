import clsx from 'clsx';
import { ChevronDown, Lock, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getTech } from '@/data/technologies';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { getManufacturerName } from '@/services/brandLicense';
import { skuPriceEur } from '@/systems/components/catalog';
import { componentStock } from '@/systems/inventory/inventory';
import { hasTech } from '@/systems/research/effects';
import { materialCostFactor } from '@/systems/supply/purchasing';
import { useGameStore } from '@/store/gameStore';
import type { CategorySlot, ComponentSku, GameState } from '@/types';
import { formatMoney, formatNumber } from '@/utils/format';
import { skuFilterKeys, skuSpecLabel } from '@/utils/skuFormat';

function compatibleSkus(game: GameState, slot: CategorySlot): ComponentSku[] {
  return Object.values(game.components.skus).filter((sku) => {
    if (sku.type !== slot.type || !slot.formFactors.includes(sku.formFactor)) return false;
    const market = game.components.market[sku.id];
    if (sku.inhouseProductId) return market?.status !== 'discontinued';
    return market !== undefined && market.status !== 'discontinued';
  });
}

function skuUnitPrice(game: GameState, sku: ComponentSku): number {
  return skuPriceEur(game, sku) * (sku.inhouseProductId ? 1 : materialCostFactor(game));
}

interface PickerProps {
  slot: CategorySlot;
  value: string | undefined;
  onChange: (skuId: string | undefined) => void;
}

export function ComponentPicker({ slot, value, onChange }: PickerProps) {
  const [open, setOpen] = useState(false);
  const game = useGameStore((s) => s.game!);
  const sku = value ? game.components.skus[value] : undefined;
  const market = sku ? game.components.market[sku.id] : undefined;
  const locked = sku?.requiredTech && !hasTech(game, sku.requiredTech);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          'flex w-full items-center gap-3 rounded-lg border bg-surface/60 px-3 py-2 text-left transition hover:border-slate-500',
          locked ? 'border-red-500/40' : 'border-line',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted">{slot.label}</div>
          {sku ? (
            <div className="truncate text-sm font-medium">
              {getManufacturerName(sku.manufacturerId)} {sku.name}
              <span className="ml-2 text-xs font-normal text-muted">{skuSpecLabel(sku)}</span>
            </div>
          ) : (
            <div className="text-sm text-muted">{slot.required ? 'Bitte wählen' : 'Keine (optional)'}</div>
          )}
        </div>
        {sku && market?.status === 'eol' && <Badge tone="warn">Auslauf</Badge>}
        {locked && <Lock size={14} className="text-red-400" />}
        {sku && <span className="text-sm font-semibold tabular">{formatMoney(skuUnitPrice(game, sku) * slot.quantity)}</span>}
        <ChevronDown size={15} className="text-muted" />
      </button>
      {open && <PickerModal slot={slot} value={value} onClose={() => setOpen(false)} onChange={(id) => { onChange(id); setOpen(false); }} />}
    </>
  );
}

function PickerModal({ slot, value, onClose, onChange }: PickerProps & { onClose: () => void }) {
  const game = useGameStore((s) => s.game!);
  const [search, setSearch] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<'price' | 'performance' | 'quality'>('price');
  const skus = useMemo(() => compatibleSkus(game, slot), [game, slot]);

  const filterOptions = useMemo(() => {
    const options: Record<string, Set<string>> = {};
    for (const sku of skus) for (const [key, val] of Object.entries(skuFilterKeys(sku))) (options[key] ??= new Set()).add(val);
    return Object.entries(options).filter(([, set]) => set.size > 1);
  }, [skus]);
  const manufacturers = useMemo(() => [...new Set(skus.map((s) => s.manufacturerId))], [skus]);

  const rows = skus
    .filter((sku) => {
      if (manufacturer && sku.manufacturerId !== manufacturer) return false;
      const keys = skuFilterKeys(sku);
      for (const [key, val] of Object.entries(filters)) if (val && keys[key] !== val) return false;
      if (search) {
        const text = `${getManufacturerName(sku.manufacturerId)} ${sku.name} ${skuSpecLabel(sku)}`.toLowerCase();
        if (!text.includes(search.toLowerCase())) return false;
      }
      return true;
    })
    .map((sku) => ({ sku, price: skuUnitPrice(game, sku) * slot.quantity, stock: componentStock(game, sku) }))
    .sort((a, b) => (sort === 'price' ? a.price - b.price : sort === 'performance' ? b.sku.performance - a.sku.performance : b.sku.quality - a.sku.quality));

  return (
    <Modal open width="xl" title={`${slot.label} wählen`} onClose={onClose} footer={!slot.required && <Button onClick={() => onChange(undefined)}>Ohne {slot.label}</Button>}>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen …" className="pl-8" />
        </div>
        <Select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="w-auto">
          <option value="">Alle Hersteller</option>
          {manufacturers.map((m) => (
            <option key={m} value={m}>
              {getManufacturerName(m)}
            </option>
          ))}
        </Select>
        {filterOptions.map(([key, set]) => (
          <Select key={key} value={filters[key] ?? ''} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} className="w-auto">
            <option value="">{key}: alle</option>
            {[...set].sort((a, b) => a.localeCompare(b, 'de', { numeric: true })).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        ))}
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="w-auto">
          <option value="price">Sortierung: Preis</option>
          <option value="performance">Sortierung: Leistung</option>
          <option value="quality">Sortierung: Qualität</option>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Modell</th>
              <th className="px-3 py-2 text-right font-medium">Leistung</th>
              <th className="px-3 py-2 text-right font-medium">Qualität</th>
              <th className="px-3 py-2 text-right font-medium">Zuverl.</th>
              <th className="px-3 py-2 text-right font-medium">Lager</th>
              <th className="px-3 py-2 text-right font-medium">Preis{slot.quantity > 1 ? ` (${slot.quantity}×)` : ''}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sku, price, stock }) => {
              const locked = sku.requiredTech && !hasTech(game, sku.requiredTech);
              const status = game.components.market[sku.id]?.status;
              return (
                <tr
                  key={sku.id}
                  onClick={() => onChange(sku.id)}
                  className={clsx('cursor-pointer border-t border-line/60 transition hover:bg-white/[0.04]', sku.id === value && 'bg-white/[0.06]')}
                >
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">
                        {getManufacturerName(sku.manufacturerId)} {sku.name}
                      </span>
                      {sku.inhouseProductId && <Badge tone="accent">Eigenentwicklung</Badge>}
                      {status === 'eol' && <Badge tone="warn">Auslaufmodell</Badge>}
                      {locked && (
                        <Badge tone="bad">
                          <Lock size={10} /> {getTech(sku.requiredTech!)?.name}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted">{skuSpecLabel(sku)}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular">{formatNumber(sku.performance)}</td>
                  <td className="px-3 py-2 text-right tabular">{formatNumber(sku.quality)}</td>
                  <td className="px-3 py-2 text-right tabular">{formatNumber(sku.reliability)}</td>
                  <td className="px-3 py-2 text-right tabular text-muted">{formatNumber(stock)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular">{formatMoney(price, price < 100 ? 2 : 0)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  Keine passenden Komponenten.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted">Leistung ist relativ zum Technologiestand bei Spielbeginn (Topmodell = 100). Preise inkl. aktueller Marktlage.</p>
    </Modal>
  );
}
