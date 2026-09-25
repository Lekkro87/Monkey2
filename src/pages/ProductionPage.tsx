import { Factory, Hammer, Plus, Truck, UserPlus, Wrench } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES } from '@/data/categories';
import { CONTRACT_MANUFACTURERS } from '@/data/channels';
import { AUTOMATION_LEVELS, factoryCapacity, factoryWorkersNeeded, LINE_TYPES, QC_LEVELS, QC_ORDER, WORKSHOP_TOOLS } from '@/data/facilities';
import { FACTORY_LOCATIONS, getFactoryLocation } from '@/data/locations';
import { getTech } from '@/data/technologies';
import { LinesTable } from '@/components/production/LinesTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { Field, NumberInput, Select, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/Progress';
import { KeyValue, MiniStat } from '@/components/ui/Stat';
import { formatDate } from '@/simulation/calendar';
import { orderContractManufacturing, quoteContractManufacturing } from '@/systems/production/contractManufacturing';
import {
  automationCost,
  buildFactory,
  factoryBuildCost,
  factoryDailyCapacity,
  factoryUpgradePrice,
  installLineType,
  lineInstallCost,
  sellFactory,
  setAutomation,
  setQcLevel,
  upgradeFactory,
  upgradeWorkshopTools,
  workshopCapacity,
} from '@/systems/production/facilities';
import { hasTech, techEffects } from '@/systems/research/effects';
import { bulkHire, facilityWorkerLimit } from '@/systems/workforce/commands';
import { facilityHeadcount } from '@/systems/workforce/employees';
import { useGameStore } from '@/store/gameStore';
import type { AutomationLevel, Factory as FactoryType, ProductionLineType, QcLevelId } from '@/types';
import { formatMoney, formatNumber, formatPercent } from '@/utils/format';

function QcSelect({ facilityId, value }: { facilityId: string; value: QcLevelId }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const available = techEffects(game).qcLevels;
  return (
    <Select value={value} onChange={(e) => execute((d) => setQcLevel(d, facilityId, e.target.value as QcLevelId))} className="py-1.5">
      {QC_ORDER.map((id) => (
        <option key={id} value={id} disabled={!available.has(id)}>
          {QC_LEVELS[id].name} (+{formatMoney(QC_LEVELS[id].costPerUnit, 1)}/Stk., erkennt {formatPercent(QC_LEVELS[id].detection, 0)}){available.has(id) ? '' : ' – Forschung nötig'}
        </option>
      ))}
    </Select>
  );
}

function WorkshopCard() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const workshop = game.production.workshop;
  const tools = WORKSHOP_TOOLS[workshop.toolLevel];
  const next = WORKSHOP_TOOLS[workshop.toolLevel + 1];
  const capacity = workshopCapacity(game);
  const workers = facilityHeadcount(game, 'workshop');
  const limit = facilityWorkerLimit(game, 'workshop');
  return (
    <Card
      title="Werkstatt"
      subtitle={`${tools.name} · Handmontage von PCs${workshop.toolLevel >= 2 ? ', Servern und Monitoren' : ''}`}
      icon={<Wrench size={17} />}
      actions={
        next && (
          <Button size="xs" variant={workshop.toolLevel === 0 ? 'primary' : 'secondary'} icon={<Hammer size={13} />} onClick={() => execute(upgradeWorkshopTools)}>
            {next.name} kaufen ({formatMoney(next.cost * game.economy.priceLevel)})
          </Button>
        )
      }
    >
      {workshop.toolLevel === 0 ? (
        <Alert tone="warn" title="Ohne Werkzeug keine Produktion">
          Kaufe die Grundausstattung, um PCs von Hand zu montieren.
        </Alert>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Montagepersonal" value={`${workers}/${limit}`} hint={workers === 0 ? 'Gründer:in hilft aus' : undefined} />
            <MiniStat label="Kapazität" value={`${formatNumber(capacity.perDay, 1)} h/Tag`} hint={`≈ ${formatNumber(capacity.perDay / CATEGORIES.desktop.assemblyHours, 1)} Desktop-PCs/Tag`} />
            <MiniStat label="Tempo" value={formatPercent(capacity.speed, 0)} />
            <MiniStat label="Auslastung" value={formatPercent(game.stats.utilization, 0)} />
          </div>
          <Field label="Qualitätskontrolle">
            <QcSelect facilityId="workshop" value={workshop.qcLevel} />
          </Field>
          <LinesTable facilityId="workshop" />
        </div>
      )}
    </Card>
  );
}

function FactoryCard({ factory }: { factory: FactoryType }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const [confirmSell, setConfirmSell] = useState(false);
  const location = getFactoryLocation(factory.locationId);
  const capacity = factoryDailyCapacity(game, factory);
  const needed = factoryWorkersNeeded(factory.level, factory.automation);
  const workers = facilityHeadcount(game, factory.id);
  const effects = techEffects(game);
  const missingLineTypes = (Object.keys(LINE_TYPES) as ProductionLineType[]).filter((t) => !factory.lineTypes.includes(t));
  const [lineType, setLineType] = useState<ProductionLineType | ''>('');
  const building = factory.status !== 'operational';

  return (
    <Card
      title={factory.name}
      subtitle={`${location.name}, ${location.country} · Stufe ${factory.level} · ${formatNumber(factoryCapacity(factory.level))} Einheiten/Monat`}
      icon={<Factory size={17} />}
      actions={
        <div className="flex flex-wrap gap-1.5">
          {factory.status === 'operational' && factory.level < 10 && (
            <Button size="xs" onClick={() => execute((d) => upgradeFactory(d, factory.id))}>
              Ausbauen ({formatMoney(factoryUpgradePrice(game, factory))})
            </Button>
          )}
          <Button size="xs" variant="danger" onClick={() => setConfirmSell(true)}>
            Verkaufen
          </Button>
        </div>
      }
    >
      {building && (
        <div className="mb-3">
          <Alert tone="info" title={factory.status === 'construction' ? 'Im Bau' : `Ausbau auf Stufe ${factory.targetLevel}`}>
            Fertig am {formatDate(factory.readyDay)}.
          </Alert>
        </div>
      )}
      {factory.disruptedUntil !== undefined && factory.disruptedUntil > game.time.day && (
        <div className="mb-3">
          <Alert tone="bad">Produktionsausfall bis {formatDate(factory.disruptedUntil)} (Kapazität {formatPercent(factory.disruptionFactor ?? 0, 0)}).</Alert>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Personal" value={`${workers}/${needed}`} hint={<ProgressBar value={workers} max={needed} tone={workers >= needed ? 'good' : 'warn'} height="h-1" />} />
        <MiniStat label="Kapazität" value={`${formatNumber(capacity.perDay, 0)} Einh./Tag`} hint={`Besetzung ${formatPercent(Math.min(1, capacity.staffing), 0)}`} />
        <MiniStat label="Automatisierung" value={`${factory.automation} %`} />
        <MiniStat label="Qualitätsfaktor" value={formatPercent(location.qualityFactor, 0)} hint={`Löhne ${formatPercent(location.wageFactor, 0)} · Energie ${formatPercent(location.energyFactor, 0)}`} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Automatisierung">
          <Select value={factory.automation} onChange={(e) => execute((d) => setAutomation(d, factory.id, Number(e.target.value) as AutomationLevel))} className="py-1.5">
            {AUTOMATION_LEVELS.map((a) => {
              const cost = automationCost(game, factory, a.level);
              const available = effects.automation.has(a.level);
              return (
                <option key={a.level} value={a.level} disabled={!available}>
                  {a.level} % – {a.name} {cost > 0 ? `(${formatMoney(cost)})` : ''} {available ? '' : `– ${getTech(a.requiredTech ?? '')?.name ?? 'Forschung'} nötig`}
                </option>
              );
            })}
          </Select>
        </Field>
        <Field label="Qualitätskontrolle">
          <QcSelect facilityId={factory.id} value={factory.qcLevel} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Fertigungsausstattung:</span>
        {factory.lineTypes.map((t) => (
          <Badge key={t} tone="info">
            {LINE_TYPES[t].name}
          </Badge>
        ))}
        {missingLineTypes.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <Select value={lineType} onChange={(e) => setLineType(e.target.value as ProductionLineType)} className="w-auto py-1 text-xs">
              <option value="">Ausstattung ergänzen …</option>
              {missingLineTypes.map((t) => (
                <option key={t} value={t} disabled={!hasTech(game, LINE_TYPES[t].requiredTech)}>
                  {LINE_TYPES[t].name} ({formatMoney(lineInstallCost(game, factory, t))}){hasTech(game, LINE_TYPES[t].requiredTech) ? '' : ' – Forschung nötig'}
                </option>
              ))}
            </Select>
            <Button size="xs" disabled={!lineType} onClick={() => lineType && execute((d) => installLineType(d, factory.id, lineType)).ok && setLineType('')}>
              Installieren
            </Button>
          </div>
        )}
      </div>
      {!building && (
        <div className="mt-4">
          {workers < needed && (
            <div className="mb-3">
              <Alert
                tone="warn"
                title={`${needed - workers} Arbeitskräfte fehlen`}
                action={
                  <Button size="xs" icon={<UserPlus size={13} />} onClick={() => execute((d) => bulkHire(d, 'production', needed - workers, 'junior', factory.id))}>
                    Einstellen
                  </Button>
                }
              >
                Die Fabrik läuft nur mit {formatPercent(Math.min(1, workers / needed), 0)} ihrer Kapazität. Die Personalagentur besetzt die Stellen sofort.
              </Alert>
            </div>
          )}
          <LinesTable facilityId={factory.id} />
        </div>
      )}
      <Modal
        open={confirmSell}
        title={`${factory.name} verkaufen?`}
        onClose={() => setConfirmSell(false)}
        footer={
          <>
            <Button onClick={() => setConfirmSell(false)}>Abbrechen</Button>
            <Button variant="danger" onClick={() => execute((d) => sellFactory(d, factory.id)).ok && setConfirmSell(false)}>
              Verkaufen
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Erlös: {formatMoney(factory.bookValue * 0.4)} (40 % des Buchwerts). {workers} Beschäftigte werden mit Abfindung entlassen – das senkt die Motivation im ganzen Unternehmen.
        </p>
      </Modal>
    </Card>
  );
}

function BuildFactoryModal({ onClose }: { onClose: () => void }) {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const [locationId, setLocationId] = useState(FACTORY_LOCATIONS.find((l) => l.region === game.company.homeRegion)?.id ?? FACTORY_LOCATIONS[0].id);
  const [lineType, setLineType] = useState<ProductionLineType>('pc_assembly');
  const [name, setName] = useState('');
  const location = getFactoryLocation(locationId);
  const cost = factoryBuildCost(game, locationId, lineType);
  return (
    <Modal
      open
      width="lg"
      title="Neue Fabrik bauen"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-sm">
            Baukosten: <strong>{formatMoney(cost)}</strong> · Bauzeit 90 Tage
          </span>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" disabled={cost > game.finance.cash} onClick={() => execute((d) => buildFactory(d, locationId, lineType, name)).ok && onClose()}>
            Bau beauftragen
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Standort">
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {FACTORY_LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}, {l.country}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Erste Fertigungsausstattung">
          <Select value={lineType} onChange={(e) => setLineType(e.target.value as ProductionLineType)}>
            {(Object.keys(LINE_TYPES) as ProductionLineType[]).map((t) => (
              <option key={t} value={t} disabled={!hasTech(game, LINE_TYPES[t].requiredTech)}>
                {LINE_TYPES[t].name}
                {hasTech(game, LINE_TYPES[t].requiredTech) ? '' : ' – Forschung nötig'}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name (optional)" className="sm:col-span-2">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={`Werk ${location.name}`} maxLength={40} />
        </Field>
      </div>
      <div className="mt-4 rounded-lg border border-line/70 bg-surface/50 p-3 text-sm">
        <p className="mb-2 text-muted">{location.description}</p>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <KeyValue label="Baukostenfaktor" value={formatPercent(location.buildCostFactor, 0)} />
          <KeyValue label="Lohnniveau" value={formatPercent(location.wageFactor, 0)} />
          <KeyValue label="Energiekosten" value={formatPercent(location.energyFactor, 0)} />
          <KeyValue label="Qualitätsfaktor" value={formatPercent(location.qualityFactor, 0)} />
          <KeyValue label="Personalbedarf (Stufe 1)" value={`${factoryWorkersNeeded(1, 0)} Personen`} />
          <KeyValue label="Kapazität (Stufe 1)" value={`${formatNumber(factoryCapacity(1))} Einh./Monat`} />
        </div>
      </div>
    </Modal>
  );
}

function ContractManufacturingCard() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const products = game.products.filter((p) => p.status === 'ready' || p.status === 'on_sale');
  const [manufacturerId, setManufacturerId] = useState(CONTRACT_MANUFACTURERS[0].id);
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [quantity, setQuantity] = useState(500);
  const manufacturer = CONTRACT_MANUFACTURERS.find((m) => m.id === manufacturerId)!;
  const product = products.find((p) => p.id === productId);
  const supported = product ? manufacturer.lineTypes.includes(CATEGORIES[product.category].lineType) : false;
  const quote = product && supported ? quoteContractManufacturing(game, manufacturer, product, quantity) : null;
  const orders = game.supply.cmOrders.filter((o) => o.status === 'in_production');
  return (
    <Card title="Auftragsfertigung" subtitle="Ohne eigene Fabrik produzieren lassen – Komponenten stellst du bereit." icon={<Truck size={17} />}>
      {products.length === 0 ? (
        <p className="text-sm text-muted">Sobald ein Produkt fertig entwickelt ist, kannst du es hier fertigen lassen.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Fertiger">
              <Select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)}>
                {CONTRACT_MANUFACTURERS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Produkt">
              <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`Menge (min. ${formatNumber(manufacturer.minOrder)})`}>
              <NumberInput value={quantity} min={manufacturer.minOrder} step={100} onChange={(v) => setQuantity(Math.floor(v))} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">
            {manufacturer.description} Standort: {manufacturer.locationName}.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              {!supported ? (
                <span className="text-amber-300">Dieser Fertiger bietet keine passende Fertigungslinie.</span>
              ) : quote ? (
                <>
                  Gebühr {formatMoney(quote.unitFee, 2)}/Stk. · gesamt <strong>{formatMoney(quote.totalFee)}</strong> · Lieferung in {quote.readyInDays} Tagen
                </>
              ) : null}
            </div>
            <Button variant="primary" disabled={!quote} onClick={() => execute((d) => orderContractManufacturing(d, manufacturerId, productId, quantity))}>
              Auftrag erteilen
            </Button>
          </div>
        </>
      )}
      {orders.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-line/60 pt-3 text-sm">
          {orders.map((order) => (
            <li key={order.id} className="flex justify-between gap-2">
              <span>
                {formatNumber(order.quantity)} × {game.products.find((p) => p.id === order.productId)?.name} ({CONTRACT_MANUFACTURERS.find((m) => m.id === order.manufacturerId)?.name})
              </span>
              <span className="text-muted">Lieferung {formatDate(order.readyDay)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ProductionPage() {
  const factories = useGameStore((s) => s.game!.production.factories);
  const [building, setBuilding] = useState(false);
  return (
    <div>
      <PageHeader
        title="Produktion"
        description="Werkstatt, Fabriken, Produktionslinien, Automatisierung und Qualitätskontrolle."
        icon={<Factory size={20} />}
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setBuilding(true)}>
            Fabrik bauen
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <WorkshopCard />
        {factories.map((factory) => (
          <FactoryCard key={factory.id} factory={factory} />
        ))}
        <ContractManufacturingCard />
      </div>
      {building && <BuildFactoryModal onClose={() => setBuilding(false)} />}
    </div>
  );
}
