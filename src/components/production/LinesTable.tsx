import clsx from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { SHIPPING_MODES } from '@/data/channels';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { NumberInput, Select, Toggle } from '@/components/ui/Form';
import { addProductionLine, configureLine, facilitySupportsCategory, maxLines, removeProductionLine } from '@/systems/production/facilities';
import { useGameStore } from '@/store/gameStore';
import type { ShippingMode } from '@/types';
import { formatNumber } from '@/utils/format';

export function LinesTable({ facilityId }: { facilityId: string }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const lines = game.production.lines.filter((l) => l.facilityId === facilityId);
  const producible = game.products.filter((p) => (p.status === 'ready' || p.status === 'on_sale') && facilitySupportsCategory(game, facilityId, p) === null);
  const limit = maxLines(game, facilityId);

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const produced = line.producedLast30.reduce((a, b) => a + b, 0);
        return (
          <div key={line.id} className="rounded-lg border border-line/70 bg-surface/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted">Linie {index + 1}</span>
              <Select
                value={line.productId ?? ''}
                onChange={(e) => execute((d) => configureLine(d, line.id, { productId: e.target.value || null }), { silent: true })}
                className="w-auto min-w-[180px] flex-1 py-1.5"
                aria-label="Produkt"
              >
                <option value="">– kein Produkt –</option>
                {producible.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <div className="w-28" title="Zielmenge pro Tag (0 = maximale Auslastung)">
                <NumberInput
                  value={line.targetPerDay}
                  min={0}
                  step={1}
                  suffix="/Tag"
                  onChange={(v) => execute((d) => configureLine(d, line.id, { targetPerDay: Math.max(0, v) }), { silent: true })}
                  className="py-1.5"
                  aria-label="Zielmenge pro Tag"
                />
              </div>
              <Toggle checked={line.active} label={line.active ? 'aktiv' : 'pausiert'} onChange={(active) => execute((d) => configureLine(d, line.id, { active }))} disabled={!line.productId} />
              <Button size="xs" variant="ghost" aria-label="Linie entfernen" icon={<Trash2 size={13} />} onClick={() => execute((d) => removeProductionLine(d, line.id))} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <Toggle checked={line.autoReorder} label="Auto-Einkauf" onChange={(autoReorder) => execute((d) => configureLine(d, line.id, { autoReorder }), { silent: true })} />
              {line.autoReorder && (
                <>
                  <label className="inline-flex items-center gap-1.5 text-muted">
                    Reichweite
                    <input
                      type="number"
                      min={7}
                      max={120}
                      value={line.reorderDays}
                      onChange={(e) => execute((d) => configureLine(d, line.id, { reorderDays: Math.min(120, Math.max(7, Number(e.target.value) || 7)) }), { silent: true })}
                      className="w-14 rounded border border-line bg-surface px-1.5 py-0.5 text-ink"
                    />
                    Tage
                  </label>
                  <select
                    value={line.shippingMode}
                    onChange={(e) => execute((d) => configureLine(d, line.id, { shippingMode: e.target.value as ShippingMode }), { silent: true })}
                    className="rounded border border-line bg-surface px-1.5 py-0.5 text-ink"
                    aria-label="Lieferweg"
                  >
                    {(Object.keys(SHIPPING_MODES) as ShippingMode[]).map((m) => (
                      <option key={m} value={m}>
                        {SHIPPING_MODES[m].name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <span className="ml-auto text-muted">{formatNumber(produced)} Stk. in 30 Tagen</span>
              {line.active && (
                <Badge tone={line.status === 'stalled' ? 'warn' : 'good'} className={clsx(line.status === 'stalled' && 'whitespace-normal')}>
                  {line.status === 'stalled' ? (line.stallReason ?? 'gestoppt') : 'läuft'}
                </Badge>
              )}
              {!line.active && line.stallReason && <Badge tone="warn">{line.stallReason}</Badge>}
            </div>
          </div>
        );
      })}
      {lines.length < limit && (
        <Button size="xs" variant="ghost" icon={<Plus size={13} />} onClick={() => execute((d) => addProductionLine(d, facilityId))}>
          Linie hinzufügen ({lines.length}/{limit})
        </Button>
      )}
      {producible.length === 0 && <p className="text-xs text-muted">Noch kein fertig entwickeltes Produkt, das hier gefertigt werden kann.</p>}
    </div>
  );
}
