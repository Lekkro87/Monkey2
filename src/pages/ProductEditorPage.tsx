import clsx from 'clsx';
import { ArrowLeft, ChevronDown, ChevronRight, FlaskConical, Lock, Rocket, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CATEGORIES, CATEGORY_IDS } from '@/data/categories';
import { PRODUCT_TEMPLATES } from '@/data/templates';
import { getTech } from '@/data/technologies';
import { CategoryIcon } from '@/components/icons';
import { ComponentPicker } from '@/components/products/ComponentPicker';
import { AttributeGrid, SpecList } from '@/components/products/ProductInfo';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { Field, NumberInput, Segmented, TextInput } from '@/components/ui/Form';
import { KeyValue } from '@/components/ui/Stat';
import { getManufacturerName } from '@/services/brandLicense';
import {
  computeDevelopmentPlan,
  createProductDraft,
  developmentRequirementError,
  resolveTemplateComponents,
  startDevelopment,
  updateProductDraft,
  type ProductDraftInput,
} from '@/systems/products/commands';
import { DEV_BUDGET_LEVELS, estimateDevQuality, evaluateDesign } from '@/systems/products/design';
import { isCategoryUnlocked } from '@/systems/research/effects';
import { useGameStore } from '@/store/gameStore';
import type { DevBudgetLevel, ProductCategoryId, SlotKey } from '@/types';
import { formatDays, formatMoney, formatNumber, formatPercent } from '@/utils/format';
import { HOURS_PER_DAY } from '@/data/departments';
import { departmentCapacity } from '@/systems/workforce/employees';

interface DraftState {
  name: string;
  category: ProductCategoryId;
  components: Partial<Record<SlotKey, string>>;
  price: number;
  devBudgetLevel: DevBudgetLevel;
  templateId?: string;
}

function defaultComponents(game: NonNullable<ReturnType<typeof useGameStore.getState>['game']>, category: ProductCategoryId): Partial<Record<SlotKey, string>> {
  const template = PRODUCT_TEMPLATES.find((t) => t.category === category);
  return template ? resolveTemplateComponents(game, template.id) : {};
}

export default function ProductEditorPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const [params] = useSearchParams();
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const existing = productId ? game.products.find((p) => p.id === productId) : undefined;

  const [draft, setDraft] = useState<DraftState>(() => {
    if (existing) {
      return { name: existing.name, category: existing.category, components: { ...existing.components }, price: existing.price, devBudgetLevel: existing.devBudgetLevel, templateId: existing.templateId };
    }
    const templateId = params.get('template');
    const template = PRODUCT_TEMPLATES.find((t) => t.id === templateId) ?? PRODUCT_TEMPLATES[0];
    return { name: template.name, category: template.category, components: resolveTemplateComponents(game, template.id), price: template.price, devBudgetLevel: template.devBudgetLevel, templateId: template.id };
  });
  const [showMinor, setShowMinor] = useState(false);

  const category = CATEGORIES[draft.category];
  const devQuality = estimateDevQuality(game, draft.devBudgetLevel);
  const evaluation = useMemo(() => evaluateDesign(game, draft.category, draft.components, devQuality), [game, draft.category, draft.components, devQuality]);
  const plan = computeDevelopmentPlan(game, draft.category, draft.devBudgetLevel, !!existing?.predecessorId);
  const requirementError = developmentRequirementError(game, draft.category);
  const devHoursPerDay = (departmentCapacity(game, 'engineering') + departmentCapacity(game, 'hardware') + departmentCapacity(game, 'software')) * HOURS_PER_DAY;
  const estimatedDays = devHoursPerDay > 0 ? Math.ceil(plan.totalEffort / devHoursPerDay + category.certificationDays) : null;
  const margin = draft.price > 0 ? (draft.price - evaluation.unitCost - category.fulfillmentCost) / draft.price : 0;
  const suggested = Math.round((evaluation.unitCost * 1.32 + category.fulfillmentCost) / 10) * 10 - 1;
  const unlocked = isCategoryUnlocked(game, draft.category);
  const templates = PRODUCT_TEMPLATES.filter((t) => t.category === draft.category);
  const majorSlots = category.slots.filter((s) => !s.minor);
  const minorSlots = category.slots.filter((s) => s.minor);

  const input: ProductDraftInput = { ...draft };

  const saveDraft = (thenDevelop: boolean) => {
    let id = existing?.id ?? '';
    const result = execute((d) => {
      if (existing) updateProductDraft(d, existing.id, input);
      else id = createProductDraft(d, input);
      if (thenDevelop) return startDevelopment(d, id);
      return existing ? `Entwurf „${draft.name}“ gespeichert.` : `Entwurf „${draft.name}“ angelegt.`;
    });
    if (result.ok) navigate(`/game/products/${id}`);
  };

  const selectCategory = (id: ProductCategoryId) => {
    const template = PRODUCT_TEMPLATES.find((t) => t.category === id);
    setDraft({
      name: template?.name ?? `Neues ${CATEGORIES[id].name}-Modell`,
      category: id,
      components: defaultComponents(game, id),
      price: template?.price ?? CATEGORIES[id].referencePrice,
      devBudgetLevel: template?.devBudgetLevel ?? 'standard',
      templateId: template?.id,
    });
  };

  return (
    <div>
      <button type="button" onClick={() => navigate(-1)} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Zurück
      </button>
      <PageHeader title={existing ? `Entwurf bearbeiten: ${existing.name}` : 'Neues Produkt entwerfen'} description="Komponenten wählen, Preis festlegen, Entwicklung starten. Jede Entscheidung verändert Leistung, Kosten und Qualität." />

      {!existing && (
        <Card title="Produktkategorie" className="mb-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {CATEGORY_IDS.map((id) => {
              const def = CATEGORIES[id];
              const isUnlocked = isCategoryUnlocked(game, id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectCategory(id)}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition',
                    draft.category === id ? 'accent-border bg-white/5' : 'border-line hover:border-slate-500',
                    !isUnlocked && 'opacity-60',
                  )}
                >
                  <CategoryIcon category={id} className={draft.category === id ? 'accent-text' : 'text-muted'} />
                  <span className="flex-1 truncate">{def.name}</span>
                  {!isUnlocked && <Lock size={12} className="text-muted" />}
                </button>
              );
            })}
          </div>
          {!unlocked && category.unlockTech && (
            <div className="mt-3">
              <Alert tone="warn" title={`${category.pluralName} sind noch gesperrt`} action={<Button size="xs" icon={<FlaskConical size={13} />} onClick={() => navigate('/game/research')}>Forschung</Button>}>
                Benötigte Technologie: „{getTech(category.unlockTech)?.name}“. Du kannst trotzdem schon planen.
              </Alert>
            </div>
          )}
          {templates.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted">Vorlagen:</span>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.description}
                  onClick={() => setDraft({ name: t.name, category: t.category, components: resolveTemplateComponents(game, t.id), price: t.price, devBudgetLevel: t.devBudgetLevel, templateId: t.id })}
                  className={clsx('rounded-md border px-2 py-1 transition', draft.templateId === t.id ? 'accent-border text-ink' : 'border-line text-muted hover:text-ink')}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <Card title="Grunddaten">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Produktname" className="sm:col-span-2">
                <TextInput value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Verkaufspreis" hint={`Vorschlag: ${formatMoney(suggested)}`}>
                <NumberInput value={draft.price} min={1} step={10} suffix="€" onChange={(price) => setDraft({ ...draft, price })} />
              </Field>
            </div>
            <div className="mt-4">
              <span className="text-xs font-medium text-muted">Entwicklungsbudget</span>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <Segmented
                  value={draft.devBudgetLevel}
                  onChange={(devBudgetLevel) => setDraft({ ...draft, devBudgetLevel })}
                  options={(Object.keys(DEV_BUDGET_LEVELS) as DevBudgetLevel[]).map((level) => ({ value: level, label: DEV_BUDGET_LEVELS[level].name }))}
                />
                <span className="text-xs text-muted">Höheres Budget → bessere Qualität, Zuverlässigkeit und Design.</span>
              </div>
            </div>
          </Card>

          <Card title="Komponenten" subtitle={`${category.name}: Hersteller und Modelle wählen`}>
            <div className="grid gap-2.5 md:grid-cols-2">
              {majorSlots.map((slot) => (
                <ComponentPicker key={slot.key} slot={slot} value={draft.components[slot.key]} onChange={(id) => setDraft({ ...draft, components: { ...draft.components, [slot.key]: id } })} />
              ))}
            </div>
            {minorSlots.length > 0 && (
              <div className="mt-4">
                <button type="button" onClick={() => setShowMinor((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                  {showMinor ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Standardteile ({minorSlots.length})
                </button>
                {showMinor && (
                  <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
                    {minorSlots.map((slot) => (
                      <ComponentPicker key={slot.key} slot={slot} value={draft.components[slot.key]} onChange={(id) => setDraft({ ...draft, components: { ...draft.components, [slot.key]: id } })} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Bewertung" subtitle={`Geschätzte Entwicklungsqualität ${formatNumber(devQuality)}/100`}>
            <AttributeGrid category={draft.category} attributes={evaluation.attributes} columns={1} />
          </Card>
          <Card title="Technische Daten">
            <SpecList specs={evaluation.specs} />
          </Card>
          <Card title="Kalkulation">
            <div className="divide-y divide-line/50">
              <KeyValue label="Materialkosten" value={formatMoney(evaluation.materialCost)} />
              {evaluation.licenseCost > 0 && <KeyValue label="Betriebssystem-Lizenz" value={formatMoney(evaluation.licenseCost)} />}
              <KeyValue label="Versand an Kunden (Onlineshop)" value={formatMoney(category.fulfillmentCost)} />
              <KeyValue label="Stückkosten gesamt" value={<strong>{formatMoney(evaluation.unitCost + category.fulfillmentCost)}</strong>} />
              <KeyValue label="Marge bei Direktverkauf" value={<span className={margin < 0.1 ? 'text-red-400' : margin < 0.2 ? 'text-amber-300' : 'text-emerald-300'}>{formatPercent(margin)}</span>} />
              <KeyValue label="Erwartete Ausfallrate" value={formatPercent(evaluation.defectRate, 1)} />
            </div>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted hover:text-ink">Stückliste anzeigen</summary>
              <ul className="mt-2 space-y-1">
                {evaluation.costLines.map((line) => (
                  <li key={line.slot} className="flex justify-between gap-2">
                    <span className="truncate text-muted">
                      {line.quantity > 1 ? `${line.quantity}× ` : ''}
                      {getManufacturerName(game.components.skus[line.skuId]?.manufacturerId ?? '')} {line.name}
                    </span>
                    <span className="tabular">{formatMoney(line.total, 2)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </Card>
          <Card title="Entwicklung">
            <div className="divide-y divide-line/50">
              <KeyValue label="Entwicklungsbudget (inkl. Werkzeuge & Zertifizierung)" value={formatMoney(plan.totalBudget)} />
              <KeyValue label="Aufwand" value={`${formatNumber(plan.totalEffort)} Ingenieurstunden`} />
              <KeyValue label="Geschätzte Dauer" value={estimatedDays ? `ca. ${formatDays(estimatedDays)}` : 'kein Entwicklungsteam'} />
            </div>
            <div className="mt-3 space-y-2">
              {evaluation.errors.map((e) => (
                <Alert key={e.message} tone="bad">
                  {e.message}
                </Alert>
              ))}
              {evaluation.warnings.map((w) => (
                <Alert key={w.message} tone="warn">
                  {w.message}
                </Alert>
              ))}
              {requirementError && <Alert tone="warn">{requirementError}</Alert>}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button icon={<Save size={14} />} onClick={() => saveDraft(false)} disabled={!evaluation.valid}>
                Entwurf speichern
              </Button>
              <Button variant="primary" icon={<Rocket size={14} />} onClick={() => saveDraft(true)} disabled={!evaluation.valid || !unlocked}>
                Entwicklung starten
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
