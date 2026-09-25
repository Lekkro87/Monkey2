import clsx from 'clsx';
import { Headphones, Megaphone, Play, Square, Store } from 'lucide-react';
import { useState } from 'react';
import { MARKETING_CHANNEL_IDS, MARKETING_CHANNELS, SALES_CHANNEL_IDS, SALES_CHANNELS } from '@/data/channels';
import { CATEGORIES } from '@/data/categories';
import { SUPPORT_LEVELS } from '@/data/facilities';
import { REGION_IDS, REGIONS } from '@/data/regions';
import { SEGMENT_IDS, SEGMENTS } from '@/data/segments';
import { getTech } from '@/data/technologies';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert, EmptyState } from '@/components/ui/Feedback';
import { Field, NumberInput, Segmented, Select } from '@/components/ui/Form';
import { ScoreBar } from '@/components/ui/Progress';
import { KeyValue, MiniStat, StatCard } from '@/components/ui/Stat';
import { formatDate } from '@/simulation/calendar';
import { channelRequirementError, closeSalesChannel, isChannelActive, openSalesChannel } from '@/systems/market/channels';
import { openRegions } from '@/systems/market/regions';
import { averageAwareness, BUDGET_PER_MARKETER, marketingMultiplier, startCampaign, stopCampaign } from '@/systems/marketing/marketing';
import { hasTech } from '@/systems/research/effects';
import { dailySupportCapacity, dailyTickets, setSupportLevel } from '@/systems/support/support';
import { departmentCapacity, departmentHeadcount } from '@/systems/workforce/employees';
import { useGameStore } from '@/store/gameStore';
import type { MarketingChannelId, RegionId } from '@/types';
import { formatMoney, formatMoneyCompact, formatNumber, formatPercent } from '@/utils/format';

type Tab = 'campaigns' | 'brand' | 'channels' | 'support';

const DURATIONS = [7, 14, 30, 60, 90];

function NewCampaignCard() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const regions = openRegions(game);
  const [channelId, setChannelId] = useState<MarketingChannelId>('online_ads');
  const [region, setRegion] = useState<RegionId>(regions[0] ?? game.company.homeRegion);
  const [budget, setBudget] = useState(200);
  const [duration, setDuration] = useState(30);
  const [productId, setProductId] = useState('');
  const channel = MARKETING_CHANNELS[channelId];
  const products = game.products.filter((p) => p.status === 'on_sale' || p.status === 'ready');
  const locked = game.company.stage < channel.minStage;
  const total = budget * duration;
  const firstWeek = budget * Math.min(7, duration);
  const budgetError = budget < channel.minDailyBudget ? `Mindestens ${formatMoney(channel.minDailyBudget)} pro Tag.` : budget > channel.maxDailyBudget ? `Höchstens ${formatMoney(channel.maxDailyBudget)} pro Tag.` : null;

  const submit = () => execute((d) => startCampaign(d, channelId, region, budget, duration, productId || undefined));

  return (
    <Card title="Neue Kampagne" icon={<Megaphone size={16} />} subtitle="Kampagnen steigern die Bekanntheit in den Zielgruppen des Kanals. Produktkampagnen erzeugen zusätzlich Hype für ein Gerät.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kanal">
          <Select value={channelId} onChange={(e) => { const id = e.target.value as MarketingChannelId; setChannelId(id); setBudget(Math.max(budget, MARKETING_CHANNELS[id].minDailyBudget)); }}>
            {MARKETING_CHANNEL_IDS.map((id) => (
              <option key={id} value={id} disabled={game.company.stage < MARKETING_CHANNELS[id].minStage}>
                {MARKETING_CHANNELS[id].name}
                {game.company.stage < MARKETING_CHANNELS[id].minStage ? ` (ab Stufe ${MARKETING_CHANNELS[id].minStage})` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Region">
          <Select value={region} onChange={(e) => setRegion(e.target.value as RegionId)}>
            {regions.map((r) => (
              <option key={r} value={r}>
                {REGIONS[r].name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Beworbenes Produkt">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Markenkampagne (alle Produkte)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Budget pro Tag" hint={`${formatMoney(channel.minDailyBudget)} – ${formatMoneyCompact(channel.maxDailyBudget)}`}>
          <NumberInput value={budget} min={channel.minDailyBudget} max={channel.maxDailyBudget} step={50} suffix="€" onChange={(v) => setBudget(Math.max(0, Math.round(v)))} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Laufzeit">
          <Segmented<number> value={duration} onChange={setDuration} options={DURATIONS.map((d) => ({ value: d, label: `${d} T.` }))} />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted">{channel.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {SEGMENT_IDS.filter((s) => channel.segmentAffinity[s] >= 1.2).map((s) => (
          <Badge key={s} tone="info">
            stark bei {SEGMENTS[s].name}
          </Badge>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-line/60 bg-surface/40 px-3 py-2">
        <KeyValue label="Gesamtbudget" value={formatMoney(total)} />
        <KeyValue label="Bedarf an Marketing-Personal" value={`${formatNumber(budget / BUDGET_PER_MARKETER, 1)} Vollzeitkräfte`} />
      </div>
      <Button variant="primary" className="mt-3 w-full" icon={<Play size={14} />} disabled={locked || !!budgetError || firstWeek > game.finance.cash || regions.length === 0} onClick={submit}>
        Kampagne starten
      </Button>
      {budgetError && <p className="mt-2 text-xs text-red-400">{budgetError}</p>}
      {!budgetError && firstWeek > game.finance.cash && <p className="mt-2 text-xs text-red-400">Nicht genügend Kapital für die erste Woche ({formatMoney(firstWeek)}).</p>}
    </Card>
  );
}

function CampaignsTab() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const day = game.time.day;
  const campaigns = [...game.marketing.campaigns].sort((a, b) => b.startDay - a.startDay);
  const multiplier = marketingMultiplier(game);
  const activeBudget = campaigns.filter((c) => c.endDay > day).reduce((a, c) => a + c.dailyBudget, 0);
  const capacity = departmentCapacity(game, 'marketing') * BUDGET_PER_MARKETER;
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <div className="xl:col-span-2">
        <NewCampaignCard />
      </div>
      <div className="space-y-4 xl:col-span-3">
        {activeBudget > capacity * 1.05 && activeBudget / BUDGET_PER_MARKETER >= 0.2 && (
          <Alert tone="warn" title="Zu wenig Marketing-Personal">
            Das Team kann etwa {formatMoney(capacity)} pro Tag wirksam steuern, eingesetzt werden {formatMoney(activeBudget)}. Die Wirkung sinkt auf {formatPercent(multiplier, 0)}.
          </Alert>
        )}
        <Card title="Kampagnen" subtitle={`Wirksamkeit ${formatPercent(multiplier, 0)} · ${formatMoney(activeBudget)} pro Tag aktiv`} bodyClassName="p-0">
          {campaigns.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={<Megaphone size={26} />} title="Keine Kampagnen" description="Ohne Werbung kennt kaum jemand deine Marke – schon kleine Budgets in Online-Werbung oder Social Media helfen." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-panel-2 text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Kanal</th>
                    <th className="px-3 py-2 text-left font-medium">Ziel</th>
                    <th className="px-3 py-2 text-right font-medium">Budget/Tag</th>
                    <th className="px-3 py-2 text-right font-medium">Ausgegeben</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const active = c.endDay > day;
                    const product = c.productId ? game.products.find((p) => p.id === c.productId) : undefined;
                    return (
                      <tr key={c.id} className={clsx('border-t border-line/50', !active && 'opacity-55')}>
                        <td className="px-4 py-2 font-medium">{MARKETING_CHANNELS[c.channel].name}</td>
                        <td className="px-3 py-2 text-xs">
                          <div>{REGIONS[c.region].name}</div>
                          <div className="text-muted">{product ? product.name : 'Marke'}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular">{formatMoney(c.dailyBudget)}</td>
                        <td className="px-3 py-2 text-right tabular">{formatMoney(c.spent)}</td>
                        <td className="px-3 py-2 text-xs">{active ? <Badge tone="good">noch {c.endDay - day} T.</Badge> : <span className="text-muted">beendet {formatDate(c.endDay)}</span>}</td>
                        <td className="px-3 py-2 text-right">
                          {active && (
                            <Button size="xs" variant="ghost" icon={<Square size={11} />} onClick={() => execute((d) => stopCampaign(d, c.id))}>
                              Stoppen
                            </Button>
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
      </div>
    </div>
  );
}

function BrandTab() {
  const game = useGameStore((s) => s.game!);
  const brand = game.brand;
  const regions = REGION_IDS.filter((r) => game.company.regions[r].status !== 'closed');
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card title="Markenwerte" className="lg:col-span-2" subtitle="Markenwerte wirken je nach Zielgruppe unterschiedlich auf die Kaufentscheidung.">
        <div className="space-y-3">
          <ScoreBar label="Reputation" value={brand.reputation} hint="Aus Zufriedenheit, Vertrauen und Testberichten" />
          <ScoreBar label="Kundenzufriedenheit" value={brand.satisfaction} hint="Support, Lieferfähigkeit, Qualität und Bewertungen" />
          <ScoreBar label="Vertrauen" value={brand.trust} />
          <ScoreBar label="Premium-Image" value={brand.premium} />
          <ScoreBar label="Innovation" value={brand.innovation} />
          <ScoreBar label="Gaming" value={brand.gaming} />
          <ScoreBar label="Business" value={brand.business} />
        </div>
      </Card>
      <Card title="Markenbekanntheit" className="lg:col-span-3" subtitle="Anteil der Zielgruppe, der die Marke kennt. Bekanntheit verblasst ohne Werbung langsam." bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Zielgruppe</th>
                {regions.map((r) => (
                  <th key={r} className="px-3 py-2 text-right font-medium">
                    {REGIONS[r].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SEGMENT_IDS.map((s) => (
                <tr key={s} className="border-t border-line/50">
                  <td className="px-4 py-2">
                    <div>{SEGMENTS[s].name}</div>
                    <div className="text-[11px] text-muted">{SEGMENTS[s].description}</div>
                  </td>
                  {regions.map((r) => {
                    const value = brand.awareness[r][s];
                    return (
                      <td key={r} className="px-3 py-2 text-right tabular" style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(Math.min(1, value * 2.5) * 35)}%, transparent)` }}>
                        {formatPercent(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-line bg-white/[0.02] font-semibold">
                <td className="px-4 py-2">Durchschnitt</td>
                {regions.map((r) => (
                  <td key={r} className="px-3 py-2 text-right tabular">
                    {formatPercent(averageAwareness(game, r))}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ChannelsTab() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const salesStaff = departmentHeadcount(game, 'sales');
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Jeder Kanal erreicht andere Zielgruppen. Händler verlangen einen Anteil am Verkaufspreis, übernehmen dafür aber einen Teil des Versands. Aktuell {salesStaff} Vertriebsmitarbeitende.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SALES_CHANNEL_IDS.map((id) => {
          const channel = SALES_CHANNELS[id];
          const active = isChannelActive(game, id);
          const error = active ? null : channelRequirementError(game, id);
          const since = game.company.salesChannels[id];
          return (
            <Card
              key={id}
              title={channel.name}
              icon={<Store size={15} />}
              actions={active ? <Badge tone="good">aktiv seit {formatDate(since ?? 0)}</Badge> : <Badge>inaktiv</Badge>}
            >
              <p className="text-sm text-muted">{channel.description}</p>
              {channel.categories && <p className="mt-1 text-xs text-muted">Nur für: {channel.categories.map((c) => CATEGORIES[c].name).join(', ')}</p>}
              <div className="mt-3 rounded-lg border border-line/60 bg-surface/40 px-3 py-1.5">
                <KeyValue label="Einrichtung" value={formatMoney(channel.setupCost * game.economy.priceLevel)} />
                <KeyValue label="Laufende Kosten" value={`${formatMoney(channel.monthlyCost * game.economy.priceLevel)}/Mon.`} />
                <KeyValue label="Händlermarge" value={formatPercent(channel.marginCut, 0)} />
                <KeyValue label="Eigener Versandanteil" value={formatPercent(channel.fulfillmentShare, 0)} />
              </div>
              <div className="mt-3 space-y-1">
                {SEGMENT_IDS.map((s) => (
                  <div key={s} className="grid grid-cols-[110px_1fr_36px] items-center gap-2 text-[11px]">
                    <span className="truncate text-muted">{SEGMENTS[s].name}</span>
                    <div className="h-1.5 rounded-full bg-white/5">
                      <div className="h-full rounded-full accent-bg" style={{ width: `${channel.coverage[s] * 100}%` }} />
                    </div>
                    <span className="text-right tabular">{formatPercent(channel.coverage[s], 0)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                {active ? (
                  <Button size="xs" variant="ghost" onClick={() => execute((d) => closeSalesChannel(d, id))}>
                    Kanal beenden
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="xs" variant="primary" disabled={!!error} onClick={() => execute((d) => openSalesChannel(d, id))}>
                      Kanal eröffnen
                    </Button>
                    {error && <span className="text-[11px] text-amber-300">{error}</span>}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SupportTab() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const support = game.company.support;
  const tickets = dailyTickets(game);
  const capacity = dailySupportCapacity(game);
  const agents = departmentHeadcount(game, 'support');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Anfragen pro Tag" value={formatNumber(tickets, 1)} />
        <MiniStat label="Kapazität pro Tag" value={formatNumber(capacity, 1)} hint={`${agents} Support-Mitarbeitende`} />
        <MiniStat label="Servicelevel" value={formatPercent(Math.min(1, support.serviceLevel), 0)} />
        <MiniStat label="Kundenzufriedenheit" value={formatNumber(game.brand.satisfaction)} />
      </div>
      {tickets > capacity * 1.05 && tickets > 0.5 && (
        <Alert tone="warn" title="Support überlastet">
          Kund:innen warten auf Antworten – die Zufriedenheit sinkt. Stelle Support-Mitarbeitende ein (je Person ca. {formatNumber(capacity / Math.max(1, agents), 0)} Anfragen pro Tag).
        </Alert>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SUPPORT_LEVELS.map((level) => {
          const active = support.level === level.id;
          const unlocked = hasTech(game, level.requiredTech);
          return (
            <Card key={level.id} title={level.name} icon={<Headphones size={15} />} actions={active ? <Badge tone="good">aktiv</Badge> : undefined} className={clsx(active && 'accent-border')}>
              <p className="text-sm text-muted">{level.description}</p>
              <div className="mt-3 rounded-lg border border-line/60 bg-surface/40 px-3 py-1.5">
                <KeyValue label="Kosten je Anfrage" value={formatMoney(level.costPerTicket * game.economy.priceLevel)} />
                <KeyValue label="Zufriedenheit" value={`+${level.satisfactionBonus}`} />
                {level.subscriptionPrice > 0 && <KeyValue label="Service-Abo" value={`${formatMoney(level.subscriptionPrice, 2)}/Mon.`} />}
              </div>
              {!active && (
                <Button size="xs" variant="primary" className="mt-3" disabled={!unlocked} onClick={() => execute((d) => setSupportLevel(d, level.id))}>
                  {unlocked ? 'Aktivieren' : `Forschung: ${getTech(level.requiredTech!)?.name ?? ''}`}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function MarketingPage() {
  const game = useGameStore((s) => s.game!);
  const [tab, setTab] = useState<Tab>('campaigns');
  const day = game.time.day;
  const activeCampaigns = game.marketing.campaigns.filter((c) => c.endDay > day);
  const dailyBudget = activeCampaigns.reduce((a, c) => a + c.dailyBudget, 0);
  const channels = SALES_CHANNEL_IDS.filter((id) => isChannelActive(game, id)).length;
  return (
    <div className="space-y-5">
      <PageHeader title="Marketing & Vertrieb" description="Kampagnen, Markenaufbau, Vertriebskanäle und Kundenservice." icon={<Megaphone size={20} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bekanntheit (Heimat)" value={formatPercent(averageAwareness(game))} hint={REGIONS[game.company.homeRegion].name} />
        <StatCard label="Reputation" value={formatNumber(game.brand.reputation)} tone={game.brand.reputation < 35 ? 'bad' : 'default'} />
        <StatCard label="Werbebudget" value={`${formatMoney(dailyBudget)}/Tag`} hint={`${activeCampaigns.length} aktive Kampagnen · ${formatMoneyCompact(game.marketing.spentTotal)} gesamt`} />
        <StatCard label="Vertriebskanäle" value={`${channels}/${SALES_CHANNEL_IDS.length}`} />
      </div>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'campaigns', label: 'Kampagnen' },
          { value: 'brand', label: 'Marke' },
          { value: 'channels', label: 'Vertriebskanäle' },
          { value: 'support', label: 'Kundenservice' },
        ]}
      />
      {tab === 'campaigns' && <CampaignsTab />}
      {tab === 'brand' && <BrandTab />}
      {tab === 'channels' && <ChannelsTab />}
      {tab === 'support' && <SupportTab />}
    </div>
  );
}
