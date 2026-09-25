import { Plane, Ship, Truck, Warehouse as WarehouseIcon, X } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES } from '@/data/categories';
import { SHIPPING_MODES } from '@/data/channels';
import { OFFICES, OVERFLOW_FEE_PER_UNIT_DAY, WAREHOUSE_TYPES } from '@/data/facilities';
import { REGIONS } from '@/data/regions';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { Field, NumberInput, Segmented } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/Progress';
import { KeyValue, StatCard } from '@/components/ui/Stat';
import { formatDate } from '@/simulation/calendar';
import { getManufacturerName } from '@/services/brandLicense';
import {
  clearProductStock,
  closeWarehouse,
  componentResalePrice,
  inventoryValue,
  PRODUCT_CLEARANCE_FACTOR,
  rentWarehouse,
  sellComponents,
  storageCapacity,
  usedStorage,
} from '@/systems/inventory/inventory';
import { buildDistributionCenter, DISTRIBUTION_CENTER_COST, logisticsCostFactor, logisticsCoverage, logisticsRequirement, UNITS_PER_LOGISTICS_FTE } from '@/systems/logistics/logistics';
import { openRegions } from '@/systems/market/regions';
import { departmentHeadcount } from '@/systems/workforce/employees';
import { useGameStore } from '@/store/gameStore';
import type { ShippingMode } from '@/types';
import { formatMoney, formatMoneyCompact, formatNumber, formatPercent } from '@/utils/format';

type Tab = 'storage' | 'stock' | 'network';

const MODE_ICONS: Record<ShippingMode, typeof Truck> = { distributor: WarehouseIcon, truck: Truck, ship: Ship, air: Plane };

interface SellTarget {
  kind: 'component' | 'product';
  id: string;
  name: string;
  available: number;
  unitPrice: number;
  bookValue: number;
}

function SellModal({ target, onClose }: { target: SellTarget; onClose: () => void }) {
  const execute = useGameStore((s) => s.execute);
  const [qty, setQty] = useState(Math.floor(target.available));
  const proceeds = qty * target.unitPrice;
  const loss = qty * target.bookValue - proceeds;
  const submit = () => {
    const result = execute((d) => (target.kind === 'component' ? sellComponents(d, target.id, qty) : clearProductStock(d, target.id, qty)));
    if (result.ok) onClose();
  };
  return (
    <Modal
      open
      width="sm"
      title={`${target.name} verkaufen`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={submit} disabled={qty < 1 || qty > target.available}>
            Für {formatMoney(proceeds)} verkaufen
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">
        {target.kind === 'component'
          ? 'Ein Restpostenhändler kauft überschüssige Komponenten mit deutlichem Abschlag – schnell Liquidität, aber mit Buchverlust.'
          : `Großhändler nehmen Restposten für ${formatPercent(PRODUCT_CLEARANCE_FACTOR, 0)} des Verkaufspreises ab. Große Mengen schaden dem Premium-Image.`}
      </p>
      <Field label={`Menge (verfügbar: ${formatNumber(target.available)})`}>
        <NumberInput value={qty} min={1} max={Math.floor(target.available)} step={10} onChange={(v) => setQty(Math.max(0, Math.min(Math.floor(target.available), Math.floor(v))))} />
      </Field>
      <div className="mt-3 rounded-lg border border-line/60 bg-surface/40 px-3 py-2">
        <KeyValue label="Preis je Stück" value={formatMoney(target.unitPrice, 2)} />
        <KeyValue label="Erlös" value={formatMoney(proceeds)} />
        <KeyValue label="Buchwert" value={formatMoney(qty * target.bookValue)} />
        <KeyValue label={loss > 0 ? 'Buchverlust' : 'Buchgewinn'} value={<span className={loss > 0 ? 'text-red-300' : 'text-emerald-300'}>{formatMoney(Math.abs(loss))}</span>} />
      </div>
    </Modal>
  );
}

function StorageTab() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const capacity = storageCapacity(game);
  const used = usedStorage(game);
  const office = OFFICES[game.company.officeLevel];
  const overflow = Math.max(0, used - capacity);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Lagerkapazität" icon={<WarehouseIcon size={16} />} subtitle="Komponenten und Fertigwaren belegen Lagereinheiten. Überbestand wird teuer extern zwischengelagert.">
        <div className="mb-1 flex justify-between text-sm">
          <span>
            {formatNumber(used)} / {formatNumber(capacity)} Einheiten
          </span>
          <span className="tabular">{formatPercent(capacity > 0 ? used / capacity : 1, 0)}</span>
        </div>
        <ProgressBar value={used} max={Math.max(1, capacity)} tone={used > capacity ? 'bad' : used > capacity * 0.85 ? 'warn' : 'accent'} />
        {overflow > 0 && (
          <p className="mt-2 text-xs text-red-300">
            {formatNumber(overflow)} Einheiten Überbestand kosten {formatMoney(overflow * OVERFLOW_FEE_PER_UNIT_DAY)} pro Tag.
          </p>
        )}
        <div className="mt-4 divide-y divide-line/50 text-sm">
          <div className="flex items-center justify-between py-2">
            <span>
              {office.name} <span className="text-xs text-muted">(Firmensitz)</span>
            </span>
            <span className="tabular">{formatNumber(office.storage)}</span>
          </div>
          {game.warehouses.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0 truncate">
                {w.name}
                {w.status === 'building' && (
                  <Badge tone="info" className="ml-2">
                    bereit am {formatDate(w.readyDay)}
                  </Badge>
                )}
              </span>
              <span className="ml-auto text-xs text-muted tabular">{formatMoney(w.rentPerMonth * game.economy.priceLevel)}/Mon.</span>
              <span className="w-20 text-right tabular">{formatNumber(w.capacity)}</span>
              <Button size="xs" variant="ghost" icon={<X size={12} />} aria-label="Kündigen" title="Lager kündigen" onClick={() => execute((d) => closeWarehouse(d, w.id))} />
            </div>
          ))}
        </div>
      </Card>
      <Card title="Lager anmieten">
        <div className="space-y-2">
          {WAREHOUSE_TYPES.map((def) => {
            const locked = game.company.stage < def.minStage;
            const cost = def.setupCost * game.economy.priceLevel;
            return (
              <div key={def.kind} className="flex flex-wrap items-center gap-3 rounded-lg border border-line/60 bg-surface/40 px-3 py-2.5">
                <div className="min-w-[160px] flex-1">
                  <div className="text-sm font-medium">{def.name}</div>
                  <div className="text-xs text-muted">{def.description}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="tabular">{formatNumber(def.capacity)} Einheiten</div>
                  <div className="text-muted tabular">
                    {formatMoney(def.rentPerMonth * game.economy.priceLevel)}/Mon. · {def.buildDays} T.
                  </div>
                </div>
                <Button size="xs" variant="primary" disabled={locked || game.finance.cash < cost} title={locked ? `Ab Unternehmensstufe ${def.minStage}` : undefined} onClick={() => execute((d) => rentWarehouse(d, def.kind))}>
                  {locked ? `ab Stufe ${def.minStage}` : `Anmieten (${formatMoneyCompact(cost)})`}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function StockTab() {
  const game = useGameStore((s) => s.game!);
  const [sell, setSell] = useState<SellTarget | null>(null);
  const components = Object.entries(game.inventory.components)
    .filter(([, e]) => e.qty >= 1)
    .map(([id, entry]) => ({ sku: game.components.skus[id], entry }))
    .filter((r) => r.sku)
    .sort((a, b) => b.entry.qty * b.entry.avgCost - a.entry.qty * a.entry.avgCost);
  const products = game.products
    .map((p) => ({ product: p, entry: game.inventory.products[p.id] }))
    .filter((r) => r.entry && r.entry.qty >= 1);
  return (
    <div className="space-y-4">
      <Card title="Fertigwaren" bodyClassName="p-0">
        {products.length === 0 ? (
          <p className="p-4 text-sm text-muted">Keine Fertigwaren auf Lager.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-panel-2 text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Produkt</th>
                  <th className="px-3 py-2 text-right font-medium">Bestand</th>
                  <th className="px-3 py-2 text-right font-medium">Herstellkosten</th>
                  <th className="px-3 py-2 text-right font-medium">Lagerwert</th>
                  <th className="px-3 py-2 text-right font-medium">Reichweite</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {products.map(({ product, entry }) => {
                  const perDay = product.sales.unitsLast30 / 30;
                  return (
                    <tr key={product.id} className="border-t border-line/50">
                      <td className="px-4 py-2">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-muted">{CATEGORIES[product.category].name}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular">{formatNumber(entry!.qty)}</td>
                      <td className="px-3 py-2 text-right tabular">{formatMoney(entry!.avgCost, 2)}</td>
                      <td className="px-3 py-2 text-right tabular">{formatMoney(entry!.qty * entry!.avgCost)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular">{perDay > 0.05 ? `${formatNumber(entry!.qty / perDay)} Tage` : '–'}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setSell({ kind: 'product', id: product.id, name: product.name, available: entry!.qty, unitPrice: product.price * PRODUCT_CLEARANCE_FACTOR, bookValue: entry!.avgCost })}
                        >
                          Restposten
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Komponenten" bodyClassName="p-0">
        {components.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={<WarehouseIcon size={26} />} title="Keine Komponenten auf Lager" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-panel-2 text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Komponente</th>
                  <th className="px-3 py-2 text-right font-medium">Bestand</th>
                  <th className="px-3 py-2 text-right font-medium">Ø Einkauf</th>
                  <th className="px-3 py-2 text-right font-medium">Lagerwert</th>
                  <th className="px-3 py-2 text-right font-medium">Volumen</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {components.map(({ sku, entry }) => (
                  <tr key={sku.id} className="border-t border-line/50">
                    <td className="px-4 py-2 font-medium">
                      {getManufacturerName(sku.manufacturerId)} {sku.name}
                    </td>
                    <td className="px-3 py-2 text-right tabular">{formatNumber(entry.qty)}</td>
                    <td className="px-3 py-2 text-right tabular">{formatMoney(entry.avgCost, 2)}</td>
                    <td className="px-3 py-2 text-right tabular">{formatMoney(entry.qty * entry.avgCost)}</td>
                    <td className="px-3 py-2 text-right text-xs tabular">{formatNumber(entry.qty * sku.volume, 1)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setSell({ kind: 'component', id: sku.id, name: sku.name, available: entry.qty, unitPrice: componentResalePrice(game, sku), bookValue: entry.avgCost })}
                      >
                        Verkaufen
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {sell && <SellModal target={sell} onClose={() => setSell(null)} />}
    </div>
  );
}

function NetworkTab() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const regions = openRegions(game).filter((r) => r !== game.company.homeRegion);
  const cost = DISTRIBUTION_CENTER_COST * game.economy.priceLevel;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Transportwege" subtitle="Für Komponenten-Bestellungen. LKW fährt nur innerhalb eines Kontinents." bodyClassName="p-0">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Art</th>
              <th className="px-3 py-2 text-right font-medium">Regional</th>
              <th className="px-3 py-2 text-right font-medium">Interkontinental</th>
              <th className="px-3 py-2 text-right font-medium">Kosten/Einheit</th>
              <th className="px-3 py-2 text-right font-medium">Verzögerung</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(SHIPPING_MODES) as ShippingMode[]).map((mode) => {
              const def = SHIPPING_MODES[mode];
              const Icon = MODE_ICONS[mode];
              return (
                <tr key={mode} className="border-t border-line/50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 font-medium">
                      <Icon size={14} className="text-muted" /> {def.name}
                    </div>
                    <div className="text-[11px] text-muted">{def.description}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular">{def.domesticDays} T.</td>
                  <td className="px-3 py-2 text-right tabular">{def.intercontinentalDays !== null ? `${def.intercontinentalDays} T.` : '–'}</td>
                  <td className="px-3 py-2 text-right tabular">{formatMoney(def.costPerVolume * logisticsCostFactor(game), 2)}</td>
                  <td className="px-3 py-2 text-right tabular">{formatPercent(def.delayRisk, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title="Regionale Verteilzentren" subtitle="Senken die Exportkosten in eine Region um 40 %. Zölle bleiben bestehen.">
        {regions.length === 0 ? (
          <p className="text-sm text-muted">Noch keine Auslandsmärkte erschlossen. Die Expansion startet auf der Unternehmensseite (ab Stufe 3).</p>
        ) : (
          <div className="space-y-2">
            {regions.map((r) => {
              const built = game.company.distributionCenters.includes(r);
              return (
                <div key={r} className="flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-surface/40 px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{REGIONS[r].name}</div>
                    <div className="text-xs text-muted">Zoll {formatPercent(REGIONS[r].importTariff, 0)} · Frachtfaktor ×{formatNumber(REGIONS[r].shippingCostFactor, 1)}</div>
                  </div>
                  {built ? (
                    <Badge tone="good">in Betrieb</Badge>
                  ) : (
                    <Button size="xs" variant="primary" disabled={game.finance.cash < cost} onClick={() => execute((d) => buildDistributionCenter(d, r))}>
                      Bauen ({formatMoneyCompact(cost)})
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function LogisticsPage() {
  const game = useGameStore((s) => s.game!);
  const [tab, setTab] = useState<Tab>('storage');
  const capacity = storageCapacity(game);
  const used = usedStorage(game);
  const value = inventoryValue(game);
  const coverage = logisticsCoverage(game);
  const requirement = logisticsRequirement(game);
  const staff = departmentHeadcount(game, 'logistics');
  return (
    <div className="space-y-5">
      <PageHeader title="Logistik" description="Lager, Bestände, Transport und Verteilzentren." icon={<Truck size={20} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lagerauslastung" value={formatPercent(capacity > 0 ? used / capacity : 1, 0)} hint={`${formatNumber(used)} / ${formatNumber(capacity)} Einheiten`} tone={used > capacity ? 'bad' : used > capacity * 0.85 ? 'warn' : 'default'} />
        <StatCard label="Lagerwert" value={formatMoneyCompact(value.components + value.products)} hint={`Komponenten ${formatMoneyCompact(value.components)}`} />
        <StatCard label="Logistik-Abdeckung" value={formatPercent(Math.min(1, coverage), 0)} hint={`${staff} Personen · Bedarf ${formatNumber(requirement, 1)}`} tone={coverage < 0.8 ? 'warn' : 'default'} />
        <StatCard label="Transportkosten" value={`×${formatNumber(logisticsCostFactor(game), 2)}`} hint="Faktor auf alle Frachten" />
      </div>
      {coverage < 0.8 && (
        <Alert tone="warn" title="Logistik unterbesetzt">
          Jede Logistik-Vollzeitkraft wickelt etwa {formatNumber(UNITS_PER_LOGISTICS_FTE)} Verkäufe pro Monat ab. Ohne ausreichend Personal steigen alle Transportkosten um bis zu 20 %.
        </Alert>
      )}
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'storage', label: 'Lager' },
          { value: 'stock', label: 'Bestände' },
          { value: 'network', label: 'Transport & Verteilzentren' },
        ]}
      />
      {tab === 'storage' && <StorageTab />}
      {tab === 'stock' && <StockTab />}
      {tab === 'network' && <NetworkTab />}
    </div>
  );
}
