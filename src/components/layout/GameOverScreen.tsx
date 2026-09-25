import { Skull } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@/data/categories';
import { Button } from '@/components/ui/Button';
import { MiniStat } from '@/components/ui/Stat';
import { formatDate, formatDuration } from '@/simulation/calendar';
import { useGame, useGameStore } from '@/store/gameStore';
import { formatMoneyCompact, formatNumber, formatPercent } from '@/utils/format';

export function GameOverScreen() {
  const navigate = useNavigate();
  const quit = useGameStore((s) => s.quitToMenu);
  const company = useGame((g) => g.company);
  const day = useGame((g) => g.time.day);
  const lifetime = useGame((g) => g.finance.lifetime);
  const peakEmployees = useGame((g) => g.stats.peakEmployees);
  const peakShare = useGame((g) => g.stats.peakMarketShare);
  const bestProduct = useGame((g) => [...g.products].sort((a, b) => b.sales.unitsSold - a.sales.unitsSold)[0]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur">
      <div className="fade-in w-full max-w-2xl rounded-2xl border border-red-500/40 bg-panel p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 text-red-300">
            <Skull size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Insolvenz</h2>
            <p className="text-sm text-muted">
              {company.name} ist am {formatDate(day)} zahlungsunfähig. Der Spielstand bleibt erhalten – du kannst einen früheren Stand laden.
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniStat label="Gesamtumsatz" value={formatMoneyCompact(lifetime.revenue)} />
          <MiniStat label="Höchster Unternehmenswert" value={formatMoneyCompact(lifetime.peakValuation)} />
          <MiniStat label="Mitarbeitende (Spitze)" value={formatNumber(peakEmployees)} />
          <MiniStat label="Marktanteil (Spitze)" value={formatPercent(peakShare, 2)} />
          <MiniStat
            label="Erfolgreichstes Produkt"
            value={bestProduct ? bestProduct.name : '–'}
            hint={bestProduct ? `${formatNumber(bestProduct.sales.unitsSold)} × ${CATEGORIES[bestProduct.category].name}` : undefined}
          />
          <MiniStat label="Spielzeit" value={formatDuration(day)} />
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            onClick={() => {
              quit();
              navigate('/');
            }}
          >
            Zum Hauptmenü
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              quit();
              navigate('/new');
            }}
          >
            Neues Unternehmen gründen
          </Button>
        </div>
      </div>
    </div>
  );
}
