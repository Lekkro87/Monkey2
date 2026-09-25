import { CandlestickChart, CheckCircle2, ChartLine, Circle, Coins, Rocket } from 'lucide-react';
import { useState } from 'react';
import { ChartPanel, TimeSeriesChart } from '@/components/charts/Charts';
import { OWNER_COLORS } from '@/components/charts/theme';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Field, NumberInput, Segmented } from '@/components/ui/Form';
import { KeyValue, StatCard } from '@/components/ui/Stat';
import { formatDate, formatShortDate } from '@/simulation/calendar';
import { fundamentalValuation, trailing } from '@/systems/finance/accounts';
import { founderShare } from '@/systems/finance/investors';
import { buybackShares, IPO_REQUIREMENTS, ipoBlockers, issueShares, launchIpo, setDividend } from '@/systems/finance/stock';
import { useGameStore } from '@/store/gameStore';
import { formatMoney, formatMoneyCompact, formatNumber, formatPercent, formatSignedPercent } from '@/utils/format';

function IpoCard() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const [floatShare, setFloatShare] = useState(0.25);
  const blockers = ipoBlockers(game);
  const valuation = fundamentalValuation(game);
  const totalShares = game.finance.stock.totalShares;
  const newShares = Math.round((totalShares * floatShare) / (1 - floatShare));
  const price = (valuation / totalShares) * 0.9;
  const gross = newShares * price;
  const checks = [
    { label: 'Unternehmensstufe 4 („Konzern“)', met: game.company.stage >= IPO_REQUIREMENTS.minStage },
    { label: `Unternehmenswert ≥ ${formatMoneyCompact(IPO_REQUIREMENTS.minValuation * game.economy.priceLevel)}`, met: valuation >= IPO_REQUIREMENTS.minValuation * game.economy.priceLevel },
    { label: `Jahresumsatz ≥ ${formatMoneyCompact(IPO_REQUIREMENTS.minRevenue * game.economy.priceLevel)}`, met: trailing(game, 12).revenue >= IPO_REQUIREMENTS.minRevenue * game.economy.priceLevel },
    { label: 'Positives EBITDA in den letzten drei Monaten', met: game.finance.months.length >= 3 && !game.finance.months.slice(-3).some((m) => m.ebitda <= 0) },
    { label: `Mindestens ${IPO_REQUIREMENTS.minFinanceStaff} Mitarbeitende in Finanzen`, met: game.workforce.stats.finance.headcount >= IPO_REQUIREMENTS.minFinanceStaff },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Börsengang (IPO)" icon={<Rocket size={16} />} subtitle="Ein Börsengang bringt viel Kapital – aber auch Quartalsdruck und Kursschwankungen.">
        <ul className="space-y-1.5">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              {c.met ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Circle size={15} className="text-muted" />}
              <span className={c.met ? 'text-muted' : ''}>{c.label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-3">
          <Field label="Streubesitz (neue Aktien)">
            <Segmented<number>
              value={floatShare}
              onChange={setFloatShare}
              options={[0.1, 0.2, 0.25, 0.3, 0.4].map((v) => ({ value: v, label: formatPercent(v, 0) }))}
            />
          </Field>
          <div className="rounded-lg border border-line/60 bg-surface/40 px-3 py-2">
            <KeyValue label="Unternehmenswert (fundamental)" value={formatMoneyCompact(valuation)} />
            <KeyValue label="Ausgabepreis (10 % Abschlag)" value={formatMoney(price, 2)} />
            <KeyValue label="Neue Aktien" value={formatNumber(newShares)} />
            <KeyValue label="Emissionserlös" value={formatMoneyCompact(gross)} />
            <KeyValue label="Bankgebühren (5 %)" value={formatMoneyCompact(gross * 0.05)} />
          </div>
          <Button variant="primary" className="w-full" icon={<Rocket size={15} />} disabled={blockers.length > 0} onClick={() => execute((d) => launchIpo(d, floatShare))}>
            Börsengang durchführen
          </Button>
          {blockers.length > 0 && <p className="text-xs text-muted">Noch nicht möglich: {blockers[0]}</p>}
        </div>
      </Card>
      <CompetitorQuotes />
    </div>
  );
}

function CompetitorQuotes() {
  const game = useGameStore((s) => s.game!);
  return (
    <Card title="Börsennotierte Konkurrenten" icon={<CandlestickChart size={16} />} bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Unternehmen</th>
              <th className="px-3 py-2 text-right font-medium">Aktie</th>
              <th className="px-3 py-2 text-right font-medium">Börsenwert</th>
              <th className="px-3 py-2 text-right font-medium">Umsatz/Monat</th>
            </tr>
          </thead>
          <tbody>
            {game.competitors.map((c) => (
              <tr key={c.id} className="border-t border-line/50">
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: OWNER_COLORS[c.id] }} />
                    {c.name}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular">{formatMoney(c.sharePrice, 2)}</td>
                <td className="px-3 py-2 text-right tabular">{formatMoneyCompact(c.valuation)}</td>
                <td className="px-3 py-2 text-right tabular">{formatMoneyCompact(c.revenueLastMonth)}</td>
              </tr>
            ))}
            {game.finance.stock.isPublic && (
              <tr className="border-t border-line bg-white/[0.02]">
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: OWNER_COLORS.player }} />
                    {game.company.name}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular">{formatMoney(game.finance.stock.sharePrice, 2)}</td>
                <td className="px-3 py-2 text-right tabular">{formatMoneyCompact(game.finance.stock.sharePrice * game.finance.stock.totalShares)}</td>
                <td className="px-3 py-2 text-right tabular">{formatMoneyCompact(game.finance.months[game.finance.months.length - 1]?.revenue ?? 0)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PublicCompany() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const stock = game.finance.stock;
  const [dividend, setDividendValue] = useState(stock.dividendPerShareQuarter);
  const [buyback, setBuyback] = useState(1_000_000);
  const [issue, setIssue] = useState(0.05);
  const history = stock.priceHistory;
  const step = Math.max(1, Math.floor(history.length / 240));
  const data = history.filter((_, i) => i % step === 0 || i === history.length - 1).map((p) => ({ label: formatShortDate(p.day), day: p.day, price: p.price }));
  const marketCap = stock.sharePrice * stock.totalShares;
  const ttm = trailing(game, 12);
  const pe = ttm.netIncome > 0 ? marketCap / ttm.netIncome : null;
  const ipoPrice = history[0]?.price ?? stock.sharePrice;
  const dividendYield = stock.sharePrice > 0 ? (stock.dividendPerShareQuarter * 4) / stock.sharePrice : 0;
  const dividendCost = dividend * stock.totalShares;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Aktienkurs" value={formatMoney(stock.sharePrice, 2)} delta={<span className="text-xs text-muted">{formatSignedPercent(stock.sharePrice / ipoPrice - 1)} seit IPO</span>} />
        <StatCard label="Börsenwert" value={formatMoneyCompact(marketCap)} />
        <StatCard label="KGV" value={pe !== null ? formatNumber(pe, 1) : '–'} hint="Kurs-Gewinn-Verhältnis" />
        <StatCard label="Gewinn je Aktie (Q)" value={formatMoney(stock.lastQuarterEps, 2)} />
        <StatCard label="Anlegerstimmung" value={stock.sentiment >= 1.1 ? 'euphorisch' : stock.sentiment >= 0.95 ? 'neutral' : 'skeptisch'} hint={`Faktor ${formatNumber(stock.sentiment, 2)}`} tone={stock.sentiment < 0.85 ? 'warn' : 'default'} />
      </div>
      <Card title="Kursverlauf" icon={<ChartLine size={16} />} subtitle={`Börsengang am ${formatDate(stock.ipoDay ?? 0)} · Ausgabepreis ${formatMoney(ipoPrice, 2)}`}>
        <ChartPanel
          chart={<TimeSeriesChart data={data} xKey="label" series={[{ key: 'price', label: 'Aktienkurs' }]} kind="area" format={(v) => formatMoney(v, 2)} height={260} />}
          table={{ columns: ['Datum', 'Kurs'], rows: data.map((d) => [formatDate(d.day), formatMoney(d.price, 2)]) }}
        />
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Dividende" icon={<Coins size={16} />} subtitle="Wird zu Quartalsbeginn ausgeschüttet. Eine verlässliche Dividende stützt den Kurs.">
          <Field label="Dividende je Aktie und Quartal">
            <NumberInput value={dividend} min={0} step={0.05} suffix="€" onChange={(v) => setDividendValue(Math.max(0, v))} />
          </Field>
          <div className="mt-2 rounded-lg border border-line/60 bg-surface/40 px-3 py-1.5 text-sm">
            <KeyValue label="Ausschüttung je Quartal" value={formatMoneyCompact(dividendCost)} />
            <KeyValue label="Aktuelle Rendite p. a." value={formatPercent(dividendYield, 2)} />
          </div>
          <Button size="sm" variant="primary" className="mt-3 w-full" onClick={() => execute((d) => setDividend(d, dividend))}>
            Dividende festlegen
          </Button>
        </Card>
        <Card title="Aktienrückkauf" subtitle="Kauft Aktien aus dem Streubesitz zurück – erhöht den Gewinn je Aktie.">
          <Field label="Volumen">
            <NumberInput value={buyback} min={100_000} step={100_000} suffix="€" onChange={(v) => setBuyback(Math.max(0, Math.round(v)))} />
          </Field>
          <Button size="sm" className="mt-3 w-full" disabled={buyback < 100_000 || buyback > game.finance.cash} onClick={() => execute((d) => buybackShares(d, buyback))}>
            Aktien zurückkaufen
          </Button>
        </Card>
        <Card title="Kapitalerhöhung" subtitle="Neue Aktien bringen frisches Kapital, verwässern aber die Anteile und drücken die Stimmung.">
          <Field label="Neue Aktien">
            <Segmented<number> value={issue} onChange={setIssue} options={[0.02, 0.05, 0.1, 0.2].map((v) => ({ value: v, label: formatPercent(v, 0) }))} />
          </Field>
          <div className="mt-2 text-sm text-muted">Erlös ca. {formatMoneyCompact(stock.totalShares * issue * stock.sharePrice * 0.95 * 0.97)}</div>
          <Button size="sm" className="mt-3 w-full" onClick={() => execute((d) => issueShares(d, issue))}>
            Kapitalerhöhung durchführen
          </Button>
        </Card>
      </div>
      <CompetitorQuotes />
    </div>
  );
}

export default function StockPage() {
  const game = useGameStore((s) => s.game!);
  const stock = game.finance.stock;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Börse"
        description={stock.isPublic ? 'Aktienkurs, Dividenden und Kapitalmaßnahmen.' : 'Vom Start-up zum börsennotierten Konzern.'}
        icon={<ChartLine size={20} />}
        actions={
          <Badge tone={stock.isPublic ? 'good' : 'neutral'}>
            {stock.isPublic ? 'börsennotiert' : 'privat'} · Gründer:in {formatPercent(founderShare(game))}
          </Badge>
        }
      />
      {stock.isPublic ? <PublicCompany /> : <IpoCard />}
    </div>
  );
}
