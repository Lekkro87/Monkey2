import { ArrowLeft, Copy, Factory, Pencil, Rocket, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES } from '@/data/categories';
import { SEGMENTS } from '@/data/segments';
import { StackedShareBar } from '@/components/charts/Charts';
import { SERIES } from '@/components/charts/theme';
import { CategoryIcon } from '@/components/icons';
import { BomPanel } from '@/components/products/BomPanel';
import { AttributeGrid, LifecycleStepper, SpecList, StatusBadge } from '@/components/products/ProductInfo';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { NumberInput, Segmented } from '@/components/ui/Form';
import { KeyValue, MiniStat } from '@/components/ui/Stat';
import { formatDate } from '@/simulation/calendar';
import { REVIEW_CATEGORY_LABELS } from '@/systems/market/reviews';
import {
  cancelDevelopment,
  createSuccessor,
  deleteProductDraft,
  discontinueProduct,
  launchProduct,
  setDevelopmentPriority,
  setProductPrice,
  startDevelopment,
} from '@/systems/products/commands';
import { currentAttributes } from '@/systems/products/design';
import { estimateRemainingDays } from '@/systems/products/development';
import { DEV_PHASES } from '@/systems/products/phases';
import { useGameStore } from '@/store/gameStore';
import type { Priority, ReviewCategory, SegmentId } from '@/types';
import { formatMoney, formatNumber, formatPercent } from '@/utils/format';

export default function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const product = game.products.find((p) => p.id === productId);
  const [price, setPrice] = useState<number | null>(null);

  if (!product) {
    return <EmptyState title="Produkt nicht gefunden" action={<Button onClick={() => navigate('/game/products')}>Zur Produktliste</Button>} />;
  }
  const category = CATEGORIES[product.category];
  const attributes = currentAttributes(game, product.category, product.attributes, product.attributesDay, product.launchDay);
  const stock = game.inventory.products[product.id];
  const unitCost = stock?.avgCost || product.estimatedUnitCost;
  const sales = product.sales;
  const priceValue = price ?? product.price;
  const lines = game.production.lines.filter((l) => l.productId === product.id);
  const remaining = estimateRemainingDays(game, product);
  const segmentTotal = Object.values(sales.segmentUnits).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => navigate('/game/products')} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Alle Produkte
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 accent-text">
            <CategoryIcon category={product.category} size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
              <StatusBadge status={product.status} />
              {product.version > 1 && <Badge>Version {product.version}</Badge>}
            </div>
            <p className="text-sm text-muted">
              {category.name} · Preis {formatMoney(product.price)} · Stückkosten {formatMoney(unitCost)}
              {product.launchDay !== undefined && ` · im Handel seit ${formatDate(product.launchDay)}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {product.status === 'draft' && (
            <>
              <Button icon={<Pencil size={14} />} onClick={() => navigate(`/game/products/${product.id}/edit`)}>
                Bearbeiten
              </Button>
              <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => execute((d) => deleteProductDraft(d, product.id)).ok && navigate('/game/products')}>
                Löschen
              </Button>
              <Button variant="primary" icon={<Rocket size={14} />} onClick={() => execute((d) => startDevelopment(d, product.id))}>
                Entwicklung starten
              </Button>
            </>
          )}
          {product.status === 'development' && (
            <Button variant="danger" icon={<XCircle size={14} />} onClick={() => execute((d) => cancelDevelopment(d, product.id))}>
              Entwicklung abbrechen
            </Button>
          )}
          {product.status === 'ready' && (
            <>
              <Button icon={<Factory size={14} />} onClick={() => navigate('/game/production')}>
                Produktion planen
              </Button>
              <Button variant="primary" icon={<Rocket size={14} />} onClick={() => execute((d) => launchProduct(d, product.id))}>
                Markteinführung
              </Button>
            </>
          )}
          {(product.status === 'on_sale' || product.status === 'discontinued') && (
            <Button
              icon={<Copy size={14} />}
              onClick={() => {
                let id = '';
                const result = execute((d) => {
                  id = createSuccessor(d, product.id);
                  return 'Nachfolger-Entwurf mit aktuellen Komponenten angelegt (45 % Entwicklungsaufwand).';
                });
                if (result.ok) navigate(`/game/products/${id}/edit`);
              }}
            >
              Nachfolger entwickeln
            </Button>
          )}
          {(product.status === 'on_sale' || product.status === 'ready') && (
            <Button variant="danger" onClick={() => execute((d) => discontinueProduct(d, product.id))}>
              Einstellen
            </Button>
          )}
        </div>
      </div>

      <Card>
        <LifecycleStepper product={product} />
        {product.status === 'development' && product.development && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              Phase <strong>{DEV_PHASES[product.development.phaseIndex].name}</strong> · {formatPercent(product.development.phaseProgress, 0)} ·{' '}
              {remaining !== null ? `noch ca. ${remaining} Tage` : 'keine Entwicklungskapazität'} · ausgegeben {formatMoney(product.development.spent)} von {formatMoney(product.development.totalBudget)}
            </div>
            <Segmented
              size="xs"
              value={product.development.priority}
              onChange={(p: Priority) => execute((d) => setDevelopmentPriority(d, product.id, p), { silent: true })}
              options={[
                { value: 'low', label: 'Niedrig' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'Hoch' },
              ]}
            />
          </div>
        )}
        {product.development?.blockedReason && (
          <div className="mt-3">
            <Alert tone="warn">{product.development.blockedReason}</Alert>
          </div>
        )}
        {product.status === 'ready' && (
          <div className="mt-3">
            <Alert tone="info" title="Bereit für die Markteinführung">
              Produziere zuerst einen Lagerbestand (Produktion → Linie zuweisen), dann starte den Verkauf. Testberichte erscheinen rund zwei Wochen nach dem Start.
            </Alert>
          </div>
        )}
        {product.quality.salesHaltUntil !== undefined && product.quality.salesHaltUntil > game.time.day && (
          <div className="mt-3">
            <Alert tone="bad">Verkaufsstopp wegen Rückruf bis {formatDate(product.quality.salesHaltUntil)}.</Alert>
          </div>
        )}
      </Card>

      {(product.status === 'on_sale' || product.status === 'ready') && (
        <Card title="Preis">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <NumberInput value={priceValue} min={1} step={10} suffix="€" onChange={setPrice} />
            </div>
            <Button variant="primary" disabled={priceValue === product.price} onClick={() => execute((d) => setProductPrice(d, product.id, priceValue)).ok && setPrice(null)}>
              Preis übernehmen
            </Button>
            <div className="text-sm text-muted">
              Marge bei neuem Preis: <strong className="text-ink">{formatPercent((priceValue - unitCost - category.fulfillmentCost) / priceValue)}</strong> · Referenzpreis Mainstream: {formatMoney(category.referencePrice * game.economy.priceLevel)}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Produktwerte" subtitle="Aktueller Stand – Technologie altert mit der Zeit">
          <AttributeGrid category={product.category} attributes={attributes} columns={1} />
        </Card>
        <Card title="Technische Daten">
          <SpecList specs={product.specs} />
          <div className="mt-3 divide-y divide-line/50 border-t border-line/50 pt-2">
            <KeyValue label="Entwicklungsqualität" value={`${formatNumber(product.devQuality)}/100`} />
            <KeyValue label="Ausfallrate (Design)" value={formatPercent(product.quality.defectRate, 1)} />
            <KeyValue label="Unentdeckte Defekte (Produktion)" value={formatPercent(product.quality.escapedRate, 2)} />
            <KeyValue label="Garantiefälle" value={formatNumber(product.quality.fieldDefects)} />
          </div>
        </Card>
        <Card title="Verkauf">
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Verkauft gesamt" value={formatNumber(sales.unitsSold)} />
            <MiniStat label="Umsatz gesamt" value={formatMoney(sales.revenue)} />
            <MiniStat label="Verkauf 30 Tage" value={formatNumber(sales.unitsLast30)} hint={`Nachfrage ${formatNumber(sales.demandToday, 1)}/Tag`} />
            <MiniStat label="Rohertrag gesamt" value={formatMoney(sales.grossProfit)} />
            <MiniStat label="Lagerbestand" value={formatNumber(stock?.qty ?? 0)} />
            <MiniStat label="Offene Bestellungen" value={formatNumber(sales.backorders)} hint={`${formatNumber(sales.cancellations)} storniert`} />
            <MiniStat label="Kundenbewertung" value={product.customerRating > 0 ? `${product.customerRating.toFixed(1).replace('.', ',')} / 5` : '–'} />
            <MiniStat label="Entgangene Verkäufe" value={formatNumber(sales.lostSales)} />
          </div>
          {segmentTotal > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs text-muted">Käufergruppen</div>
              <StackedShareBar
                segments={(Object.entries(sales.segmentUnits) as [SegmentId, number][]).map(([segment, value], i) => ({
                  key: segment,
                  label: SEGMENTS[segment].name,
                  value,
                  color: SERIES[i % SERIES.length],
                }))}
              />
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                {(Object.entries(sales.segmentUnits) as [SegmentId, number][]).map(([segment, value], i) => (
                  <span key={segment} className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
                    {SEGMENTS[segment].name} {formatPercent(value / segmentTotal, 0)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Testberichte">
          {product.review ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{product.review.overall.toLocaleString('de-DE', { minimumFractionDigits: 1 })}</span>
                <span className="text-muted">/ 10 · Gesamtwertung</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                {(Object.entries(product.review.categories) as [ReviewCategory, number][]).map(([key, value]) => (
                  <KeyValue key={key} label={REVIEW_CATEGORY_LABELS[key]} value={value.toLocaleString('de-DE', { minimumFractionDigits: 1 })} />
                ))}
              </div>
              <ul className="mt-3 space-y-1.5">
                {product.review.outlets.map((o) => (
                  <li key={o.outlet} className="rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="font-semibold">{o.outlet}</span> <span className="text-muted">({o.score.toLocaleString('de-DE', { minimumFractionDigits: 1 })}/10):</span> „{o.quote}“
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <div className="font-semibold text-emerald-300">Stärken</div>
                  {product.review.pros.length > 0 ? product.review.pros.map((p) => <div key={p}>+ {p}</div>) : <div className="text-muted">–</div>}
                </div>
                <div>
                  <div className="font-semibold text-red-300">Schwächen</div>
                  {product.review.cons.length > 0 ? product.review.cons.map((c) => <div key={c}>− {c}</div>) : <div className="text-muted">–</div>}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">{product.status === 'on_sale' ? 'Die ersten Tests erscheinen etwa 14 Tage nach Verkaufsstart.' : 'Tests erscheinen nach der Markteinführung.'}</p>
          )}
        </Card>
        <div className="space-y-5">
          {product.status !== 'draft' && <BomPanel product={product} />}
          <Card title="Produktion" subtitle={lines.length > 0 ? `${lines.length} Linie(n) fertigen dieses Produkt` : 'Keiner Linie zugewiesen'}>
            {lines.length === 0 ? (
              <p className="text-sm text-muted">
                Weise das Produkt in der <Link to="/game/production" className="accent-text hover:underline">Produktion</Link> einer Linie zu.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {lines.map((line) => (
                  <li key={line.id} className="flex items-center justify-between gap-2">
                    <span>{line.facilityId === 'workshop' ? 'Werkstatt' : (game.production.factories.find((f) => f.id === line.facilityId)?.name ?? line.facilityId)}</span>
                    <span className="text-xs text-muted">
                      {line.active ? (line.status === 'stalled' ? <span className="text-amber-300">{line.stallReason}</span> : `${formatNumber(line.producedLast30.reduce((a, b) => a + b, 0))} Stk./30 T.`) : 'pausiert'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
