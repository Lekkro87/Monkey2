import clsx from 'clsx';
import { Swords } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, CATEGORY_IDS } from '@/data/categories';
import { STRATEGY_LABELS } from '@/data/competitors';
import { CHART, OWNER_COLORS } from '@/components/charts/theme';
import { Sparkline } from '@/components/charts/Charts';
import { CategoryIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Card, PageHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Form';
import { KeyValue } from '@/components/ui/Stat';
import { formatDate } from '@/simulation/calendar';
import { OTHER_OWNER, PLAYER_OWNER } from '@/systems/market/demand';
import { useGameStore } from '@/store/gameStore';
import type { Competitor, GameState, ProductCategoryId } from '@/types';
import { formatMoney, formatMoneyCompact, formatNumber, formatPercent } from '@/utils/format';
import { TIER_LABELS } from '@/utils/skuFormat';

function ownerColor(id: string): string {
  return OWNER_COLORS[id] ?? CHART.otherGray;
}

/** Marktanteil eines Anbieters über alle Kategorien (rollierende 30 Tage, nach Stückzahl). */
function overallShare(game: GameState, owner: string): number {
  let units = 0;
  let total = 0;
  for (const categoryId of CATEGORY_IDS) {
    const rolling = game.markets[categoryId].rolling;
    units += rolling[owner] ?? 0;
    total += Object.values(rolling).reduce((a, b) => a + b, 0);
  }
  return total > 0 ? units / total : 0;
}

function CompetitorCard({ competitor, selected, onSelect }: { competitor: Competitor; selected: boolean; onSelect: () => void }) {
  const game = useGameStore((s) => s.game!);
  const active = competitor.products.filter((p) => p.active);
  const share = overallShare(game, competitor.id);
  const home = game.company.homeRegion;
  return (
    <button type="button" onClick={onSelect} className={clsx('rounded-xl border bg-panel/90 p-4 text-left transition hover:border-slate-500', selected ? 'accent-border' : 'border-line')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: ownerColor(competitor.id) }} />
          <span className="font-semibold">{competitor.name}</span>
        </div>
        <Badge tone="neutral" title={STRATEGY_LABELS[competitor.strategy].description}>
          {STRATEGY_LABELS[competitor.strategy].name}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted">{competitor.description}</p>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-[11px] text-muted">Umsatz letzter Monat</div>
          <div className="text-lg font-bold tabular">{formatMoneyCompact(competitor.revenueLastMonth)}</div>
        </div>
        <Sparkline values={competitor.revenueHistory.slice(-24)} color={ownerColor(competitor.id)} width={96} height={30} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs">
        <KeyValue label="Marktanteil" value={formatPercent(share)} />
        <KeyValue label="Gewinn/Monat" value={<span className={competitor.profitLastMonth < 0 ? 'text-red-300' : ''}>{formatMoneyCompact(competitor.profitLastMonth)}</span>} />
        <KeyValue label="Börsenwert" value={formatMoneyCompact(competitor.valuation)} />
        <KeyValue label="Aktie" value={formatMoney(competitor.sharePrice, 2)} />
        <KeyValue label="Bekanntheit" value={formatPercent(competitor.brand.awareness[home], 0)} />
        <KeyValue label="Technologie" value={competitor.techLead >= 0 ? `+${formatNumber(competitor.techLead, 1)} J.` : `${formatNumber(competitor.techLead, 1)} J.`} />
        <KeyValue label="Mitarbeitende" value={formatNumber(competitor.employees)} />
        <KeyValue label="Aktive Produkte" value={formatNumber(active.length)} />
      </div>
    </button>
  );
}

function ProductLineup({ competitor }: { competitor: Competitor }) {
  const [category, setCategory] = useState<ProductCategoryId | 'all'>('all');
  const products = competitor.products
    .filter((p) => p.active && (category === 'all' || p.category === category))
    .sort((a, b) => a.category.localeCompare(b.category) || b.price - a.price);
  const categories = [...new Set(competitor.products.filter((p) => p.active).map((p) => p.category))];
  return (
    <Card
      title={`Produktportfolio: ${competitor.name}`}
      subtitle="Konkurrenten bringen regelmäßig Nachfolger, senken Preise und reagieren auf erfolgreiche Produkte des Spielers."
      actions={
        <Select value={category} onChange={(e) => setCategory(e.target.value as ProductCategoryId | 'all')} className="w-auto py-1.5 text-xs" aria-label="Kategorie">
          <option value="all">Alle Kategorien</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORIES[c].name}
            </option>
          ))}
        </Select>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Produkt</th>
              <th className="px-3 py-2 text-left font-medium">Klasse</th>
              <th className="px-3 py-2 text-right font-medium">Preis</th>
              <th className="px-3 py-2 text-right font-medium">Leistung</th>
              <th className="px-3 py-2 text-right font-medium">Qualität</th>
              <th className="px-3 py-2 text-right font-medium">Test</th>
              <th className="px-3 py-2 text-right font-medium">Verkauft</th>
              <th className="px-3 py-2 text-right font-medium">Marktstart</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-line/50">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CategoryIcon category={p.category} className="text-muted" />
                    {p.name}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-muted">{TIER_LABELS[p.tier]}</td>
                <td className="px-3 py-2 text-right tabular">{formatMoney(p.price)}</td>
                <td className="px-3 py-2 text-right tabular">{formatNumber(p.attributes.performance)}</td>
                <td className="px-3 py-2 text-right tabular">{formatNumber(p.attributes.quality)}</td>
                <td className="px-3 py-2 text-right tabular">{formatNumber(p.reviewScore, 1)}</td>
                <td className="px-3 py-2 text-right tabular">{formatNumber(p.unitsSold)}</td>
                <td className="px-3 py-2 text-right text-xs text-muted">{formatDate(p.releaseDay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {products.length === 0 && <p className="p-4 text-sm text-muted">Keine aktiven Produkte in dieser Kategorie.</p>}
    </Card>
  );
}

function ShareTable() {
  const game = useGameStore((s) => s.game!);
  const owners = [PLAYER_OWNER, ...game.competitors.map((c) => c.id), OTHER_OWNER];
  const label = (owner: string) => (owner === PLAYER_OWNER ? game.company.name : owner === OTHER_OWNER ? 'Andere Hersteller' : (game.competitors.find((c) => c.id === owner)?.shortName ?? owner));
  const categories = CATEGORY_IDS.filter((c) => Object.values(game.markets[c].rolling).some((v) => v > 0));
  return (
    <Card title="Marktanteile je Kategorie" subtitle="Rollierende 30 Tage nach Stückzahl, alle aktiven Regionen." bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kategorie</th>
              {owners.map((o) => (
                <th key={o} className="px-3 py-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: ownerColor(o) }} />
                    {label(o)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const share = game.markets[c].share;
              const leader = owners.reduce((best, o) => ((share[o] ?? 0) > (share[best] ?? 0) ? o : best), owners[0]);
              return (
                <tr key={c} className="border-t border-line/50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <CategoryIcon category={c} className="text-muted" />
                      {CATEGORIES[c].name}
                    </div>
                  </td>
                  {owners.map((o) => (
                    <td key={o} className={clsx('px-3 py-2 text-right tabular', o === leader && 'font-semibold text-ink', o !== leader && 'text-muted', o === PLAYER_OWNER && (share[o] ?? 0) > 0 && 'accent-text')}>
                      {(share[o] ?? 0) > 0 ? formatPercent(share[o] ?? 0) : '–'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function CompetitorsPage() {
  const game = useGameStore((s) => s.game!);
  const [selected, setSelected] = useState(game.competitors[0]?.id ?? '');
  const competitor = game.competitors.find((c) => c.id === selected) ?? game.competitors[0];
  return (
    <div className="space-y-5">
      <PageHeader title="Konkurrenz" description="Fünf KI-Konzerne mit eigenen Strategien – sie reagieren auf Preise, Produkte und Erfolge deines Unternehmens." icon={<Swords size={20} />} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {game.competitors.map((c) => (
          <CompetitorCard key={c.id} competitor={c} selected={c.id === competitor?.id} onSelect={() => setSelected(c.id)} />
        ))}
      </div>
      <ShareTable />
      {competitor && <ProductLineup competitor={competitor} />}
    </div>
  );
}
