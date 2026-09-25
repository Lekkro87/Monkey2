import { ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { SHIPPING_MODES } from '@/data/channels';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, NumberInput, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { KeyValue } from '@/components/ui/Stat';
import { getManufacturerName } from '@/services/brandLicense';
import { componentStock } from '@/systems/inventory/inventory';
import { billOfMaterials, buildableUnits } from '@/systems/production/production';
import { placeOrder, quantityInTransit, quotePurchase, shippingOptions } from '@/systems/supply/purchasing';
import { useGameStore } from '@/store/gameStore';
import type { Product, ShippingMode } from '@/types';
import { formatMoney, formatNumber } from '@/utils/format';
import { skuSpecLabel } from '@/utils/skuFormat';

export function BomPanel({ product }: { product: Product }) {
  const game = useGameStore((s) => s.game!);
  const [open, setOpen] = useState(false);
  const bom = billOfMaterials(game, product);
  const buildable = buildableUnits(game, product);
  return (
    <Card
      title="Stückliste & Bestand"
      subtitle={`Mit dem Lagerbestand lassen sich ${formatNumber(buildable)} Einheiten bauen.`}
      actions={
        <Button size="xs" icon={<ShoppingCart size={13} />} onClick={() => setOpen(true)}>
          Komponenten bestellen
        </Button>
      }
    >
      <table className="w-full text-xs">
        <thead className="text-muted">
          <tr>
            <th className="pb-1.5 text-left font-medium">Komponente</th>
            <th className="pb-1.5 text-right font-medium">Menge</th>
            <th className="pb-1.5 text-right font-medium">Lager</th>
            <th className="pb-1.5 text-right font-medium">Unterwegs</th>
          </tr>
        </thead>
        <tbody>
          {bom.map((item) => {
            const status = game.components.market[item.sku.id]?.status;
            return (
              <tr key={item.sku.id} className="border-t border-line/40">
                <td className="py-1.5">
                  <div className="font-medium">
                    {getManufacturerName(item.sku.manufacturerId)} {item.sku.name} {status === 'eol' && <Badge tone="warn">Auslauf</Badge>}
                    {status === 'discontinued' && <Badge tone="bad">nicht lieferbar</Badge>}
                  </div>
                  <div className="text-muted">{skuSpecLabel(item.sku)}</div>
                </td>
                <td className="py-1.5 text-right tabular">{item.quantity}</td>
                <td className="py-1.5 text-right tabular">{formatNumber(componentStock(game, item.sku))}</td>
                <td className="py-1.5 text-right tabular text-muted">{formatNumber(quantityInTransit(game, item.sku.id))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {open && <KitOrderModal product={product} onClose={() => setOpen(false)} />}
    </Card>
  );
}

/** Bestellt alle Komponenten für eine gewünschte Stückzahl in einem Schritt. */
function KitOrderModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const [units, setUnits] = useState(50);
  const [mode, setMode] = useState<ShippingMode>('distributor');
  const [onlyMissing, setOnlyMissing] = useState(true);
  const bom = billOfMaterials(game, product).filter((item) => !item.sku.inhouseProductId);

  const lines = bom.map((item) => {
    const available = onlyMissing ? componentStock(game, item.sku) + quantityInTransit(game, item.sku.id) : 0;
    const quantity = Math.max(0, Math.ceil(units * item.quantity - available));
    const usable = shippingOptions(game, item.sku).find((o) => o.mode === mode)?.available ? mode : 'ship';
    const limit = SHIPPING_MODES[usable].maxQuantity;
    const qty = limit !== null ? Math.min(limit, quantity) : quantity;
    const quote = qty > 0 ? quotePurchase(game, item.sku, qty, usable) : null;
    return { item, qty, quote, usable, capped: limit !== null && quantity > limit };
  });
  const total = lines.reduce((a, l) => a + (l.quote?.total ?? 0), 0);
  const maxLead = lines.reduce((a, l) => Math.max(a, l.quote?.leadTimeDays ?? 0), 0);

  const submit = () => {
    const result = execute((d) => {
      let count = 0;
      for (const line of lines) {
        if (line.qty <= 0) continue;
        placeOrder(d, line.item.sku.id, line.qty, line.usable);
        count++;
      }
      return count > 0 ? `${count} Bestellungen aufgegeben – Lieferung in bis zu ${maxLead} Tagen.` : 'Alle Komponenten sind bereits vorrätig.';
    });
    if (result.ok) onClose();
  };

  return (
    <Modal
      open
      width="lg"
      title={`Komponenten für ${product.name} bestellen`}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-sm">
            Summe: <strong className="tabular">{formatMoney(total)}</strong> · Lieferung in bis zu {maxLead} Tagen
          </span>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={submit} disabled={total <= 0 || total > game.finance.cash}>
            Bestellen
          </Button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Stückzahl (Geräte)">
          <NumberInput value={units} min={1} step={10} onChange={(v) => setUnits(Math.max(1, Math.floor(v)))} />
        </Field>
        <Field label="Lieferweg">
          <Select value={mode} onChange={(e) => setMode(e.target.value as ShippingMode)}>
            {(Object.keys(SHIPPING_MODES) as ShippingMode[]).map((m) => (
              <option key={m} value={m}>
                {SHIPPING_MODES[m].name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bestand berücksichtigen">
          <Select value={onlyMissing ? 'yes' : 'no'} onChange={(e) => setOnlyMissing(e.target.value === 'yes')}>
            <option value="yes">Nur fehlende Menge</option>
            <option value="no">Volle Menge bestellen</option>
          </Select>
        </Field>
      </div>
      <p className="mb-3 text-xs text-muted">{SHIPPING_MODES[mode].description} LKW ist nur innerhalb des eigenen Kontinents möglich – sonst wird automatisch per Schiff geliefert.</p>
      <div className="divide-y divide-line/50 text-sm">
        {lines.map((line) => (
          <KeyValue
            key={line.item.sku.id}
            label={
              <span>
                {formatNumber(line.qty)} × {getManufacturerName(line.item.sku.manufacturerId)} {line.item.sku.name}
                {line.capped && <Badge tone="warn" className="ml-1">max. 1.000 im Großhandel</Badge>}
              </span>
            }
            value={line.quote ? `${formatMoney(line.quote.total)} · ${line.quote.leadTimeDays} T.` : 'vorrätig'}
          />
        ))}
      </div>
      {total > game.finance.cash && <p className="mt-3 text-sm text-red-400">Nicht genügend Kapital.</p>}
    </Modal>
  );
}
