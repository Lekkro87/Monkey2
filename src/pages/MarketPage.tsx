import clsx from 'clsx';
import { ChartPie, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, CATEGORY_IDS } from '@/data/categories';
import { SEGMENT_IDS, SEGMENTS } from '@/data/segments';
import { ChartPanel, StackedShareBar, TimeSeriesChart } from '@/components/charts/Charts';
import { CHART, OWNER_COLORS } from '@/components/charts/theme';
import { CategoryIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Card, PageHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Form';
import { KeyValue, StatCard } from '@/components/ui/Stat';
import { formatMonth, formatMonthLong } from '@/simulation/calendar';
import { OTHER_OWNER, PLAYER_OWNER } from '@/systems/market/demand';
import { isCategoryUnlocked } from '@/systems/research/effects';
import { useGameStore } from '@/store/gameStore';
import type { CurrencyCode, ProductCategoryId } from '@/types';
import { formatCompact, formatMoney, formatNumber, formatPercent, formatSignedPercent } from '@/utils/format';

const CURRENCIES: CurrencyCode[] = ['USD', 'GBP', 'JPY', 'CNY'];

function ownerColor(owner: string): string {
  return OWNER_COLORS[owner] ?? CHART.otherGray;
}

function EconomyCard() {
  const game = useGameStore((s) => s.game!);
  const eco = game.economy;
  const history = eco.history.slice(-36);
  const data = history.map((h) => ({ label: formatMonth(h.month), month: h.month, chip: h.chipIndex * 100, raw: h.rawMaterialIndex * 100, inflation: h.inflationRate * 100, rate: h.baseInterestRate * 100 }));
  const index = (v: number) => formatNumber(v, 0);
  const pct = (v: number) => `${formatNumber(v, 1)} %`;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Weltwirtschaft" subtitle="Wirkt auf Nachfrage, Löhne, Zinsen und Komponentenpreise.">
        <KeyValue label="Inflation" value={formatPercent(eco.inflationRate)} />
        <KeyValue label="Leitzins" value={formatPercent(eco.baseInterestRate, 2)} />
        <KeyValue label="Preisniveau (seit Start)" value={formatSignedPercent(eco.priceLevel - 1)} />
        <KeyValue label="Lohnniveau (seit Start)" value={formatSignedPercent(eco.wageIndex - 1)} />
        <KeyValue label="Strompreis" value={`${formatNumber(eco.energyPrice, 3)} €/kWh`} />
        <KeyValue label="Konsumklima" value={eco.consumerConfidence >= 1 ? 'positiv' : 'gedämpft'} />
        <KeyValue label="Rohstoffindex" value={formatNumber(eco.rawMaterialIndex * 100)} />
        <KeyValue label="Chipindex" value={formatNumber(eco.chipIndex * 100)} />
        <div className="mt-2 border-t border-line/60 pt-2 text-xs text-muted">Wechselkurse</div>
        {CURRENCIES.map((c) => (
          <KeyValue key={c} label={`1 ${c}`} value={`${formatNumber(eco.exchangeRates[c], c === 'JPY' ? 4 : 3)} €`} />
        ))}
      </Card>
      <Card title="Chip- und Rohstoffmärkte (Index, Start = 100)" className="lg:col-span-2">
        {data.length < 2 ? (
          <p className="text-sm text-muted">Der Verlauf wird monatlich aufgezeichnet.</p>
        ) : (
          <div className="space-y-5">
            <ChartPanel
              chart={
                <TimeSeriesChart
                  data={data}
                  xKey="label"
                  series={[
                    { key: 'chip', label: 'Chipindex' },
                    { key: 'raw', label: 'Rohstoffindex' },
                  ]}
                  format={index}
                  height={180}
                />
              }
              table={{ columns: ['Monat', 'Chipindex', 'Rohstoffindex'], rows: data.map((d) => [formatMonthLong(d.month), index(d.chip), index(d.raw)]) }}
            />
            <div>
              <div className="mb-1 text-xs font-medium text-muted">Inflation und Leitzins</div>
              <ChartPanel
                chart={
                  <TimeSeriesChart
                    data={data}
                    xKey="label"
                    series={[
                      { key: 'inflation', label: 'Inflation' },
                      { key: 'rate', label: 'Leitzins' },
                    ]}
                    format={pct}
                    height={150}
                  />
                }
                table={{ columns: ['Monat', 'Inflation', 'Leitzins'], rows: data.map((d) => [formatMonthLong(d.month), pct(d.inflation), pct(d.rate)]) }}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function CategoryTable({ selected, onSelect }: { selected: ProductCategoryId; onSelect: (c: ProductCategoryId) => void }) {
  const game = useGameStore((s) => s.game!);
  const owners = [PLAYER_OWNER, ...game.competitors.map((c) => c.id), OTHER_OWNER];
  return (
    <Card title="Produktmärkte" subtitle="Weltweite Nachfrage aller aktiven Regionen. Klicke auf eine Kategorie für Details." bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kategorie</th>
              <th className="px-3 py-2 text-right font-medium">Nachfrage/Monat</th>
              <th className="px-3 py-2 text-right font-medium">Wachstum p. a.</th>
              <th className="px-3 py-2 text-right font-medium">Ø Preis</th>
              <th className="px-3 py-2 text-right font-medium">Eigener Anteil</th>
              <th className="w-56 px-3 py-2 text-left font-medium">Anbieter</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_IDS.map((c) => {
              const market = game.markets[c];
              const unlocked = isCategoryUnlocked(game, c);
              const share = market.share[PLAYER_OWNER] ?? 0;
              return (
                <tr key={c} onClick={() => onSelect(c)} className={clsx('cursor-pointer border-t border-line/50 hover:bg-white/[0.03]', selected === c && 'bg-white/[0.04]')}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 font-medium">
                      <CategoryIcon category={c} className="text-muted" />
                      {CATEGORIES[c].name}
                      {!unlocked && <Badge tone="neutral">Forschung nötig</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular">{formatCompact(market.dailyDemand * 30.44)}</td>
                  <td className={clsx('px-3 py-2 text-right tabular', market.growth >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                    <span className="inline-flex items-center gap-1">
                      {market.growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {formatSignedPercent(market.growth)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular">{market.averagePrice > 0 ? formatMoney(market.averagePrice) : '–'}</td>
                  <td className="px-3 py-2 text-right tabular">{share > 0 ? formatPercent(share, share < 0.01 ? 2 : 1) : '–'}</td>
                  <td className="px-3 py-2">
                    <StackedShareBar
                      height={10}
                      segments={owners.map((o) => ({ key: o, label: o === PLAYER_OWNER ? game.company.name : o === OTHER_OWNER ? 'Andere' : (game.competitors.find((x) => x.id === o)?.shortName ?? o), value: market.share[o] ?? 0, color: ownerColor(o) }))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line/60 px-4 py-2 text-xs text-muted">
        {owners.map((o) => (
          <span key={o} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: ownerColor(o) }} />
            {o === PLAYER_OWNER ? game.company.name : o === OTHER_OWNER ? 'Andere Hersteller' : (game.competitors.find((x) => x.id === o)?.shortName ?? o)}
          </span>
        ))}
      </div>
    </Card>
  );
}

function CategoryDetail({ category }: { category: ProductCategoryId }) {
  const game = useGameStore((s) => s.game!);
  const def = CATEGORIES[category];
  const market = game.markets[category];
  const history = market.history.slice(-24);
  const data = history.map((h) => ({ label: formatMonth(h.month), month: h.month, total: h.total, player: h.player }));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title={def.name} subtitle={def.description}>
        <KeyValue label="Referenzpreis (Mittelklasse)" value={formatMoney(def.referencePrice * game.economy.priceLevel)} />
        <KeyValue label="Nachfrage-Trend" value={`×${formatNumber(market.trend, 2)}`} />
        <KeyValue label="Stückzahl Vormonat" value={formatCompact(Object.values(market.lastMonthUnits).reduce((a, b) => a + b, 0))} />
        <KeyValue label="Eigene Verkäufe Vormonat" value={formatNumber(market.lastMonthUnits[PLAYER_OWNER] ?? 0)} />
        <div className="mt-3 border-t border-line/60 pt-2 text-xs font-medium text-muted">Käufergruppen</div>
        {SEGMENT_IDS.filter((s) => def.segmentMix[s] > 0).map((s) => (
          <KeyValue key={s} label={SEGMENTS[s].name} value={formatPercent(def.segmentMix[s], 0)} />
        ))}
      </Card>
      <Card title="Verkäufe je Monat (Stück)" className="lg:col-span-2">
        {data.length < 2 ? (
          <p className="text-sm text-muted">Der Verlauf wird zu jedem Monatsende aufgezeichnet.</p>
        ) : (
          <ChartPanel
            chart={
              <TimeSeriesChart
                data={data}
                xKey="label"
                kind="area"
                series={[
                  { key: 'total', label: 'Gesamtmarkt' },
                  { key: 'player', label: game.company.name },
                ]}
                format={(v) => formatNumber(v)}
                axisFormat={formatCompact}
                height={240}
              />
            }
            table={{ columns: ['Monat', 'Gesamtmarkt', game.company.name], rows: data.map((d) => [formatMonthLong(d.month), formatNumber(d.total), formatNumber(d.player)]) }}
          />
        )}
      </Card>
    </div>
  );
}

function SegmentsCard() {
  return (
    <Card title="Kundensegmente" subtitle="Jede Zielgruppe gewichtet Preis, Leistung, Qualität und Marke anders.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SEGMENT_IDS.map((s) => {
          const segment = SEGMENTS[s];
          return (
            <div key={s} className="rounded-lg border border-line/60 bg-surface/40 p-3">
              <div className="font-medium">{segment.name}</div>
              <div className="text-xs text-muted">{segment.description}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {segment.wants.map((w) => (
                  <Badge key={w} tone="info">
                    {w}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
                <KeyValue label="Preisempfindlich" value={segment.priceSensitivity >= 3 ? 'sehr' : segment.priceSensitivity >= 2 ? 'mittel' : 'wenig'} />
                <KeyValue label="Zahlungsbereitschaft" value={formatPercent(segment.priceMultiplier, 0)} />
                <KeyValue label="Geduld bei Lieferzeit" value={formatPercent(segment.patience, 0)} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function MarketPage() {
  const game = useGameStore((s) => s.game!);
  const [category, setCategory] = useState<ProductCategoryId>('desktop');
  const totalDemand = CATEGORY_IDS.reduce((a, c) => a + game.markets[c].dailyDemand * 30.44, 0);
  const active = CATEGORY_IDS.filter((c) => (game.markets[c].share[PLAYER_OWNER] ?? 0) > 0).length;
  const lastSnapshot = game.history[game.history.length - 1];
  return (
    <div className="space-y-5">
      <PageHeader
        title="Markt"
        description="Nachfrage, Marktanteile, Kundensegmente und Weltwirtschaft."
        icon={<ChartPie size={20} />}
        actions={
          <Select value={category} onChange={(e) => setCategory(e.target.value as ProductCategoryId)} className="w-auto" aria-label="Kategorie">
            {CATEGORY_IDS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].name}
              </option>
            ))}
          </Select>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Weltmarkt/Monat" value={`${formatCompact(totalDemand)} Geräte`} />
        <StatCard label="Eigener Marktanteil" value={formatPercent(lastSnapshot?.marketShare ?? 0, 2)} hint={`Rekord ${formatPercent(game.stats.peakMarketShare, 2)}`} />
        <StatCard label="Aktive Kategorien" value={`${active}/${CATEGORY_IDS.length}`} />
        <StatCard label="Nachfrage-Index" value={formatNumber(game.stats.demandIndex * 100)} hint="Start = 100" />
      </div>
      <CategoryTable selected={category} onSelect={setCategory} />
      <CategoryDetail category={category} />
      <EconomyCard />
      <SegmentsCard />
    </div>
  );
}
