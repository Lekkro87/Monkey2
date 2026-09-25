import clsx from 'clsx';
import { Award, Building2, ChartLine, FlaskConical, Globe2, Newspaper, Swords, Wallet, Zap } from 'lucide-react';
import { formatShortDate } from '@/simulation/calendar';
import type { NewsCategory, NewsItem } from '@/types';

const ICONS: Record<NewsCategory, typeof Newspaper> = {
  company: Building2,
  market: ChartLine,
  competitor: Swords,
  economy: Globe2,
  event: Zap,
  finance: Wallet,
  research: FlaskConical,
  achievement: Award,
};

export function NewsList({ items, compact = false }: { items: NewsItem[]; compact?: boolean }) {
  if (items.length === 0) return <p className="text-sm text-muted">Noch keine Nachrichten.</p>;
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.category];
        return (
          <li key={item.id} className="flex gap-2.5 rounded-lg px-2 py-2 hover:bg-white/[0.03]">
            <span
              className={clsx(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                item.tone === 'positive' ? 'bg-emerald-500/10 text-emerald-300' : item.tone === 'negative' ? 'bg-red-500/10 text-red-300' : 'bg-white/5 text-muted',
              )}
            >
              <Icon size={13} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] leading-snug font-medium">{item.title}</p>
                <span className="shrink-0 text-[10px] text-muted tabular">{formatShortDate(item.day)}</span>
              </div>
              {!compact && item.body && <p className="mt-0.5 text-xs leading-snug text-muted">{item.body}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
