import { Download, FolderOpen, Play, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyLogo } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DIFFICULTIES } from '@/data/difficulties';
import { formatDate } from '@/simulation/calendar';
import { AUTOSAVE_SLOT, slotLabel } from '@/services/saveService';
import type { SaveMeta } from '@/services/storage/types';
import { STAGE_NAMES } from '@/systems/company/company';
import { useGameStore } from '@/store/gameStore';
import { formatMoneyCompact } from '@/utils/format';

export function MainMenuPage() {
  const navigate = useNavigate();
  const saveService = useGameStore((s) => s.saveService);
  const loadState = useGameStore((s) => s.loadState);
  const pushToast = useGameStore((s) => s.pushToast);
  const hasGame = useGameStore((s) => s.game !== null);
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
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
  }, [saveService]);

  const load = async (slotId: string) => {
    try {
      loadState(await saveService.load(slotId));
      navigate('/game/dashboard');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Laden fehlgeschlagen.');
    }
  };

  const remove = async (slotId: string) => {
    await saveService.remove(slotId);
    setSaves(await saveService.list());
  };

  const importFile = async (file: File) => {
    try {
      loadState(saveService.importJson(await file.text()));
      pushToast('success', 'Spielstand importiert.');
      navigate('/game/dashboard');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Import fehlgeschlagen.');
    }
  };

  const latest = saves?.[0];

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_60%)]" />
      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col px-6 py-12">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-2xl font-black text-white shadow-lg shadow-indigo-900/50">TE</div>
          <div>
            <h1 className="text-4xl font-black tracking-tight">Tech Empire</h1>
            <p className="text-muted">Vom Garagen-Start-up zum globalen Technologiekonzern</p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            {hasGame && (
              <Button variant="primary" size="md" className="w-full" icon={<Play size={16} />} onClick={() => navigate('/game/dashboard')}>
                Weiterspielen
              </Button>
            )}
            <Button variant={hasGame ? 'secondary' : 'primary'} size="md" className="w-full" icon={<Plus size={16} />} onClick={() => navigate('/new')}>
              Neues Unternehmen gründen
            </Button>
            {latest && (
              <Button size="md" className="w-full" icon={<FolderOpen size={16} />} onClick={() => void load(latest.slotId)}>
                Letzten Spielstand laden
              </Button>
            )}
            <Button size="md" className="w-full" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
              Spielstand importieren (JSON)
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
            <div className="rounded-xl border border-line bg-panel/60 p-4 text-xs leading-relaxed text-muted">
              <p className="font-semibold text-ink">So funktioniert’s</p>
              <p className="mt-1">
                Stelle Personal ein, entwickle Produkte aus echten Komponenten, kaufe Teile ein, produziere und verkaufe. Forschung, Marketing, Fabriken, Kredite und
                die Börse bringen dich vom Garagen-Start-up zum Weltkonzern.
              </p>
              <p className="mt-2">Tastenkürzel im Spiel: Leertaste = Pause, 1–5 = Geschwindigkeit.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-panel/70 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Spielstände</h2>
              <span className="text-xs text-muted">Speicher: {saveService.backendName}</span>
            </div>
            {saves === null ? (
              <p className="text-sm text-muted">Lade Spielstände …</p>
            ) : saves.length === 0 ? (
              <p className="text-sm text-muted">Noch keine Spielstände vorhanden. Gründe dein erstes Unternehmen!</p>
            ) : (
              <ul className="space-y-2">
                {saves.map((save) => (
                  <li key={save.slotId} className="flex items-center gap-3 rounded-xl border border-line/70 bg-surface/50 p-3">
                    <CompanyLogo logo={save.logo} color={save.color} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{save.companyName}</span>
                        <Badge tone={save.slotId === AUTOSAVE_SLOT ? 'info' : 'neutral'}>{slotLabel(save.slotId)}</Badge>
                        {save.status === 'bankrupt' && <Badge tone="bad">insolvent</Badge>}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {formatDate(save.day)} · Stufe {save.stage} ({STAGE_NAMES[save.stage]}) · {formatMoneyCompact(save.cash)} · {DIFFICULTIES[save.difficulty].name}
                      </div>
                      <div className="text-[11px] text-muted/70">Gespeichert: {new Date(save.savedAt).toLocaleString('de-DE')}</div>
                    </div>
                    <Button size="sm" variant="primary" icon={<Download size={14} className="rotate-180" />} onClick={() => void load(save.slotId)}>
                      Laden
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Löschen" icon={<Trash2 size={14} />} onClick={() => void remove(save.slotId)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
