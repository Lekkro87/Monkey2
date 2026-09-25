import { Download, FolderOpen, KeyRound, LogOut, Save, Settings, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MANUFACTURERS } from '@/data/manufacturers';
import { CompanyLogo } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { Field, Segmented, TextInput, Toggle } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { KeyValue } from '@/components/ui/Stat';
import { formatDate } from '@/simulation/calendar';
import { applyBrandLicense, getBrandLicense, validateBrandLicense, type BrandLicenseConfig } from '@/services/brandLicense';
import { AUTOSAVE_SLOT, MANUAL_SLOTS, slotLabel } from '@/services/saveService';
import type { SaveMeta } from '@/services/storage/types';
import { AUTOSAVE_OPTIONS, updateSettings } from '@/systems/settings/settings';
import { STAGE_NAMES } from '@/systems/company/company';
import { useGameStore } from '@/store/gameStore';
import { formatMoneyCompact } from '@/utils/format';

const LICENSE_EXAMPLE = `{
  "licensed": true,
  "licensee": "Beispiel Verlag GmbH",
  "validUntil": "2030-12-31",
  "manufacturers": {
    "novasilicon": { "displayName": "Lizenzierter Markenname" }
  }
}`;

function SavesCard() {
  const game = useGameStore((s) => s.game!);
  const saveService = useGameStore((s) => s.saveService);
  const saveGame = useGameStore((s) => s.saveGame);
  const loadState = useGameStore((s) => s.loadState);
  const pushToast = useGameStore((s) => s.pushToast);
  const saving = useGameStore((s) => s.saving);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [revision, setRevision] = useState(0);
  const [label, setLabel] = useState('');
  const [confirmSlot, setConfirmSlot] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    saveService
      .list()
      .then((list) => !cancelled && setSaves(list))
      .catch(() => !cancelled && setSaves([]));
    return () => {
      cancelled = true;
    };
  }, [saveService, revision]);

  const refresh = () => setRevision((r) => r + 1);

  const byId = new Map(saves.map((s) => [s.slotId, s]));

  const save = async (slotId: string) => {
    const ok = await saveGame(slotId, label);
    if (ok) {
      setLabel('');
      refresh();
    }
    setConfirmSlot(null);
  };

  const load = async (slotId: string) => {
    try {
      loadState(await saveService.load(slotId));
      pushToast('success', `${slotLabel(slotId)} geladen.`);
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Laden fehlgeschlagen.');
    }
  };

  const remove = async (slotId: string) => {
    await saveService.remove(slotId);
    refresh();
    pushToast('info', `${slotLabel(slotId)} gelöscht.`);
  };

  const exportFile = () => {
    const blob = new Blob([saveService.exportJson(game)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tech-empire-${game.company.name.replace(/[^\w-]+/g, '_')}-tag-${game.time.day}.json`;
    link.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Spielstand exportiert.');
  };

  const importFile = async (file: File) => {
    try {
      loadState(saveService.importJson(await file.text()));
      pushToast('success', 'Spielstand importiert.');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Import fehlgeschlagen.');
    }
  };

  const slots = [...MANUAL_SLOTS, AUTOSAVE_SLOT];

  return (
    <Card title="Spielstände" icon={<Save size={16} />} subtitle={`Speicherort: ${saveService.backendName} · weitere Speicher-Backends (z. B. Cloud) lassen sich über die StorageProvider-Schnittstelle ergänzen.`}>
      <Field label="Bezeichnung für neue Speicherung (optional)">
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`${game.company.name} – ${formatDate(game.time.day)}`} maxLength={60} />
      </Field>
      <ul className="mt-3 space-y-2">
        {slots.map((slotId) => {
          const meta = byId.get(slotId);
          const isAuto = slotId === AUTOSAVE_SLOT;
          return (
            <li key={slotId} className="flex flex-wrap items-center gap-3 rounded-xl border border-line/70 bg-surface/50 p-3">
              {meta ? <CompanyLogo logo={meta.logo} color={meta.color} size={34} /> : <div className="h-[34px] w-[34px] rounded-xl border border-dashed border-line" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {slotLabel(slotId)}
                  {isAuto && <Badge tone="info">automatisch</Badge>}
                </div>
                {meta ? (
                  <div className="text-xs text-muted">
                    {meta.label} · Stufe {meta.stage} ({STAGE_NAMES[meta.stage]}) · {formatMoneyCompact(meta.cash)} · {new Date(meta.savedAt).toLocaleString('de-DE')}
                  </div>
                ) : (
                  <div className="text-xs text-muted">leer</div>
                )}
              </div>
              <div className="flex gap-1">
                {!isAuto && (
                  <Button size="xs" variant="primary" icon={<Save size={12} />} disabled={saving} onClick={() => (meta ? setConfirmSlot(slotId) : void save(slotId))}>
                    Speichern
                  </Button>
                )}
                {meta && (
                  <Button size="xs" icon={<FolderOpen size={12} />} onClick={() => void load(slotId)}>
                    Laden
                  </Button>
                )}
                {meta && <Button size="xs" variant="ghost" icon={<Trash2 size={12} />} aria-label="Löschen" onClick={() => void remove(slotId)} />}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button icon={<Download size={14} />} onClick={exportFile}>
          Als JSON exportieren
        </Button>
        <Button icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
          JSON importieren
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
      </div>
      {confirmSlot && (
        <Modal
          open
          width="sm"
          title="Spielstand überschreiben?"
          onClose={() => setConfirmSlot(null)}
          footer={
            <>
              <Button onClick={() => setConfirmSlot(null)}>Abbrechen</Button>
              <Button variant="primary" onClick={() => void save(confirmSlot)}>
                Überschreiben
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">„{byId.get(confirmSlot)?.label}“ wird durch den aktuellen Spielstand ersetzt.</p>
        </Modal>
      )}
    </Card>
  );
}

function GameSettingsCard() {
  const game = useGameStore((s) => s.game!);
  const execute = useGameStore((s) => s.execute);
  const settings = game.settings;
  return (
    <Card title="Spiel" icon={<Settings size={16} />}>
      <div className="space-y-4">
        <Field label="Automatisch speichern">
          <Segmented<number>
            value={settings.autosaveIntervalDays}
            onChange={(v) => execute((d) => updateSettings(d, { autosaveIntervalDays: v }), { silent: true })}
            options={AUTOSAVE_OPTIONS.map((v) => ({ value: v, label: v === 0 ? 'Aus' : `alle ${v} Tage` }))}
          />
        </Field>
        <Toggle checked={settings.pauseOnDecision} label="Bei wichtigen Entscheidungen (z. B. Rückrufe) pausieren" onChange={(v) => execute((d) => updateSettings(d, { pauseOnDecision: v }), { silent: true })} />
        <Toggle checked={settings.pauseOnCritical} label="Bei Zahlungsschwierigkeiten pausieren" onChange={(v) => execute((d) => updateSettings(d, { pauseOnCritical: v }), { silent: true })} />
        <div className="rounded-lg border border-line/60 bg-surface/40 px-3 py-2 text-xs">
          <KeyValue label="Tastenkürzel" value="Leertaste = Pause · 1–5 = Tempo" />
          <KeyValue label="Spiel-ID" value={game.gameId} />
          <KeyValue label="Seed" value={String(game.seed)} />
          <KeyValue label="Spielstand-Version" value={String(game.schemaVersion)} />
        </div>
      </div>
    </Card>
  );
}

function LicenseCard() {
  const pushToast = useGameStore((s) => s.pushToast);
  const [license, setLicense] = useState<BrandLicenseConfig | null>(getBrandLicense());
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const importLicense = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setErrors(['Die Datei ist kein gültiges JSON.']);
      return;
    }
    const result = validateBrandLicense(parsed);
    setErrors(result.errors);
    if (result.config) {
      applyBrandLicense(result.config);
      setLicense(result.config);
      pushToast('success', 'Markenlizenz aktiviert. Die Anzeigenamen werden beim nächsten Rendern übernommen.');
    }
  };

  const removeLicense = () => {
    applyBrandLicense(null);
    setLicense(null);
    setErrors([]);
    pushToast('info', 'Markenlizenz entfernt – es werden wieder fiktive Hersteller angezeigt.');
  };

  return (
    <Card title="Markenlizenz" icon={<KeyRound size={16} />} subtitle="Reale Hersteller dürfen nur mit gültiger Lizenz angezeigt werden. Ohne Lizenz nutzt das Spiel ausschließlich fiktive Marken.">
      {license ? (
        <Alert tone="good" title={`Lizenz aktiv: ${license.licensee}`} action={<Button size="xs" variant="danger" onClick={removeLicense}>Entfernen</Button>}>
          {Object.keys(license.manufacturers).length} Hersteller mit lizenziertem Anzeigenamen{license.validUntil ? ` · gültig bis ${new Date(license.validUntil).toLocaleDateString('de-DE')}` : ''}.
        </Alert>
      ) : (
        <p className="text-sm text-muted">Keine Lizenz hinterlegt – alle {MANUFACTURERS.length} Hersteller sind fiktiv.</p>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
          Lizenzdatei laden
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void importLicense(e.target.files[0])} />
      </div>
      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-red-300">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer">Dateiformat</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-line/60 bg-surface/60 p-3 text-[11px] text-ink">{LICENSE_EXAMPLE}</pre>
        <p className="mt-1">Gültige Hersteller-IDs: {MANUFACTURERS.map((m) => m.id).join(', ')}</p>
      </details>
    </Card>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const quitToMenu = useGameStore((s) => s.quitToMenu);
  const [confirmQuit, setConfirmQuit] = useState(false);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Einstellungen"
        description="Spielstände, Spieloptionen und Markenlizenz."
        icon={<Settings size={20} />}
        actions={
          <Button icon={<LogOut size={14} />} onClick={() => setConfirmQuit(true)}>
            Zum Hauptmenü
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SavesCard />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <GameSettingsCard />
          <LicenseCard />
        </div>
      </div>
      {confirmQuit && (
        <Modal
          open
          width="sm"
          title="Zum Hauptmenü?"
          onClose={() => setConfirmQuit(false)}
          footer={
            <>
              <Button onClick={() => setConfirmQuit(false)}>Abbrechen</Button>
              <Button
                variant="primary"
                onClick={() => {
                  quitToMenu();
                  navigate('/');
                }}
              >
                Spiel verlassen
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">Nicht gespeicherter Fortschritt seit der letzten Speicherung geht verloren.</p>
        </Modal>
      )}
    </div>
  );
}
