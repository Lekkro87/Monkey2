import clsx from 'clsx';
import { Banknote, HandCoins, Landmark, LifeBuoy, PiggyBank, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DIFFICULTIES } from '@/data/difficulties';
import { ChartPanel, SignedBarChart, TimeSeriesChart } from '@/components/charts/Charts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { Field, NumberInput, Segmented } from '@/components/ui/Form';
import { KeyValue, StatCard } from '@/components/ui/Stat';
import { formatDate, formatMonth, formatMonthLong, formatShortDate } from '@/simulation/calendar';
import { balanceSheet, currentMonthFigures, fundamentalValuation, trailing } from '@/systems/finance/accounts';
import { insolvencyDaysLeft } from '@/systems/finance/insolvency';
import { acceptFunding, declineFunding, founderShare } from '@/systems/finance/investors';
import { LEDGER_LABELS, ledgerOpex, ledgerRevenue, OPEX_CATEGORIES } from '@/systems/finance/ledger';
import { creditLimit, LOAN_TERMS, quoteLoan, repayLoan, takeEmergencyLoan, takeLoan } from '@/systems/finance/loans';
import { useGameStore } from '@/store/gameStore';
import type { GameState, Ledger } from '@/types';
import { formatMoney, formatMoneyCompact, formatPercent } from '@/utils/format';

type Tab = 'pnl' | 'cashflow' | 'balance' | 'loans' | 'investors';

interface PnlColumn {
  key: string;
  label: string;
  running: boolean;
  ledger: Ledger;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  ebitda: number;
  depreciation: number | null;
  ebit: number | null;
  interest: number;
  taxes: number | null;
  netIncome: number | null;
  operating: number | null;
  investing: number | null;
  financing: number | null;
  cashEnd: number;
}

function pnlColumns(game: GameState, count: number): PnlColumn[] {
  const closed = game.finance.months.slice(-count).map<PnlColumn>((m) => ({
    key: `m${m.month}`,
    label: formatMonth(m.month),
    running: false,
    ledger: m.ledger,
    revenue: m.revenue,
    cogs: m.cogs,
    grossProfit: m.grossProfit,
    opex: m.opex,
    ebitda: m.ebitda,
    depreciation: m.depreciation,
    ebit: m.ebit,
    interest: m.interest,
    taxes: m.taxes,
    netIncome: m.netIncome,
    operating: m.operatingCashflow,
    investing: m.investingCashflow,
    financing: m.financingCashflow,
    cashEnd: m.cashEnd,
  }));
  const ledger = game.finance.ledger;
  const revenue = ledgerRevenue(ledger);
  const cogs = -ledger.cogs;
  const opex = ledgerOpex(ledger);
  const running: PnlColumn = {
    key: 'current',
    label: 'Laufend',
    running: true,
    ledger,
    revenue,
    cogs,
    grossProfit: revenue - cogs,
    opex,
    ebitda: revenue - cogs - opex,
    depreciation: null,
    ebit: null,
    interest: -ledger.interest,
    taxes: null,
    netIncome: null,
    operating: null,
    investing: ledger.capex + ledger.asset_sale,
    financing: ledger.loan_in + ledger.loan_repay + ledger.equity_in + ledger.dividends + ledger.buyback,
    cashEnd: game.finance.cash,
  };
  return [...closed, running];
}

function Amount({ value, strong, invert }: { value: number | null; strong?: boolean; invert?: boolean }) {
  if (value === null) return <span className="text-muted">–</span>;
  const shown = invert ? -value : value;
  return <span className={clsx('tabular', strong && 'font-semibold', shown < -0.5 && 'text-red-300')}>{formatMoney(shown)}</span>;
}

function StatementRow({ label, values, strong, invert, indent }: { label: ReactNode; values: (number | null)[]; strong?: boolean; invert?: boolean; indent?: boolean }) {
  return (
    <tr className={clsx('border-t border-line/40', strong && 'bg-white/[0.02]')}>
      <td className={clsx('py-1.5 pr-3', indent ? 'pl-7 text-muted' : 'pl-4', strong && 'font-semibold')}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-1.5 text-right">
          <Amount value={v} strong={strong} invert={invert} />
        </td>
      ))}
    </tr>
  );
}

function PnlTab({ columns }: { columns: PnlColumn[] }) {
  const usedOpex = OPEX_CATEGORIES.filter((c) => columns.some((col) => Math.abs(col.ledger[c]) >= 0.5));
  return (
    <Card title="Gewinn- und Verlustrechnung" subtitle="Monatswerte; die letzte Spalte zeigt den laufenden Monat (vor Abschreibungen und Steuern)." bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="py-2 pr-3 pl-4 text-left font-medium">Position</th>
              {columns.map((c) => (
                <th key={c.key} className={clsx('px-3 py-2 text-right font-medium', c.running && 'accent-text')}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <StatementRow label="Umsatzerlöse" values={columns.map((c) => c.revenue)} strong />
            <StatementRow label={LEDGER_LABELS.sales} values={columns.map((c) => c.ledger.sales)} indent />
            <StatementRow label={LEDGER_LABELS.subscriptions} values={columns.map((c) => c.ledger.subscriptions)} indent />
            <StatementRow label={LEDGER_LABELS.services} values={columns.map((c) => c.ledger.services)} indent />
            <StatementRow label="Materialeinsatz" values={columns.map((c) => -c.cogs)} />
            <StatementRow label="Bruttogewinn" values={columns.map((c) => c.grossProfit)} strong />
            {usedOpex.map((category) => (
              <StatementRow key={category} label={LEDGER_LABELS[category]} values={columns.map((c) => c.ledger[category])} indent />
            ))}
            <StatementRow label="Betriebliche Aufwendungen" values={columns.map((c) => -c.opex)} />
            <StatementRow label="EBITDA" values={columns.map((c) => c.ebitda)} strong />
            <StatementRow label="Abschreibungen" values={columns.map((c) => (c.depreciation === null ? null : -c.depreciation))} />
            <StatementRow label="EBIT" values={columns.map((c) => c.ebit)} strong />
            <StatementRow label="Zinsen" values={columns.map((c) => -c.interest)} />
            <StatementRow label="Steuern" values={columns.map((c) => (c.taxes === null ? null : -c.taxes))} />
            <StatementRow label="Monatsergebnis" values={columns.map((c) => c.netIncome)} strong />
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CashflowTab({ columns }: { columns: PnlColumn[] }) {
  return (
    <Card title="Kapitalflussrechnung" subtitle="Operativ = Umsatz minus laufende Ausgaben inkl. Materialeinkauf; Investitionen = Anlagen; Finanzierung = Kredite und Eigenkapital." bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-xs text-muted">
            <tr>
              <th className="py-2 pr-3 pl-4 text-left font-medium">Position</th>
              {columns.map((c) => (
                <th key={c.key} className={clsx('px-3 py-2 text-right font-medium', c.running && 'accent-text')}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <StatementRow label="Operativer Cashflow" values={columns.map((c) => c.operating)} strong />
            <StatementRow label={LEDGER_LABELS.purchases} values={columns.map((c) => c.ledger.purchases)} indent />
            <StatementRow label="Investitions-Cashflow" values={columns.map((c) => c.investing)} strong />
            <StatementRow label={LEDGER_LABELS.capex} values={columns.map((c) => c.ledger.capex)} indent />
            <StatementRow label={LEDGER_LABELS.asset_sale} values={columns.map((c) => c.ledger.asset_sale)} indent />
            <StatementRow label="Finanzierungs-Cashflow" values={columns.map((c) => c.financing)} strong />
            <StatementRow label={LEDGER_LABELS.loan_in} values={columns.map((c) => c.ledger.loan_in)} indent />
            <StatementRow label={LEDGER_LABELS.loan_repay} values={columns.map((c) => c.ledger.loan_repay)} indent />
            <StatementRow label={LEDGER_LABELS.equity_in} values={columns.map((c) => c.ledger.equity_in)} indent />
            <StatementRow label={LEDGER_LABELS.dividends} values={columns.map((c) => c.ledger.dividends)} indent />
            <StatementRow label="Kassenbestand (Ende)" values={columns.map((c) => c.cashEnd)} strong />
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BalanceTab() {
  const game = useGameStore((s) => s.game!);
  const balance = balanceSheet(game);
  const ttm = trailing(game, 12);
  const equityRatio = balance.totalAssets > 0 ? balance.equity / balance.totalAssets : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Aktiva">
        <KeyValue label="Kasse und Bank" value={formatMoney(balance.cash)} />
        <KeyValue label="Vorräte (Komponenten & Fertigwaren)" value={formatMoney(balance.inventory)} />
        <KeyValue label="Anlagevermögen (Buchwert)" value={formatMoney(balance.fixedAssets)} />
        <KeyValue label={<strong className="text-ink">Summe Aktiva</strong>} value={formatMoney(balance.totalAssets)} className="mt-1 border-t border-line/60 pt-2" />
      </Card>
      <Card title="Passiva">
        <KeyValue label="Bankkredite" value={formatMoney(balance.debt)} />
        <KeyValue label="Dispositionskredit" value={formatMoney(balance.overdraft)} />
        <KeyValue label="Eigenkapital" value={<span className={balance.equity < 0 ? 'text-red-300' : ''}>{formatMoney(balance.equity)}</span>} />
        <KeyValue label={<strong className="text-ink">Summe Passiva</strong>} value={formatMoney(balance.totalLiabilities + balance.equity)} className="mt-1 border-t border-line/60 pt-2" />
      </Card>
      <Card title="Kennzahlen" className="lg:col-span-2">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <KeyValue label="Eigenkapitalquote" value={formatPercent(equityRatio)} />
          <KeyValue label="Bonität" value={game.finance.creditRating} />
          <KeyValue label="Umsatz (12 Monate, annualisiert)" value={formatMoney(ttm.revenue)} />
          <KeyValue label="EBITDA (12 Monate, annualisiert)" value={formatMoney(ttm.ebitda)} />
          <KeyValue label="Jahresergebnis (12 Monate)" value={formatMoney(ttm.netIncome)} />
          <KeyValue label="Steuerlicher Verlustvortrag" value={formatMoney(game.finance.lossCarryforward)} />
          <KeyValue label="Unternehmenswert (fundamental)" value={formatMoney(fundamentalValuation(game))} />
          <KeyValue label="Steuersatz" value={formatPercent(game.economy.taxRate)} />
        </div>
      </Card>
    </div>
  );
}

function LoansTab() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const [amount, setAmount] = useState(25_000);
  const [term, setTerm] = useState<number>(36);
  const limit = creditLimit(game);
  const quote = quoteLoan(game, Math.max(0, amount), term);
  const loans = game.finance.loans;
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card title="Kredit aufnehmen" subtitle={`Kreditrahmen: ${formatMoney(limit)} · Bonität ${game.finance.creditRating}`} className="lg:col-span-2" icon={<Landmark size={16} />}>
        <div className="space-y-3">
          <Field label="Betrag" hint="Mindestens 5.000 €. Der Rahmen wächst mit EBITDA, Umsatz, Anlagen und Vorräten.">
            <NumberInput value={amount} min={5_000} step={5_000} suffix="€" onChange={(v) => setAmount(Math.max(0, Math.round(v)))} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {[10_000, 25_000, 50_000, 100_000].map((v) => (
              <Button key={v} size="xs" variant={amount === v ? 'primary' : 'secondary'} onClick={() => setAmount(v)} disabled={v > limit}>
                {formatMoneyCompact(v)}
              </Button>
            ))}
            <Button size="xs" onClick={() => setAmount(Math.floor(limit / 1000) * 1000)} disabled={limit < 5_000}>
              Maximum
            </Button>
          </div>
          <Field label="Laufzeit">
            <Segmented<number> value={term} onChange={setTerm} options={LOAN_TERMS.map((t) => ({ value: t, label: `${t / 12} J.` }))} />
          </Field>
          <div className="rounded-lg border border-line/60 bg-surface/40 px-3 py-2">
            <KeyValue label="Zinssatz" value={`${formatPercent(quote.annualRate, 2)} p. a.`} />
            <KeyValue label="Monatliche Rate" value={formatMoney(quote.monthlyPayment)} />
            <KeyValue label="Zinskosten gesamt" value={formatMoney(quote.totalInterest)} />
          </div>
          <Button variant="primary" className="w-full" icon={<Banknote size={15} />} disabled={amount < 5_000 || amount > limit} onClick={() => execute((d) => takeLoan(d, amount, term))}>
            Kredit aufnehmen
          </Button>
          {amount > limit && <p className="text-xs text-red-400">Der Betrag übersteigt den Kreditrahmen.</p>}
        </div>
      </Card>
      <Card title="Laufende Kredite" className="lg:col-span-3" bodyClassName="p-0">
        {loans.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={<PiggyBank size={26} />} title="Keine Kredite" description="Das Unternehmen ist schuldenfrei." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-panel-2 text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Kredit</th>
                  <th className="px-3 py-2 text-right font-medium">Restschuld</th>
                  <th className="px-3 py-2 text-right font-medium">Zins</th>
                  <th className="px-3 py-2 text-right font-medium">Rate</th>
                  <th className="px-3 py-2 text-right font-medium">Laufzeit</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id} className="border-t border-line/50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{loan.kind === 'emergency' ? 'Notkredit' : 'Bankkredit'}</div>
                      <div className="text-xs text-muted">
                        {formatMoney(loan.principal)} seit {formatDate(loan.startDay)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular">{formatMoney(loan.remaining)}</td>
                    <td className="px-3 py-2 text-right tabular">{formatPercent(loan.annualRate, 2)}</td>
                    <td className="px-3 py-2 text-right tabular">{formatMoney(loan.monthlyPayment)}</td>
                    <td className="px-3 py-2 text-right text-xs tabular">
                      {loan.monthsPaid}/{loan.termMonths} Mon.
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="xs" disabled={game.finance.cash < loan.remaining * 1.01} title={`Sondertilgung inkl. 1 % Vorfälligkeitsentschädigung (${formatMoney(loan.remaining * 0.01)})`} onClick={() => execute((d) => repayLoan(d, loan.id))}>
                        Tilgen
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function InvestorsTab() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const navigate = useNavigate();
  const stock = game.finance.stock;
  const offers = game.finance.fundingOffers;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Beteiligungsangebote" icon={<HandCoins size={16} />} subtitle="Investoren melden sich, wenn Umsatz und Wachstum überzeugen. Angebote verfallen nach 30 Tagen.">
        {stock.isPublic ? (
          <div className="space-y-2 text-sm text-muted">
            <p>Nach dem Börsengang erfolgt die Finanzierung über den Kapitalmarkt.</p>
            <Button size="xs" onClick={() => navigate('/game/stock')}>
              Zur Börse
            </Button>
          </div>
        ) : offers.length === 0 ? (
          <p className="text-sm text-muted">Derzeit liegen keine Angebote vor. Steigere Umsatz und Wachstum, um Investoren anzulocken.</p>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => {
              const postMoney = offer.amount / offer.equityShare;
              return (
                <div key={offer.id} className="rounded-lg border border-line bg-surface/40 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{offer.investor}</div>
                      <div className="text-xs text-muted">{offer.note}</div>
                    </div>
                    <Badge tone={offer.kind === 'vc' ? 'accent' : offer.kind === 'strategic' ? 'info' : 'neutral'}>{offer.kind === 'angel' ? 'Business Angel' : offer.kind === 'vc' ? 'Venture Capital' : 'Strategisch'}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted">Kapital</div>
                      <div className="font-semibold tabular">{formatMoney(offer.amount)}</div>
                    </div>
                    <div>
                      <div className="text-muted">Anteil</div>
                      <div className="font-semibold tabular">{formatPercent(offer.equityShare)}</div>
                    </div>
                    <div>
                      <div className="text-muted">Bewertung</div>
                      <div className="font-semibold tabular">{formatMoneyCompact(postMoney)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="xs" variant="success" onClick={() => execute((d) => acceptFunding(d, offer.id))}>
                      Annehmen
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => execute((d) => declineFunding(d, offer.id))}>
                      Ablehnen
                    </Button>
                    <span className="ml-auto text-[11px] text-muted">gültig bis {formatShortDate(offer.expiresDay)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card title="Gesellschafter" subtitle={`Gründer:in hält ${formatPercent(founderShare(game))} der Anteile.`} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Gesellschafter</th>
                <th className="px-3 py-2 text-right font-medium">Anteil</th>
                <th className="px-3 py-2 text-right font-medium">Investiert</th>
                <th className="px-3 py-2 text-right font-medium">Seit</th>
              </tr>
            </thead>
            <tbody>
              {game.finance.shareholders.map((holder) => (
                <tr key={holder.id} className="border-t border-line/50">
                  <td className="px-4 py-2">{holder.id === 'founder' ? `${game.company.ceoName} (Gründer:in)` : holder.name}</td>
                  <td className="px-3 py-2 text-right tabular">{formatPercent(holder.shares / stock.totalShares)}</td>
                  <td className="px-3 py-2 text-right tabular">{formatMoney(holder.invested)}</td>
                  <td className="px-3 py-2 text-right text-xs text-muted">{formatShortDate(holder.day)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function FinancePage() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const [tab, setTab] = useState<Tab>('pnl');
  const columns = pnlColumns(game, 5);
  const current = currentMonthFigures(game);
  const months = game.finance.months.slice(-24);
  const chartData = months.map((m) => ({ label: formatMonth(m.month), month: m.month, revenue: m.revenue, ebitda: m.ebitda, netIncome: m.netIncome, cash: m.cashEnd }));
  const daysLeft = insolvencyDaysLeft(game);
  const difficulty = DIFFICULTIES[game.difficulty];
  const hasEmergency = game.finance.loans.some((l) => l.kind === 'emergency');
  const debt = game.finance.loans.reduce((a, l) => a + l.remaining, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Finanzen" description="Gewinn- und Verlustrechnung, Cashflow, Bilanz, Kredite und Investoren." icon={<Wallet size={20} />} />

      {game.insolvency.stage !== 'ok' && (
        <Alert
          tone={game.insolvency.stage === 'warning' ? 'warn' : 'bad'}
          title={game.insolvency.stage === 'warning' ? 'Das Konto ist im Minus' : `Restrukturierung – ${daysLeft ?? 0} Tage bis zur Insolvenz`}
          action={
            difficulty.emergencyLoan && !hasEmergency ? (
              <Button size="xs" variant="danger" icon={<LifeBuoy size={13} />} onClick={() => execute(takeEmergencyLoan)}>
                Notkredit
              </Button>
            ) : undefined
          }
        >
          Senke Kosten (Personal, Marketing, Lager), verkaufe Bestände, nimm einen Kredit auf oder nimm ein Beteiligungsangebot an. Dispozinsen: 12 % plus Leitzins.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Kasse" value={formatMoneyCompact(game.finance.cash)} tone={game.finance.cash < 0 ? 'bad' : 'default'} />
        <StatCard label="Umsatz (Monat)" value={formatMoneyCompact(current.revenue)} hint="laufender Monat" />
        <StatCard label="EBITDA (Monat)" value={formatMoneyCompact(current.ebitda)} tone={current.ebitda < 0 ? 'warn' : 'default'} hint="laufender Monat" />
        <StatCard label="Verbindlichkeiten" value={formatMoneyCompact(debt)} hint={`Bonität ${game.finance.creditRating}`} />
        <StatCard label="Unternehmenswert" value={formatMoneyCompact(game.finance.valuation)} hint={`Höchststand ${formatMoneyCompact(game.finance.lifetime.peakValuation)}`} />
      </div>

      {months.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Umsatz und EBITDA je Monat">
            <ChartPanel
              chart={
                <TimeSeriesChart
                  data={chartData}
                  xKey="label"
                  series={[
                    { key: 'revenue', label: 'Umsatz' },
                    { key: 'ebitda', label: 'EBITDA' },
                  ]}
                  format={formatMoney}
                  axisFormat={formatMoneyCompact}
                />
              }
              table={{ columns: ['Monat', 'Umsatz', 'EBITDA'], rows: chartData.map((r) => [formatMonthLong(r.month), formatMoney(r.revenue), formatMoney(r.ebitda)]) }}
            />
          </Card>
          <Card title="Monatsergebnis">
            <ChartPanel
              chart={<SignedBarChart data={chartData} xKey="label" valueKey="netIncome" label="Monatsergebnis" format={formatMoney} axisFormat={formatMoneyCompact} height={220} />}
              table={{ columns: ['Monat', 'Ergebnis'], rows: chartData.map((r) => [formatMonthLong(r.month), formatMoney(r.netIncome)]) }}
            />
          </Card>
        </div>
      )}

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pnl', label: 'GuV' },
          { value: 'cashflow', label: 'Cashflow' },
          { value: 'balance', label: 'Bilanz' },
          { value: 'loans', label: `Kredite (${game.finance.loans.length})` },
          { value: 'investors', label: `Investoren${game.finance.fundingOffers.length ? ` (${game.finance.fundingOffers.length})` : ''}` },
        ]}
      />
      {tab === 'pnl' && <PnlTab columns={columns} />}
      {tab === 'cashflow' && <CashflowTab columns={columns} />}
      {tab === 'balance' && <BalanceTab />}
      {tab === 'loans' && <LoansTab />}
      {tab === 'investors' && <InvestorsTab />}
    </div>
  );
}
