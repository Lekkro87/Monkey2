import {
  Atom,
  CircuitBoard,
  Cpu,
  Gamepad2,
  Gem,
  Globe,
  HardDrive,
  Hexagon,
  Laptop,
  Layers,
  Monitor,
  MonitorSmartphone,
  Orbit,
  Rocket,
  Server,
  Shield,
  Smartphone,
  Sparkles,
  Tablet,
  Watch,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import type { LogoId, ProductCategoryId } from '@/types';

const LOGO_ICONS: Record<LogoId, LucideIcon> = {
  cpu: Cpu,
  zap: Zap,
  rocket: Rocket,
  atom: Atom,
  hexagon: Hexagon,
  circuit: CircuitBoard,
  orbit: Orbit,
  shield: Shield,
  layers: Layers,
  sparkles: Sparkles,
  gem: Gem,
  globe: Globe,
};

const CATEGORY_ICONS: Record<ProductCategoryId, LucideIcon> = {
  desktop: Monitor,
  gaming_pc: Gamepad2,
  laptop: Laptop,
  gaming_laptop: MonitorSmartphone,
  smartphone: Smartphone,
  tablet: Tablet,
  monitor: Monitor,
  graphics_card: CircuitBoard,
  processor: Cpu,
  mainboard: HardDrive,
  server: Server,
  smartwatch: Watch,
};

export function CompanyLogo({ logo, color, size = 36, className }: { logo: LogoId; color: string; size?: number; className?: string }) {
  const Icon = LOGO_ICONS[logo] ?? Cpu;
  return (
    <div
      className={clsx('flex shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-black/30', className)}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #0b1020))` }}
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={2.2} />
    </div>
  );
}

export function CategoryIcon({ category, size = 16, className }: { category: ProductCategoryId; size?: number; className?: string }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon size={size} className={className} />;
}
