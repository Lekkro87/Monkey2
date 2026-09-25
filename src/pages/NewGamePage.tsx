import clsx from 'clsx';
import { ArrowLeft, Check, Rocket } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyLogo } from '@/components/icons';
import { LOGO_IDS } from '@/data/logos';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Form';
import { DIFFICULTY_LIST } from '@/data/difficulties';
import { HEADQUARTERS } from '@/data/locations';
import { REGIONS } from '@/data/regions';
import { useGameStore } from '@/store/gameStore';
import type { DifficultyId, LogoId } from '@/types';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];

export function NewGamePage() {
  const navigate = useNavigate();
  const startNewGame = useGameStore((s) => s.startNewGame);
  const [companyName, setCompanyName] = useState('NovaTech');
  const [ceoName, setCeoName] = useState('');
  const [logo, setLogo] = useState<LogoId>('cpu');
  const [color, setColor] = useState(COLORS[0]);
  const [headquartersId, setHeadquartersId] = useState('berlin');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [touched, setTouched] = useState(false);

  const nameError = companyName.trim().length < 2 ? 'Bitte einen Firmennamen mit mindestens 2 Zeichen eingeben.' : companyName.trim().length > 30 ? 'Maximal 30 Zeichen.' : null;
  const ceoError = ceoName.trim().length < 2 ? 'Bitte den Namen der Geschäftsführung eingeben.' : null;

  const start = () => {
    setTouched(true);
    if (nameError || ceoError) return;
    startNewGame({ companyName, ceoName, logo, color, headquartersId, difficulty });
    navigate('/game/dashboard');
  };

  const regions = Object.values(REGIONS);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <button type="button" onClick={() => navigate('/')} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Zurück
      </button>
      <h1 className="text-3xl font-black tracking-tight">Unternehmen gründen</h1>
      <p className="mt-1 text-muted">Alles beginnt in einer Garage. Wähle Namen, Auftritt, Standort und Schwierigkeit.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 rounded-2xl border border-line bg-panel/70 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Firmenname" hint={touched && nameError ? <span className="text-red-400">{nameError}</span> : undefined}>
              <TextInput value={companyName} maxLength={30} onChange={(e) => setCompanyName(e.target.value)} placeholder="z. B. NovaTech" />
            </Field>
            <Field label="CEO (dein Name)" hint={touched && ceoError ? <span className="text-red-400">{ceoError}</span> : undefined}>
              <TextInput value={ceoName} maxLength={40} onChange={(e) => setCeoName(e.target.value)} placeholder="Vor- und Nachname" />
            </Field>
          </div>

          <Field label="Firmenlogo">
            <div className="flex flex-wrap gap-2">
              {LOGO_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLogo(id)}
                  className={clsx('rounded-xl p-1 transition', logo === id ? 'ring-2 ring-white/70' : 'opacity-70 hover:opacity-100')}
                  aria-label={`Logo ${id}`}
                >
                  <CompanyLogo logo={id} color={color} size={42} />
                </button>
              ))}
            </div>
          </Field>

          <Field label="Unternehmensfarbe">
            <div className="flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={clsx('flex h-8 w-8 items-center justify-center rounded-full transition', color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111830]' : '')}
                  style={{ background: c }}
                  aria-label={`Farbe ${c}`}
                >
                  {color === c && <Check size={15} className="text-white" />}
                </button>
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent" aria-label="Eigene Farbe" />
            </div>
          </Field>

          <Field label="Hauptsitz" hint="Der Hauptsitz bestimmt Heimatmarkt, Lohnniveau, Mieten und Steuersatz.">
            <Select value={headquartersId} onChange={(e) => setHeadquartersId(e.target.value)}>
              {regions.map((region) => (
                <optgroup key={region.id} label={region.name}>
                  {HEADQUARTERS.filter((h) => h.region === region.id).map((hq) => (
                    <option key={hq.id} value={hq.id}>
                      {hq.city}, {hq.country} – Löhne {Math.round(hq.wageFactor * 100)} %, Steuern {Math.round(hq.taxRate * 100)} %
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>

          <div>
            <span className="text-xs font-medium text-muted">Schwierigkeitsgrad</span>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {DIFFICULTY_LIST.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={clsx(
                    'rounded-xl border p-3.5 text-left transition',
                    difficulty === d.id ? 'accent-border bg-white/5 ring-2 ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]' : 'border-line hover:border-slate-500',
                  )}
                  style={difficulty === d.id ? { borderColor: color } : undefined}
                >
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-xs text-muted">{d.description}</div>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-muted">
                    {d.highlights.map((h) => (
                      <li key={h}>• {h}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-panel/70 p-5">
            <div className="flex items-center gap-3">
              <CompanyLogo logo={logo} color={color} size={52} />
              <div className="min-w-0">
                <div className="truncate text-lg font-bold">{companyName || 'Firmenname'}</div>
                <div className="text-xs text-muted">CEO: {ceoName || '—'}</div>
              </div>
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-muted">
              <p>• Start in der Garage mit dir als einziger Person</p>
              <p>• Startkapital: {DIFFICULTY_LIST.find((d) => d.id === difficulty)!.startingCash.toLocaleString('de-DE')} €</p>
              <p>• Erste Produkte: Desktop- und Gaming-PCs aus Zukaufteilen</p>
            </div>
            <Button variant="primary" size="md" className="mt-5 w-full" style={{ background: color }} icon={<Rocket size={16} />} onClick={start}>
              Unternehmen gründen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
