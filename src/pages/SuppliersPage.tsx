import clsx from 'clsx';
import { Boxes, FileSignature, PackageCheck, Search, ShoppingCart, Truck } from 'lucide-react';
import { useState } from 'react';
import { COMPONENT_TYPE_LABELS } from '@/data/componentCatalog';
import { SHIPPING_MODES } from '@/data/channels';
import { getManufacturer, MANUFACTURERS } from '@/data/manufacturers';
import { REGIONS } from '@/data/regions';
import { getTech } from '@/data/technologies';
import { Sparkline } from '@/components/charts/Charts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, NumberInput, Segmented, Select, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { KeyValue, StatCard } from '@/components/ui/Stat';
import { formatDate } from '@/simulation/calendar';
import { getBrandLicense, getManufacturerName } from '@/services/brandLicense';
import { isPurchasable, skuTrend } from '@/systems/components/catalog';
import { playerAllocation } from '@/systems/components/market';
import { componentStock } from '@/systems/inventory/inventory';
import { hasTech } from '@/systems/research/effects';
import { activeContractFor, orderComponents, quantityInTransit, quoteContract, quotePurchase, shippingOptions, signContract } from '@/systems/supply/purchasing';
import { useGameStore } from '@/store/gameStore';
import type { ComponentSku, ComponentType, GameState, ShippingMode } from '@/types';
import { formatMoney, formatNumber, formatPercent, formatSignedPercent } from '@/utils/format';
import { skuSpecLabel, TIER_ORDER } from '@/utils/skuFormat';

type Tab = 'market' | 'orders' | 'contracts' | 'manufacturers';

const PAGE_SIZE = 50;

const STATUS_LABEL = { active: 'Aktuell', eol: 'Auslauf', discontinued: 'Eingestellt' } as const;

/** Komponenten, die der Spieler aktuell einkaufen kann (ohne Eigenentwicklungen). */
function marketSkus(game: GameState): ComponentSku[] {
  return Object.values(game.components.skus).filter((sku) => !sku.inhouseProductId && isPurchasable(game, sku));
}

/** Komponenten, die in Produkten des Spielers verbaut sind. */
function usedSkuIds(game: GameState): Set<string> {
  const ids = new Set<string>();
  for (const product of game.products) {
    if (product.status === 'discontinued') continue;
    for (const skuId of Object.values(product.components)) if (skuId) ids.add(skuId);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Bestellung
// ---------------------------------------------------------------------------

function OrderModal({ sku, onClose }: { sku: ComponentSku; onClose: () => void }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const options = shippingOptions(game, sku);
  const [mode, setMode] = useState<ShippingMode>(options.find((o) => o.mode === 'distributor')?.available ? 'distributor' : 'ship');
  const [quantity, setQuantity] = useState(100);
  const max = SHIPPING_MODES[mode].maxQuantity;
  const quote = quotePurchase(game, sku, Math.max(1, quantity), mode);
  const tooMany = max !== null && quantity > max;
  const locked = sku.requiredTech && !hasTech(game, sku.requiredTech);

  const submit = () => {
    const result = execute((d) => orderComponents(d, sku.id, quantity, mode));
    if (result.ok) onClose();
  };

  return (
    <Modal
      open
      title={`${getManufacturerName(sku.manufacturerId)} ${sku.name} bestellen`}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-sm">
            Gesamt: <strong className="tabular">{formatMoney(quote.total)}</strong> · Lieferung in {quote.leadTimeDays} Tagen
          </span>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={submit} disabled={quantity < 1 || tooMany || quote.total > game.finance.cash}>
            Bestellen
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-muted">{skuSpecLabel(sku)}</p>
      {locked && (
        <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          Hinweis: Zum Verbauen muss „{getTech(sku.requiredTech!)?.name ?? sku.requiredTech}“ erforscht sein.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Menge" hint={max !== null ? `max. ${formatNumber(max)} Stück pro Großhandelsbestellung` : `Zuteilung ohne Aufschlag: ${formatNumber(quote.allocation)} Stück/Monat`}>
          <NumberInput value={quantity} min={1} step={50} onChange={(v) => setQuantity(Math.max(0, Math.floor(v)))} />
        </Field>
        <Field label="Lieferweg">
          <Select value={mode} onChange={(e) => setMode(e.target.value as ShippingMode)}>
            {options.map((o) => (
              <option key={o.mode} value={o.mode} disabled={!o.available}>
                {SHIPPING_MODES[o.mode].name} {o.available ? `(${o.days} T. Transport)` : '– nicht verfügbar'}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[50, 100, 500, 1_000, 5_000, 25_000].map((v) => (
          <Button key={v} size="xs" variant={quantity === v ? 'primary' : 'secondary'} onClick={() => setQuantity(v)}>
            {formatNumber(v)}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{SHIPPING_MODES[mode].description}</p>
      <div className="mt-3 rounded-lg border border-line/60 bg-surface/40 px-3 py-2">
        <KeyValue label="Listenpreis" value={formatMoney(quote.listPrice, 2)} />
        {quote.discount > 0 && <KeyValue label="Mengenrabatt" value={`−${formatPercent(quote.discount)}`} />}
        {quote.contract && <KeyValue label="Vertragspreis" value="aktiv" />}
        {SHIPPING_MODES[mode].pricePremium > 0 && <KeyValue label="Großhandelsaufschlag" value={`+${formatPercent(SHIPPING_MODES[mode].pricePremium, 0)}`} />}
        {quote.surcharge > 0 && <KeyValue label={<span className="text-amber-300">Aufschlag über Zuteilung</span>} value={`+${formatPercent(quote.surcharge)}`} />}
        <KeyValue label="Stückpreis" value={formatMoney(quote.unitPrice, 2)} />
        <KeyValue label="Fracht" value={formatMoney(quote.shipping)} />
        <KeyValue label="Lieferzeit" value={`${quote.leadTimeDays} Tage`} />
        <KeyValue label="Lager / unterwegs" value={`${formatNumber(componentStock(game, sku))} / ${formatNumber(quantityInTransit(game, sku.id))}`} />
      </div>
      {quote.exceedsAllocation && <p className="mt-2 text-xs text-amber-300">Die Bestellung übersteigt die monatliche Zuteilung des Herstellers – Aufpreis und längere Lieferzeit. Ein Liefervertrag sichert größere Mengen.</p>}
      {tooMany && <p className="mt-2 text-sm text-red-400">Der Großhandel liefert höchstens {formatNumber(max ?? 0)} Stück pro Bestellung.</p>}
      {quote.total > game.finance.cash && <p className="mt-2 text-sm text-red-400">Nicht genügend Kapital.</p>}
    </Modal>
  );
}

function ContractModal({ sku, onClose }: { sku: ComponentSku; onClose: () => void }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const options = shippingOptions(game, sku).filter((o) => o.available && o.mode !== 'distributor');
  const [mode, setMode] = useState<ShippingMode>(options[0]?.mode ?? 'ship');
  const [monthly, setMonthly] = useState(500);
  const [months, setMonths] = useState(12);
  const quote = quoteContract(game, sku, Math.max(50, monthly), months);
  const deposit = quote.monthlyValue * 0.1;
  const submit = () => {
    const result = execute((d) => signContract(d, sku.id, monthly, months, mode));
    if (result.ok) onClose();
  };
  return (
    <Modal
      open
      title={`Liefervertrag: ${getManufacturerName(sku.manufacturerId)} ${sku.name}`}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-sm">
            Anzahlung: <strong className="tabular">{formatMoney(deposit)}</strong>
          </span>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={submit} disabled={monthly < 50 || deposit > game.finance.cash}>
            Vertrag unterzeichnen
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">
        Ein Vertrag garantiert einen festen Preis und zusätzliche Zuteilung. Die Mindestabnahme wird monatlich automatisch bestellt (Take-or-Pay) – kann sie nicht bezahlt werden, fällt eine Vertragsstrafe an.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Mindestabnahme / Monat">
          <NumberInput value={monthly} min={50} step={50} onChange={(v) => setMonthly(Math.max(0, Math.floor(v)))} />
        </Field>
        <Field label="Laufzeit">
          <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[3, 6, 12, 24].map((m) => (
              <option key={m} value={m}>
                {m} Monate
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lieferweg">
          <Select value={mode} onChange={(e) => setMode(e.target.value as ShippingMode)}>
            {options.map((o) => (
              <option key={o.mode} value={o.mode}>
                {SHIPPING_MODES[o.mode].name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-3 rounded-lg border border-line/60 bg-surface/40 px-3 py-2">
        <KeyValue label="Vertragspreis je Stück" value={formatMoney(quote.unitPrice, 2)} />
        <KeyValue label="Rabatt auf Listenpreis" value={formatPercent(quote.discount)} />
        <KeyValue label="Monatliches Volumen" value={formatMoney(quote.monthlyValue)} />
        <KeyValue label="Gesamtverpflichtung" value={formatMoney(quote.totalCommitment)} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function MarketTab() {
  const game = useGameStore((s) => s.game!);
  const [type, setType] = useState<ComponentType | 'all' | 'used'>('used');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [orderSku, setOrderSku] = useState<ComponentSku | null>(null);
  const [contractSku, setContractSku] = useState<ComponentSku | null>(null);
  const all = marketSkus(game);
  const used = usedSkuIds(game);
  const types = [...new Set(all.map((s) => s.type))].sort((a, b) => COMPONENT_TYPE_LABELS[a].localeCompare(COMPONENT_TYPE_LABELS[b]));

  const q = query.trim().toLowerCase();
  const filtered = all
    .filter((sku) => (type === 'all' ? true : type === 'used' ? used.has(sku.id) : sku.type === type))
    .filter((sku) => !q || `${getManufacturerName(sku.manufacturerId)} ${sku.name}`.toLowerCase().includes(q))
    .sort((a, b) => a.type.localeCompare(b.type) || TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.generation - a.generation || a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <Card
      title="Komponentenmarkt"
      subtitle="Preise schwanken mit Wechselkursen, Rohstoff- und Chipmarkt sowie Knappheit. Neue Generationen verdrängen ältere Modelle."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <TextInput value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Suchen" className="w-40 py-1.5 pl-7 text-xs" aria-label="Komponente suchen" />
          </div>
          <Select value={type} onChange={(e) => { setType(e.target.value as ComponentType | 'all' | 'used'); setPage(0); }} className="w-auto py-1.5 text-xs" aria-label="Typ filtern">
            <option value="used">In meinen Produkten ({used.size})</option>
            <option value="all">Alle Komponenten</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {COMPONENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
      }
      bodyClassName="p-0"
    >
      {filtered.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<Boxes size={26} />} title={type === 'used' ? 'Noch keine Komponenten in Produkten' : 'Keine Komponenten gefunden'} description={type === 'used' ? 'Sobald du ein Produkt entwirfst, erscheinen dessen Komponenten hier. Wähle „Alle Komponenten“, um den ganzen Markt zu sehen.' : undefined} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Komponente</th>
                <th className="px-3 py-2 text-left font-medium">Typ</th>
                <th className="px-3 py-2 text-right font-medium">Preis</th>
                <th className="px-3 py-2 text-right font-medium">30 Tage</th>
                <th className="px-3 py-2 text-left font-medium">Verlauf</th>
                <th className="px-3 py-2 text-right font-medium">Verfügbarkeit</th>
                <th className="px-3 py-2 text-right font-medium">Lager</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((sku) => {
                const market = game.components.market[sku.id];
                const quote = quotePurchase(game, sku, 1, 'truck');
                const trend = skuTrend(game, sku);
                const allocation = playerAllocation(game, sku);
                const contract = activeContractFor(game, sku.id);
                const scarcity = market?.scarcity ?? 1;
                return (
                  <tr key={sku.id} className="border-t border-line/50">
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-1.5 font-medium">
                        {getManufacturerName(sku.manufacturerId)} {sku.name}
                        {market && market.status !== 'active' && <Badge tone={market.status === 'eol' ? 'warn' : 'bad'}>{STATUS_LABEL[market.status]}{market.eolDay ? ` bis ${formatDate(market.eolDay)}` : ''}</Badge>}
                        {sku.requiredTech && !hasTech(game, sku.requiredTech) && <Badge tone="neutral" title={`Benötigt Forschung: ${getTech(sku.requiredTech)?.name}`}>Forschung nötig</Badge>}
                        {contract && <Badge tone="good">Vertrag</Badge>}
                        {used.has(sku.id) && <Badge tone="accent">verbaut</Badge>}
                      </div>
                      <div className="text-xs text-muted">{skuSpecLabel(sku)}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {COMPONENT_TYPE_LABELS[sku.type]} · Gen. {sku.generation}
                    </td>
                    <td className="px-3 py-2 text-right tabular">{formatMoney(quote.listPrice, quote.listPrice < 100 ? 2 : 0)}</td>
                    <td className={clsx('px-3 py-2 text-right text-xs tabular', trend > 0.005 ? 'text-red-400' : trend < -0.005 ? 'text-emerald-400' : 'text-muted')}>{formatSignedPercent(trend)}</td>
                    <td className="px-3 py-2">
                      <Sparkline values={market?.history ?? []} width={72} height={22} />
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      <div className={clsx('tabular', scarcity > 1.15 ? 'text-amber-300' : 'text-muted')}>{scarcity > 1.15 ? 'knapp' : scarcity < 0.92 ? 'reichlich' : 'normal'}</div>
                      <div className="text-muted tabular">{formatNumber(allocation)}/Monat</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular">
                      {formatNumber(componentStock(game, sku))}
                      {quantityInTransit(game, sku.id) > 0 && <div className="text-[11px] text-muted">+{formatNumber(quantityInTransit(game, sku.id))} unterwegs</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="xs" icon={<ShoppingCart size={13} />} onClick={() => setOrderSku(sku)}>
                          Bestellen
                        </Button>
                        {market?.status === 'active' && !contract && (
                          <Button size="xs" variant="ghost" icon={<FileSignature size={13} />} onClick={() => setContractSku(sku)} aria-label="Liefervertrag" title="Liefervertrag" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line/60 px-4 py-2 text-xs text-muted">
          <span>
            {current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)} von {formatNumber(filtered.length)}
          </span>
          <div className="flex gap-1">
            <Button size="xs" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Zurück
            </Button>
            <Button size="xs" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Weiter
            </Button>
          </div>
        </div>
      )}
      {orderSku && <OrderModal sku={orderSku} onClose={() => setOrderSku(null)} />}
      {contractSku && <ContractModal sku={contractSku} onClose={() => setContractSku(null)} />}
    </Card>
  );
}

function OrdersTab() {
  const game = useGameStore((s) => s.game!);
  const orders = [...game.supply.orders].sort((a, b) => (a.status === b.status ? b.orderDay - a.orderDay : a.status === 'in_transit' ? -1 : 1));
  return (
    <Card title="Bestellungen" subtitle="Laufende Lieferungen und die letzten Wareneingänge." bodyClassName="p-0">
      {orders.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<Truck size={26} />} title="Keine Bestellungen" description="Bestelle Komponenten im Komponentenmarkt oder direkt über die Stückliste eines Produkts." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Komponente</th>
                <th className="px-3 py-2 text-right font-medium">Menge</th>
                <th className="px-3 py-2 text-right font-medium">Stückpreis</th>
                <th className="px-3 py-2 text-left font-medium">Lieferweg</th>
                <th className="px-3 py-2 text-left font-medium">Bestellt</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const sku = game.components.skus[order.skuId];
                const daysLeft = order.deliveryDay - game.time.day;
                return (
                  <tr key={order.id} className="border-t border-line/50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{sku ? `${getManufacturerName(sku.manufacturerId)} ${sku.name}` : order.skuId}</div>
                      <div className="text-xs text-muted">{order.auto ? (order.contractId ? 'Vertrags-Mindestabnahme' : 'Automatischer Nachschub') : 'Manuelle Bestellung'}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular">{formatNumber(order.quantity)}</td>
                    <td className="px-3 py-2 text-right tabular">{formatMoney(order.unitPriceEur, 2)}</td>
                    <td className="px-3 py-2 text-xs">{SHIPPING_MODES[order.mode].name}</td>
                    <td className="px-3 py-2 text-xs text-muted">{formatDate(order.orderDay)}</td>
                    <td className="px-3 py-2">
                      {order.status === 'in_transit' ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={order.delayed ? 'warn' : 'info'}>{order.delayed ? 'verspätet' : 'unterwegs'}</Badge>
                          <span className="text-xs text-muted">
                            {daysLeft > 0 ? `noch ${daysLeft} T.` : 'heute'}
                            {order.delayed && order.delayReason ? ` · ${order.delayReason}` : ''}
                          </span>
                        </div>
                      ) : (
                        <Badge tone="good">
                          <PackageCheck size={11} /> geliefert {formatDate(order.deliveryDay)}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ContractsTab() {
  const game = useGameStore((s) => s.game!);
  const contracts = game.supply.contracts;
  return (
    <Card title="Lieferverträge" subtitle="Feste Preise und garantierte Mengen – ideal gegen Knappheit und Preissprünge." bodyClassName="p-0">
      {contracts.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<FileSignature size={26} />} title="Keine Verträge" description="Schließe im Komponentenmarkt über das Vertragssymbol einen Liefervertrag ab." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Komponente</th>
                <th className="px-3 py-2 text-right font-medium">Preis</th>
                <th className="px-3 py-2 text-right font-medium">Mindestabnahme</th>
                <th className="px-3 py-2 text-right font-medium">Diesen Monat</th>
                <th className="px-3 py-2 text-left font-medium">Laufzeit</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => {
                const sku = game.components.skus[contract.skuId];
                return (
                  <tr key={contract.id} className="border-t border-line/50">
                    <td className="px-4 py-2 font-medium">{sku ? `${getManufacturerName(sku.manufacturerId)} ${sku.name}` : contract.skuId}</td>
                    <td className="px-3 py-2 text-right tabular">{formatMoney(contract.unitPriceEur, 2)}</td>
                    <td className="px-3 py-2 text-right tabular">{formatNumber(contract.monthlyMinimum)}/Monat</td>
                    <td className="px-3 py-2 text-right tabular">{formatNumber(contract.orderedThisMonth)}</td>
                    <td className="px-3 py-2 text-xs">
                      {contract.status === 'active' ? (
                        <span>
                          bis {formatDate(contract.endDay)} <span className="text-muted">({SHIPPING_MODES[contract.mode].name})</span>
                        </span>
                      ) : (
                        <Badge tone="neutral">abgelaufen</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ManufacturersTab() {
  const game = useGameStore((s) => s.game!);
  const license = getBrandLicense();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {license
          ? `Markenlizenz aktiv (Lizenznehmer: ${license.licensee}). Lizenzierte Anzeigenamen werden verwendet.`
          : 'Alle Hersteller sind fiktiv. Reale Marken können nur über eine gültige Markenlizenz (Einstellungen) eingebunden werden – ohne Lizenz werden keine realen Marken als Partner dargestellt.'}
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MANUFACTURERS.map((m) => {
          const skus = Object.values(game.components.skus).filter((s) => s.manufacturerId === m.id && isPurchasable(game, s));
          const manufacturer = getManufacturer(m.id)!;
          return (
            <Card key={m.id} title={getManufacturerName(m.id)} subtitle={`${manufacturer.country} · ${REGIONS[manufacturer.region]?.name ?? manufacturer.region}`}>
              <p className="text-sm text-muted">{manufacturer.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {manufacturer.types.map((t) => (
                  <Badge key={t}>{COMPONENT_TYPE_LABELS[t]}</Badge>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-muted">Ruf</div>
                  <div className="font-semibold tabular">{manufacturer.reputation}</div>
                </div>
                <div>
                  <div className="text-muted">Zuteilung</div>
                  <div className="font-semibold tabular">{formatPercent(manufacturer.allocationShare)}</div>
                </div>
                <div>
                  <div className="text-muted">Modelle</div>
                  <div className="font-semibold tabular">{skus.length}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const game = useGameStore((s) => s.game!);
  const [tab, setTab] = useState<Tab>('market');
  const inTransit = game.supply.orders.filter((o) => o.status === 'in_transit');
  const transitValue = inTransit.reduce((a, o) => a + o.quantity * o.unitPriceEur, 0);
  const delayed = inTransit.filter((o) => o.delayed).length;
  const contracts = game.supply.contracts.filter((c) => c.status === 'active').length;
  const chipTrend = game.economy.chipIndex;

  return (
    <div className="space-y-5">
      <PageHeader title="Lieferanten" description="Komponenten einkaufen, Lieferverträge abschließen, Lieferungen verfolgen." icon={<Boxes size={20} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lieferungen unterwegs" value={formatNumber(inTransit.length)} hint={formatMoney(transitValue)} />
        <StatCard label="Verspätet" value={formatNumber(delayed)} tone={delayed > 0 ? 'warn' : 'default'} />
        <StatCard label="Aktive Verträge" value={formatNumber(contracts)} />
        <StatCard label="Chipmarkt-Index" value={formatNumber(chipTrend * 100)} hint={chipTrend > 1.05 ? 'angespannt' : chipTrend < 0.95 ? 'entspannt' : 'normal'} tone={chipTrend > 1.15 ? 'warn' : 'default'} />
      </div>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'market', label: 'Komponentenmarkt' },
          { value: 'orders', label: `Bestellungen (${inTransit.length})` },
          { value: 'contracts', label: `Verträge (${contracts})` },
          { value: 'manufacturers', label: 'Hersteller' },
        ]}
      />
      {tab === 'market' && <MarketTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'contracts' && <ContractsTab />}
      {tab === 'manufacturers' && <ManufacturersTab />}
    </div>
  );
}
