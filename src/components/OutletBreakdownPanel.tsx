import React from 'react';
import { Store } from 'lucide-react';
import type { OutletBreakdownRow } from '../utils/aggregator';
import type { DatasetCapabilities, Outlet } from '../types/pos';
import { OUTLET_INFO } from '../utils/defaultMappings';
import { formatInt, formatRM } from '../utils/formatters';

interface OutletBreakdownPanelProps {
  rows: OutletBreakdownRow[];
  capabilities: DatasetCapabilities;
  activeOutlets: Outlet[];
  onChangeOutlets: (outlets: Outlet[]) => void;
}

/**
 * Side-by-side figures for every outlet. Respects the date, Food/Beverage and
 * search filters but not the outlet filter, so outlets can always be compared.
 */
export const OutletBreakdownPanel: React.FC<OutletBreakdownPanelProps> = ({
  rows,
  capabilities,
  activeOutlets,
  onChangeOutlets,
}) => {
  // Clicking a row shows only that outlet; clicking it again shows all
  const selectOnly = (o: Outlet) =>
    onChangeOutlets(activeOutlets.length === 1 && activeOutlets[0] === o ? [] : [o]);
  if (rows.length === 0) return null;

  const hasTx = capabilities.hasOrderLevelTransactions;
  const hasGuests = capabilities.hasGuests;

  const total = rows.reduce(
    (acc, r) => ({
      sales: acc.sales + r.sales,
      food: acc.food + r.foodSales,
      bev: acc.bev + r.beverageSales,
      other: acc.other + r.otherSales,
      qty: acc.qty + r.qty,
      tx: acc.tx + r.transactions,
      guests: acc.guests + r.guests,
    }),
    { sales: 0, food: 0, bev: 0, other: 0, qty: 0, tx: 0, guests: 0 }
  );

  const maxSales = Math.max(...rows.map((r) => r.sales), 0);
  const dash = <span className="text-slate-300">—</span>;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">Sales by Outlet</h3>
        </div>
        <p className="text-[11px] text-slate-500">
          Each outlet reported separately · click a row to view only that outlet, or use the POS buttons above to combine outlets
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2 pr-3 font-semibold">Outlet</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Sales</th>
              <th scope="col" className="w-40 px-3 py-2 font-semibold">Share</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Food</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Beverage</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold" title="Retail, services and anything not classed as food or beverage">Other</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Orders</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Guests</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Avg Ticket</th>
              <th scope="col" className="py-2 pl-3 text-right font-semibold">Per Guest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const info = OUTLET_INFO[r.outlet as Outlet];
              const active = activeOutlets.includes(r.outlet);
              return (
                <tr
                  key={r.outlet}
                  onClick={() => selectOnly(r.outlet)}
                  className={`cursor-pointer transition ${
                    active ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectOnly(r.outlet);
                      }}
                      aria-pressed={active}
                      className="inline-flex items-center gap-2 text-left font-medium text-slate-800 cursor-pointer"
                    >
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: info.color }}
                      />
                      {info.name}
                      {(r.outlet === 'Unassigned' || r.outlet === 'Mangga') && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          check mapping
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                    {formatRM(r.sales)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${maxSales > 0 ? Math.max(0, (r.sales / maxSales) * 100) : 0}%`,
                            backgroundColor: info.color,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums text-slate-600">
                        {(r.share * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {formatRM(r.foodSales)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {formatRM(r.beverageSales)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {formatRM(r.otherSales)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {hasTx ? formatInt(r.transactions) : dash}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {hasGuests ? formatInt(r.guests) : dash}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {hasTx && r.transactions > 0 ? formatRM(r.avgTicket) : dash}
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums text-slate-700">
                    {hasGuests && r.guests > 0 ? formatRM(r.avgSpendPerGuest) : dash}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
              <td className="py-2 pr-3">All outlets</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRM(total.sales)}</td>
              <td className="px-3 py-2 text-slate-500">100%</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRM(total.food)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRM(total.bev)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRM(total.other)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {hasTx ? formatInt(total.tx) : dash}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {hasGuests ? formatInt(total.guests) : dash}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {hasTx && total.tx > 0 ? formatRM(total.sales / total.tx) : dash}
              </td>
              <td className="py-2 pl-3 text-right tabular-nums">
                {hasGuests && total.guests > 0 ? formatRM(total.sales / total.guests) : dash}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
};
