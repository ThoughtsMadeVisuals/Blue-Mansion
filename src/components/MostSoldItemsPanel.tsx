import React, { useState } from 'react';
import { Utensils, Wine } from 'lucide-react';
import type { ItemAggRow } from '../utils/aggregator';
import { formatInt, formatRM } from '../utils/formatters';

interface MostSoldItemsPanelProps {
  topFood: ItemAggRow[];
  topBeverage: ItemAggRow[];
}

export const MostSoldItemsPanel: React.FC<MostSoldItemsPanelProps> = ({
  topFood,
  topBeverage,
}) => {
  const [rankBy, setRankBy] = useState<'qty' | 'sales'>('qty');

  const sortItems = (items: ItemAggRow[]) =>
    [...items]
      .sort((a, b) =>
        rankBy === 'qty' ? b.totalQty - a.totalQty : b.totalSales - a.totalSales
      )
      .slice(0, 8);

  const foodList = sortItems(topFood);
  const bevList = sortItems(topBeverage);

  const renderList = (
    title: string,
    icon: React.ReactNode,
    accentClass: string,
    items: ItemAggRow[]
  ) => {
    const maxVal =
      items.length > 0
        ? Math.max(...items.map((i) => (rankBy === 'qty' ? i.totalQty : i.totalSales)), 1)
        : 1;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`rounded-lg p-2 ${accentClass}`}>{icon}</div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500">
                Top {items.length} by {rankBy === 'qty' ? 'Quantity Sold' : 'Revenue (RM)'}
              </p>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No items classified in this group. Adjust categories in Mapping Rules if needed.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => {
              const val = rankBy === 'qty' ? item.totalQty : item.totalSales;
              const pct = Math.max(4, Math.round((val / maxVal) * 100));
              return (
                <div key={`${item.product}-${item.category}`} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-5 text-[11px] font-semibold text-slate-400">
                        #{idx + 1}
                      </span>
                      <span className="truncate font-medium text-slate-800">
                        {item.product}
                      </span>
                      <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">
                        {item.category}
                      </span>
                    </div>
                    <div className="ml-2 shrink-0 text-right">
                      <span className="font-semibold text-slate-900">
                        {rankBy === 'qty'
                          ? `${formatInt(item.totalQty)} sold`
                          : formatRM(item.totalSales)}
                      </span>
                      <span className="ml-2 text-[11px] text-slate-400">
                        ({rankBy === 'qty' ? formatRM(item.totalSales) : `${formatInt(item.totalQty)} qty`})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="flex h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      >
                        {item.manggaQty > 0 && (
                          <div
                            className="bg-emerald-500"
                            style={{
                              width: `${(item.manggaSales / Math.max(item.totalSales, 0.01)) * 100}%`,
                            }}
                            title={`Mangga: ${formatInt(item.manggaQty)} (${formatRM(item.manggaSales)})`}
                          />
                        )}
                        {item.indigoQty > 0 && (
                          <div
                            className="bg-indigo-500"
                            style={{
                              width: `${(item.indigoSales / Math.max(item.totalSales, 0.01)) * 100}%`,
                            }}
                            title={`Indigo Bar: ${formatInt(item.indigoQty)} (${formatRM(item.indigoSales)})`}
                          />
                        )}
                        {item.unassignedQty > 0 && (
                          <div
                            className="bg-slate-400"
                            style={{
                              width: `${(item.unassignedSales / Math.max(item.totalSales, 0.01)) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <span className="w-28 shrink-0 text-right text-[10px] text-slate-500">
                      M: {formatInt(item.manggaQty)} · IB: {formatInt(item.indigoQty)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Most Sold Items — Food &amp; Beverage
          </h2>
          <p className="text-xs text-slate-500">
            Green = Mangga · Indigo = Indigo Bar
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-slate-200/70 p-1">
          <button
            type="button"
            onClick={() => setRankBy('qty')}
            className={`rounded-lg px-3 py-1 text-xs font-medium cursor-pointer ${
              rankBy === 'qty' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            By Quantity
          </button>
          <button
            type="button"
            onClick={() => setRankBy('sales')}
            className={`rounded-lg px-3 py-1 text-xs font-medium cursor-pointer ${
              rankBy === 'sales' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            By Revenue (RM)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {renderList(
          'Most Sold Food',
          <Utensils className="h-4 w-4 text-emerald-700" />,
          'bg-emerald-50',
          foodList
        )}
        {renderList(
          'Most Sold Beverage',
          <Wine className="h-4 w-4 text-indigo-700" />,
          'bg-indigo-50',
          bevList
        )}
      </div>
    </section>
  );
};
