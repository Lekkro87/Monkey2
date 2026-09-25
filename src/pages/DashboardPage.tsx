import { Activity, Boxes, Building2, ChartLine, Factory, FlaskConical, Gauge, ShoppingCart, Star, TrendingUp, Users, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIES, CATEGORY_IDS } from '@/data/categories';
import { getTech } from '@/data/technologies';
import { ChartPanel, HorizontalBars, SignedBarChart, TimeSeriesChart } from '@/components/charts/Charts';
import { SERIES } from '@/components/charts/theme';
import { Checklist } from '@/components/dashboard/Checklist';
import { NewsList } from '@/components/NewsFeed';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { Delta, MiniStat, StatCard } from '@/components/ui/Stat';
import { useAlerts } from '@/hooks/useAlerts';
import { shallowObjectEqual, useGameSelector } from '@/hooks/useGameSelectors';
import { formatWeekLabel } from '@/simulation/calendar';
import { currentMonthFigures, lastReport } from '@/systems/finance/accounts';
import { overallPlayerShare, PLAYER_OWNER } from '@/systems/market/demand';
import { researchProgressRatio } from '@/systems/research/research';
import { storageCapacity, totalProductUnits, usedStorage } from '@/systems/inventory/inventory';
import { useGame } from '@/store/gameStore';
import type { GameState } from '@/types';
import { formatCompact, formatMoney, formatMoneyCompact, formatNumber, formatPercent, formatSignedMoney } from '@/utils/format';
import { percentChange } from '@/utils/math';

function kpis(game: GameState) {
  const history = game.history;
  const last = history[history.length - 1];
  const past = history[history.length - 5];
  const month = currentMonthFigures(game);
  const report = lastReport(game);
  const backorders = game.products.reduce((a, p) => a + p.sales.backorders, 0);
  const inTransit = game.supply.orders.filter((o) => o.status === 'in_transit').length + game.supply.cmOrders.filter((o) => o.status === 'in_production').length;
  const active = game.research.active;
  return {
    cash: game.finance.cash,
    cashDelta: past ? percentChange(game.finance.cash, past.cash) : null,
    revenueMonth: month.revenue,
    revenueLast: report?.revenue ?? 0,
    profitMonth: game.stats.month.profit,
    netLast: report?.netIncome ?? 0,
    valuation: game.finance.valuation,
    valuationDelta: past ? percentChange(game.finance.valuation, past.valuation) : null,
    employees: game.workforce.employees.length,
    employeesDelta: past ? game.workforce.employees.length - past.employees : 0,
    sharePrice: game.finance.stock.isPublic ? game.finance.stock.sharePrice : null,
    sharePriceDelta: game.finance.stock.isPublic && game.finance.stock.priceHistory.length > 30 ? percentChange(game.finance.stock.sharePrice, game.finance.stock.priceHistory[game.finance.stock.priceHistory.length - 31].price) : null,
    backorders,
    inTransit,
    stockUnits: totalProductUnits(game),
    storageRatio: usedStorage(game) / Math.max(1, storageCapacity(game)),
    utilization: game.stats.utilization,
    reputation: game.brand.reputation,
    reputationDelta: last && past ? last.reputation - past.reputation : 0,
    share: overallPlayerShare(game),
    researchName: active ? (getTech(active.techId)?.name ?? '') : '',
    researchRatio: researchProgressRatio(game),
    demandDelta: last && past ? percentChange(last.demandIndex, past.demandIndex) : null,
  };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const k = useGameSelector(kpis, shallowObjectEqual);
  const history = useGame((g) => g.history);
  const news = useGame((g) => g.news);
  const markets = useGame((g) => g.markets);
  const alerts = useAlerts();

  const series = useMemo(
    () =>
      history.slice(-52).map((h) => ({
        label: formatWeekLabel(h.day),
        revenue: Math.round(h.revenue),
        profit: Math.round(h.profit),
        sold: h.unitsSold,
        produced: h.unitsProduced,
      })),
    [history],
  );

  const shareItems = CATEGORY_IDS.filter((c) => (markets[c].rolling[PLAYER_OWNER] ?? 0) > 0).map((c) => ({
    label: CATEGORIES[c].pluralName,
    value: markets[c].share[PLAYER_OWNER] ?? 0,
  }));

  return (
    <div className="space-y-5">
      {alerts.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {alerts.slice(0, 4).map((alert) => (
            <Alert
              key={alert.id}
              tone={alert.tone}
              title={alert.title}
              action={
                alert.link ? (
                  <Link to={`/game/${alert.link}`} className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline">
                    Öffnen
                  </Link>
                ) : undefined
              }
            >
              {alert.text}
            </Alert>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Geld" icon={<Wallet size={15} />} value={formatMoneyCompact(k.cash)} tone={k.cash < 0 ? 'bad' : 'default'} delta={<Delta value={k.cashDelta} />} hint="vs. vor 4 Wochen" onClick={() => navigate('/game/finance')} />
        <StatCard label="Umsatz (Monat)" icon={<TrendingUp size={15} />} value={formatMoneyCompact(k.revenueMonth)} hint={`Vormonat ${formatMoneyCompact(k.revenueLast)}`} onClick={() => navigate('/game/finance')} />
        <StatCard
          label="Gewinn (Monat)"
          icon={<ChartLine size={15} />}
          value={<span className={k.profitMonth < 0 ? 'text-red-400' : ''}>{formatSignedMoney(k.profitMonth)}</span>}
          hint={`Vormonat ${formatSignedMoney(k.netLast)}`}
          onClick={() => navigate('/game/finance')}
        />
        <StatCard label="Unternehmenswert" icon={<Building2 size={15} />} value={formatMoneyCompact(k.valuation)} delta={<Delta value={k.valuationDelta} />} hint="vs. vor 4 Wochen" onClick={() => navigate('/game/stock')} />
        <StatCard label="Mitarbeiter" icon={<Users size={15} />} value={formatNumber(k.employees)} delta={<Delta value={k.employeesDelta} format={(v) => `${v > 0 ? '+' : ''}${formatNumber(v)}`} />} onClick={() => navigate('/game/employees')} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        <MiniStat label="Aktienkurs" value={k.sharePrice !== null ? formatMoney(k.sharePrice, 2) : 'nicht börsennotiert'} hint={k.sharePrice !== null ? <Delta value={k.sharePriceDelta} /> : undefined} />
        <MiniStat label={<span className="inline-flex items-center gap-1"><ShoppingCart size={11} /> Offene Bestellungen</span>} value={formatNumber(k.backorders)} hint={`${k.inTransit} Lieferungen unterwegs`} />
        <MiniStat label={<span className="inline-flex items-center gap-1"><Boxes size={11} /> Lagerbestand</span>} value={`${formatCompact(k.stockUnits)} Geräte`} hint={`Lager ${formatPercent(k.storageRatio, 0)} belegt`} />
        <MiniStat label={<span className="inline-flex items-center gap-1"><Factory size={11} /> Auslastung</span>} value={formatPercent(k.utilization, 0)} hint="Produktion" />
        <MiniStat label={<span className="inline-flex items-center gap-1"><Star size={11} /> Reputation</span>} value={`${formatNumber(k.reputation)}/100`} hint={<Delta value={k.reputationDelta} format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`} />} />
        <MiniStat label={<span className="inline-flex items-center gap-1"><Gauge size={11} /> Marktanteil</span>} value={formatPercent(k.share, 2)} hint="aktive Kategorien" />
        <MiniStat label={<span className="inline-flex items-center gap-1"><Activity size={11} /> Nachfrage</span>} value={<Delta value={k.demandDelta} />} hint="Markttrend (4 Wo.)" />
        <MiniStat label={<span className="inline-flex items-center gap-1"><FlaskConical size={11} /> Forschung</span>} value={k.researchName ? formatPercent(k.researchRatio, 0) : '—'} hint={k.researchName || 'keine aktive Forschung'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-5 md:grid-cols-2">
          <Card title="Umsatzentwicklung" subtitle="Umsatz pro Woche">
            {series.length < 2 ? (
              <p className="py-10 text-center text-sm text-muted">Daten erscheinen nach den ersten Wochen.</p>
            ) : (
              <ChartPanel
                chart={<TimeSeriesChart data={series} xKey="label" kind="area" series={[{ key: 'revenue', label: 'Umsatz' }]} format={formatMoney} axisFormat={formatMoneyCompact} />}
                table={{ columns: ['Woche', 'Umsatz'], rows: series.map((r) => [r.label, formatMoney(r.revenue)]) }}
              />
            )}
          </Card>
          <Card title="Gewinnentwicklung" subtitle="Ergebnis pro Woche (blau = Gewinn, rot = Verlust)">
            {series.length < 2 ? (
              <p className="py-10 text-center text-sm text-muted">Daten erscheinen nach den ersten Wochen.</p>
            ) : (
              <ChartPanel
                chart={<SignedBarChart data={series} xKey="label" valueKey="profit" label="Gewinn" format={formatMoney} axisFormat={formatMoneyCompact} height={220} />}
                table={{ columns: ['Woche', 'Gewinn'], rows: series.map((r) => [r.label, formatMoney(r.profit)]) }}
              />
            )}
          </Card>
          <Card title="Produktion & Verkäufe" subtitle="Geräte pro Woche">
            {series.length < 2 ? (
              <p className="py-10 text-center text-sm text-muted">Noch keine Daten.</p>
            ) : (
              <ChartPanel
                chart={
                  <TimeSeriesChart
                    data={series}
                    xKey="label"
                    series={[
                      { key: 'produced', label: 'Produziert', color: SERIES[0] },
                      { key: 'sold', label: 'Verkauft', color: SERIES[1] },
                    ]}
                    format={(v) => `${formatNumber(v)} Stk.`}
                    axisFormat={formatCompact}
                  />
                }
                table={{ columns: ['Woche', 'Produziert', 'Verkauft'], rows: series.map((r) => [r.label, formatNumber(r.produced), formatNumber(r.sold)]) }}
              />
            )}
          </Card>
          <Card title="Marktanteile" subtitle="Eigener Anteil je Kategorie (30 Tage, weltweit)">
            {shareItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Noch keine Produkte im Verkauf.</p>
            ) : (
              <HorizontalBars items={shareItems} format={(v) => formatPercent(v, 2)} />
            )}
            <Link to="/game/market" className="mt-4 block text-xs text-muted hover:text-ink">
              Alle Märkte ansehen →
            </Link>
          </Card>
        </div>

        <div className="space-y-5">
          <Checklist />
          <Card title="Aktuelle Nachrichten" actions={<Link to="/game/news" className="text-xs text-muted hover:text-ink">Alle</Link>} bodyClassName="p-2">
            <NewsList items={news.slice(0, 12)} compact />
          </Card>
        </div>
      </div>
    </div>
  );
}
