import clsx from 'clsx';
import {
  Boxes,
  Building2,
  ChartLine,
  ChartPie,
  Factory,
  FlaskConical,
  LayoutDashboard,
  Megaphone,
  Newspaper,
  Package,
  Settings,
  Swords,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useGame } from '@/store/gameStore';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: (counts: SidebarCounts) => number;
}

interface SidebarCounts {
  stalledLines: number;
  unreadDecisions: number;
  readyProducts: number;
}

const NAV: NavItem[] = [
  { to: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: 'company', label: 'Unternehmen', icon: Building2 },
  { to: 'products', label: 'Produkte', icon: Package, badge: (c) => c.readyProducts },
  { to: 'production', label: 'Produktion', icon: Factory, badge: (c) => c.stalledLines },
  { to: 'research', label: 'Forschung', icon: FlaskConical },
  { to: 'employees', label: 'Mitarbeiter', icon: Users },
  { to: 'finance', label: 'Finanzen', icon: Wallet },
  { to: 'marketing', label: 'Marketing', icon: Megaphone },
  { to: 'logistics', label: 'Logistik', icon: Truck },
  { to: 'suppliers', label: 'Lieferanten', icon: Boxes },
  { to: 'competitors', label: 'Konkurrenz', icon: Swords },
  { to: 'market', label: 'Markt', icon: ChartPie },
  { to: 'stock', label: 'Börse', icon: ChartLine },
  { to: 'news', label: 'Nachrichten', icon: Newspaper },
  { to: 'settings', label: 'Einstellungen', icon: Settings },
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const stalledLines = useGame((g) => g.production.lines.filter((l) => l.active && l.status === 'stalled').length);
  const readyProducts = useGame((g) => g.products.filter((p) => p.status === 'ready').length);
  const counts: SidebarCounts = { stalledLines, unreadDecisions: 0, readyProducts };
  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-[#0a0f1f]/95 pt-16 backdrop-blur transition-transform lg:static lg:translate-x-0 lg:pt-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const badge = item.badge?.(counts) ?? 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-white/8 text-ink shadow-inner' : 'text-muted hover:bg-white/5 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={17} className={clsx(isActive ? 'accent-text' : 'text-muted group-hover:text-ink')} />
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 && (
                    <span className={clsx('rounded-full px-1.5 text-[10px] font-bold', item.to === 'production' ? 'bg-amber-500/20 text-amber-300' : 'accent-bg text-white')}>{badge}</span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-line px-4 py-3 text-[11px] text-muted">Tech Empire · Version 0.1</div>
    </aside>
  );
}
