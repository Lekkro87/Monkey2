import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { startGameLoop, stopGameLoop } from '@/services/gameLoop';
import { useGameStore } from '@/store/gameStore';
import type { GameSpeed } from '@/types';
import { DecisionModal } from './DecisionModal';
import { GameOverScreen } from './GameOverScreen';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const KEY_SPEEDS: Record<string, GameSpeed> = { '1': 1, '2': 2, '3': 5, '4': 10, '5': 20 };

export function GameLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const bankrupt = useGameStore((s) => s.game?.status === 'bankrupt');

  useEffect(() => {
    startGameLoop();
    return () => stopGameLoop();
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        useGameStore.getState().togglePause();
      } else if (KEY_SPEEDS[event.key]) {
        useGameStore.getState().setSpeed(KEY_SPEEDS[event.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Topbar onToggleMenu={() => setMenuOpen((v) => !v)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
        {menuOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMenuOpen(false)} />}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
            <Outlet />
          </div>
        </main>
      </div>
      <DecisionModal />
      {bankrupt && <GameOverScreen />}
    </div>
  );
}
