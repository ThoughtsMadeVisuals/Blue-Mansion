import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ItemAggRow } from '../utils/aggregator';
import { formatInt, formatRM } from '../utils/formatters';

interface SalesByItemTableProps {
  items: ItemAggRow[];
  totalSales: number;
}

type SortField =
  | 'product'
  | 'category'
  | 'manggaQty'
  | 'manggaSales'
  | 'indigoQty'
  | 'indigoSales'
  | 'totalQty'
  | 'totalSales';

export const SalesByItemTable: React.FC<SalesByItemTableProps> = ({
  items,
  totalSales,
}) => {
  const [sortField, setSortField] = useState<SortField>('totalSales');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState(25);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [items, sortField, sortDir]);

  const visible = sorted.slice(0, pageSize);

  const SortHeader: React.FC<{ field: SortField; label: string; alignRight?: boolean }> = ({
    field,
    label,
    alignRight,
  }) => {
    const active = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`cursor-pointer select-none px-3 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 ${
          alignRight ? 'text-right' : 'text-left'
        }`}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (
            sortDir === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-indigo-600" />
            ) : (
              <ArrowDown className="h-3 w-3 text-indigo-600" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 text-slate-300" />
          )}
        </span>
      </th>
    );
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Sales by Item</h2>
          <p className="text-xs text-slate-500">
            Showing {visible.length} of {items.length} items — click any column header to sort
          </p>
        </div>
        {items.length > 25 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Rows:</span>
            {[25, 50, 100, items.length].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setPageSize(sz)}
                className={`rounded-lg px-2.5 py-1 font-medium cursor-pointer ${
                  pageSize === sz
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {sz === items.length ? 'All' : sz}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              <SortHeader field="product" label="Item" />
              <SortHeader field="category" label="Category" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">
                Type
              </th>
              <SortHeader field="manggaQty" label="Mangga Qty" alignRight />
              <SortHeader field="manggaSales" label="Mangga Sales" alignRight />
              <SortHeader field="indigoQty" label="Indigo Qty" alignRight />
              <SortHeader field="indigoSales" label="Indigo Sales" alignRight />
              <SortHeader field="totalQty" label="Total Qty" alignRight />
              <SortHeader field="totalSales" label="Total Sales" alignRight />
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">
                Share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((row) => {
              const share = totalSales > 0 ? (row.totalSales / totalSales) * 100 : 0;
              return (
                <tr key={`${row.product}-${row.category}`} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.product}</td>
                  <td className="px-3 py-2 text-slate-600">{row.category}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        row.foodBev === 'Food'
                          ? 'bg-emerald-50 text-emerald-700'
                          : row.foodBev === 'Beverage'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.foodBev}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                    {formatInt(row.manggaQty)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                    {formatRM(row.manggaSales)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-indigo-700">
                    {formatInt(row.indigoQty)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-indigo-700">
                    {formatRM(row.indigoSales)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                    {formatInt(row.totalQty)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                    {formatRM(row.totalSales)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    {share.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
