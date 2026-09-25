import { Package, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@/data/categories';
import { PRODUCT_TEMPLATES } from '@/data/templates';
import { CategoryIcon } from '@/components/icons';
import { StatusBadge } from '@/components/products/ProductInfo';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { ProgressBar } from '@/components/ui/Progress';
import { rowsEqual, useGameSelector } from '@/hooks/useGameSelectors';
import { estimateRemainingDays } from '@/systems/products/development';
import { DEV_PHASES } from '@/systems/products/phases';
import { isCategoryUnlocked } from '@/systems/research/effects';
import { useGameStore } from '@/store/gameStore';
import type { GameState, ProductStatus } from '@/types';
import { formatDays, formatMoney, formatNumber, formatPercent } from '@/utils/format';

const ORDER: ProductStatus[] = ['ready', 'on_sale', 'development', 'draft', 'discontinued'];

function productRows(game: GameState) {
  return game.products
    .map((p) => {
      const stock = game.inventory.products[p.id]?.qty ?? 0;
      const unitCost = game.inventory.products[p.id]?.avgCost || p.estimatedUnitCost;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        status: p.status,
        price: p.price,
        margin: p.price > 0 ? (p.price - unitCost - CATEGORIES[p.category].fulfillmentCost) / p.price : 0,
        sold30: p.sales.unitsLast30,
        revenue30: p.sales.revenueLast30,
        stock,
        backorders: p.sales.backorders,
        review: p.review?.overall ?? null,
        rating: p.customerRating,
        phase: p.development ? DEV_PHASES[p.development.phaseIndex].name : '',
        phaseProgress: p.development ? (p.development.phaseIndex + p.development.phaseProgress) / DEV_PHASES.length : 0,
        remaining: p.development ? estimateRemainingDays(game, p) : null,
        blocked: p.development?.blockedReason ?? '',
      };
    })
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.revenue30 - a.revenue30);
}

export default function ProductsPage() {
  const navigate = useNavigate();
  const rows = useGameSelector(productRows, rowsEqual);
  const game = useGameStore((s) => s.game!);
  const suggestions = PRODUCT_TEMPLATES.filter((t) => isCategoryUnlocked(game, t.category)).slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Produkte"
        description="Entwürfe, Entwicklung, Verkauf – das Portfolio deines Unternehmens."
        icon={<Package size={20} />}
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => navigate('/game/products/new')}>
            Neues Produkt
          </Button>
        }
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={28} />}
            title="Noch keine Produkte"
            description="Starte mit einer Vorlage – z. B. einem günstigen Desktop-PC, der sich in der Garage montieren lässt."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((t) => (
                  <Button key={t.id} onClick={() => navigate(`/game/products/new?template=${t.id}`)}>
                    {t.name}
                  </Button>
                ))}
              </div>
            }
          />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel/80">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Produkt</th>
                <th className="px-3 py-2.5 text-left font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Preis</th>
                <th className="px-3 py-2.5 text-right font-medium">Marge</th>
                <th className="px-3 py-2.5 text-right font-medium">Verkauf 30 T.</th>
                <th className="px-3 py-2.5 text-right font-medium">Umsatz 30 T.</th>
                <th className="px-3 py-2.5 text-right font-medium">Lager</th>
                <th className="px-3 py-2.5 text-right font-medium">Test</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} onClick={() => navigate(`/game/products/${row.id}`)} className="cursor-pointer border-t border-line/60 hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <CategoryIcon category={row.category} className="text-muted" />
                      <div>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted">{CATEGORIES[row.category].name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={row.status} />
                    {row.status === 'development' && (
                      <div className="mt-1.5 w-44">
                        <ProgressBar value={row.phaseProgress} height="h-1" />
                        <div className="mt-0.5 text-[10px] text-muted">
                          {row.blocked ? <span className="text-amber-300">{row.blocked}</span> : `${row.phase}${row.remaining ? ` · ca. ${formatDays(row.remaining)}` : ''}`}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">{formatMoney(row.price)}</td>
                  <td className={`px-3 py-2.5 text-right tabular ${row.margin < 0.1 ? 'text-red-400' : ''}`}>{formatPercent(row.margin)}</td>
                  <td className="px-3 py-2.5 text-right tabular">
                    {formatNumber(row.sold30)}
                    {row.backorders > 0 && <div className="text-[10px] text-amber-300">{formatNumber(row.backorders)} offen</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">{formatMoney(row.revenue30)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{formatNumber(row.stock)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{row.review !== null ? `${row.review.toLocaleString('de-DE', { minimumFractionDigits: 1 })}/10` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
