import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from './components/ui/Feedback';
import { GameLayout } from './components/layout/GameLayout';
import { MainMenuPage } from './pages/MainMenuPage';
import { NewGamePage } from './pages/NewGamePage';
import { useGameStore } from './store/gameStore';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CompanyPage = lazy(() => import('./pages/CompanyPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductEditorPage = lazy(() => import('./pages/ProductEditorPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const ProductionPage = lazy(() => import('./pages/ProductionPage'));
const ResearchPage = lazy(() => import('./pages/ResearchPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const MarketingPage = lazy(() => import('./pages/MarketingPage'));
const LogisticsPage = lazy(() => import('./pages/LogisticsPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const CompetitorsPage = lazy(() => import('./pages/CompetitorsPage'));
const MarketPage = lazy(() => import('./pages/MarketPage'));
const StockPage = lazy(() => import('./pages/StockPage'));
const NewsPage = lazy(() => import('./pages/NewsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function RequireGame({ children }: { children: ReactNode }) {
  const hasGame = useGameStore((s) => s.game !== null);
  return hasGame ? <>{children}</> : <Navigate to="/" replace />;
}

function PageFallback() {
  return <div className="p-8 text-sm text-muted">Lädt …</div>;
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainMenuPage />} />
        <Route path="/new" element={<NewGamePage />} />
        <Route
          path="/game"
          element={
            <RequireGame>
              <GameLayout />
            </RequireGame>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          {(
            [
              ['dashboard', DashboardPage],
              ['company', CompanyPage],
              ['products', ProductsPage],
              ['products/new', ProductEditorPage],
              ['products/:productId/edit', ProductEditorPage],
              ['products/:productId', ProductDetailPage],
              ['production', ProductionPage],
              ['research', ResearchPage],
              ['employees', EmployeesPage],
              ['finance', FinancePage],
              ['marketing', MarketingPage],
              ['logistics', LogisticsPage],
              ['suppliers', SuppliersPage],
              ['competitors', CompetitorsPage],
              ['market', MarketPage],
              ['stock', StockPage],
              ['news', NewsPage],
              ['settings', SettingsPage],
            ] as const
          ).map(([path, Page]) => (
            <Route
              key={path}
              path={path}
              element={
                <Suspense fallback={<PageFallback />}>
                  <Page />
                </Suspense>
              }
            />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </HashRouter>
  );
}
