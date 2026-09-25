import { Newspaper, Zap } from 'lucide-react';
import { useState } from 'react';
import { NewsList } from '@/components/NewsFeed';
import { NEWS_CATEGORY_LABELS } from '@/data/newsCategories';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { formatDate } from '@/simulation/calendar';
import { useGameStore } from '@/store/gameStore';
import type { NewsCategory } from '@/types';
import { formatNumber, formatPercent } from '@/utils/format';

const PAGE_SIZE = 60;

export default function NewsPage() {
  const game = useGameStore((s) => s.game!);
  const [category, setCategory] = useState<NewsCategory | 'all'>('all');
  const [tone, setTone] = useState<'all' | 'positive' | 'negative'>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const items = game.news.filter((n) => (category === 'all' || n.category === category) && (tone === 'all' || n.tone === tone));
  const day = game.time.day;
  const modifiers = game.events.modifiers.filter((m) => m.endDay > day);
  const counts = game.news.reduce<Partial<Record<NewsCategory, number>>>((acc, n) => {
    acc[n.category] = (acc[n.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <PageHeader title="Nachrichten" description="Branchenmeldungen, Ereignisse und Entwicklungen – alles basiert auf dem tatsächlichen Spielgeschehen." icon={<Newspaper size={20} />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Newsfeed"
          className="lg:col-span-2"
          actions={
            <div className="flex gap-1">
              {(['all', 'positive', 'negative'] as const).map((t) => (
                <Button key={t} size="xs" variant={tone === t ? 'primary' : 'ghost'} onClick={() => setTone(t)}>
                  {t === 'all' ? 'Alle' : t === 'positive' ? 'Positiv' : 'Negativ'}
                </Button>
              ))}
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Button size="xs" variant={category === 'all' ? 'primary' : 'secondary'} onClick={() => setCategory('all')}>
              Alle ({game.news.length})
            </Button>
            {(Object.keys(NEWS_CATEGORY_LABELS) as NewsCategory[]).map((c) => (
              <Button key={c} size="xs" variant={category === c ? 'primary' : 'secondary'} onClick={() => setCategory(c)} disabled={!counts[c]}>
                {NEWS_CATEGORY_LABELS[c]} ({counts[c] ?? 0})
              </Button>
            ))}
          </div>
          <NewsList items={items.slice(0, limit)} />
          {items.length > limit && (
            <div className="mt-3 text-center">
              <Button size="xs" onClick={() => setLimit(limit + PAGE_SIZE)}>
                Ältere Meldungen laden
              </Button>
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Aktive Einflüsse" icon={<Zap size={15} />} subtitle="Laufende Ereignisse, die Preise, Nachfrage oder Lieferzeiten verändern.">
            {modifiers.length === 0 ? (
              <p className="text-sm text-muted">Derzeit keine besonderen Ereignisse.</p>
            ) : (
              <ul className="space-y-2">
                {modifiers.map((m) => (
                  <li key={m.id} className="rounded-lg border border-line/60 bg-surface/40 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{m.label}</span>
                      <Badge tone={m.mode === 'mul' ? (m.value > 1 ? 'warn' : 'good') : 'info'}>
                        {m.mode === 'mul' ? `${m.value >= 1 ? '+' : '−'}${formatPercent(Math.abs(m.value - 1), 0)}` : `${m.value >= 0 ? '+' : ''}${formatNumber(m.value, 2)}`}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">bis {formatDate(m.endDay)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Ereignischronik">
            {game.events.log.length === 0 ? (
              <p className="text-sm text-muted">Noch keine besonderen Ereignisse.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {[...game.events.log]
                  .reverse()
                  .slice(0, 30)
                  .map((entry) => (
                    <li key={entry.id} className="flex justify-between gap-3">
                      <span>{entry.title}</span>
                      <span className="shrink-0 text-xs text-muted">{formatDate(entry.day)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
