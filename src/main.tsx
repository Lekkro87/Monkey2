import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadStoredBrandLicense } from './services/brandLicense';
import { useGameStore } from './store/gameStore';
import './index.css';

declare global {
  interface Window {
    /** Zugriff auf den Spielzustand für automatisierte Tests und Debugging (nur lokal). */
    __techEmpire?: typeof useGameStore;
  }
}

loadStoredBrandLicense();
window.__techEmpire = useGameStore;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
