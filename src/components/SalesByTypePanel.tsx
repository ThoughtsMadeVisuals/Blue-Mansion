import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Tags } from 'lucide-react';
import type { FoodBevType } from '../types/pos';
import { ITEM_TYPES } from '../types/pos';
import type { AggregatedReport, ItemAggRow } from '../utils/aggregator';
import { formatInt, formatRM } from '../utils/formatters';
import { TYPE_BADGE, TYPE_DESCRIPTION } from '../utils/itemTypes';

interface SalesByTypePanelProps {
  report: AggregatedReport;
  outletLabel: string;
  /** Item names whose type was set by hand */
  overriddenItems: Record<string, FoodBevType>;
  onChangeItemType: (product: string, type: FoodBevType | null) => void;
}

const PAGE = 30;

export const SalesByTypePanel: React.FC<SalesByTypePanelProps> = ({
  report,
  outletLabel,
  overriddenItems,
  onChangeItemType,
}) => {
  const [open, setOpen] = useState<FoodBevType | null>('Other');
  const [shown, setShown] = useState(PAGE);

  const itemsByType = useMemo(() => {
    const map = new Map<FoodBevType, ItemAggRow[]>();
    for (const item of report.salesByItem) {
      const list = map.get(item.foodBev) ?? [];
      list.push(item);
      map.set(item.foodBev, list);
    }
    return map;
  }, [report.salesByItem]);

  const totals = new Map(report.foodVsBev.map((f) => [f.type, f]));
  const types = ITEM_TYPES.filter(
    (t) => (itemsByType.get(t)?.length ?? 0) > 0 || Math.abs(totals.get(t)?.totalSales ?? 0) > 0.005
  );
  const grand = report.kpis.total.sales;
  const openItems = open ? itemsByType.get(open) ?? [] : [];

  const toggle = (t: FoodBevType) => {
    setOpen((prev) => (prev === t ? null : t));
    setShown(PAGE);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">Sales by Type</h3>
        </div>
        <p className="text-[11px] text-slate-500">
          {outletLabel} · click a type to list its items · change an item’s type with its dropdown
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {types.map((t) => {
          const tot = totals.get(t);
          const active = open === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              aria-expanded={active}
              title={TYPE_DESCRIPTION[t]}
              className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                active ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-300' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_BADGE[t]}`}>
                {t}
              </span>
              <div className="mt-1.5 text-base font-bold tabular-nums text-slate-900">
                {formatRM(tot?.totalSales ?? 0)}
              </div>
              <div className="text-[11px] text-slate-500">
                {grand !== 0 ? `${(((tot?.totalSales ?? 0) / grand) * 100).toFixed(1)}% · ` : ''}
                {formatInt(itemsByType.get(t)?.length ?? 0)} items
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <ChevronDown className="h-4 w-4" />
            {open}: all {formatInt(openItems.length)} items
            <span className="font-normal text-slate-500">· {TYPE_DESCRIPTION[open]}</span>
          </div>
          {openItems.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">No items for the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th scope="col" className="py-2 pr-3 font-semibold">Item</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Sales</th>
                    <th scope="col" className="py-2 pl-3 font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {openItems.slice(0, shown).map((item) => {
                    const manual = overriddenItems[item.product];
                    return (
                      <tr key={`${item.product}|${item.category}`}>
                        <td className="py-1.5 pr-3 font-medium text-slate-800">{item.product}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                          {formatInt(item.totalQty)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-900">
                          {formatRM(item.totalSales)}
                        </td>
                        <td className="py-1.5 pl-3">
                          <select
                            aria-label={`Type for ${item.product}`}
                            value={manual ?? ''}
                            onChange={(e) =>
                              onChangeItemType(item.product, (e.target.value || null) as FoodBevType | null)
                            }
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                          >
                            <option value="">Auto ({item.foodBev})</option>
                            {ITEM_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          {manual && <span className="ml-1.5 text-[10px] text-slate-500">set by you</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {openItems.length > shown && (
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setShown((n) => n + PAGE * 5)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    Show more ({formatInt(openItems.length - shown)} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
