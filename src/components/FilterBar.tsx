import React, { useMemo } from 'react';
import { Calendar, Search, X } from 'lucide-react';
import type { Filters, SeriesBy } from '../types';
import { addDays } from '../lib/aggregate';
import { colorFor } from '../lib/format';
import { Segmented } from './ui';

export const FilterBar: React.FC<{
  filters: Filters;
  onChange: (f: Filters) => void;
  posList: string[];
  outletOf: (pos: string) => string;
  bounds: { min: string; max: string };
  seriesBy: SeriesBy;
  onSeriesBy: (s: SeriesBy) => void;
}> = ({ filters, onChange, posList, outletOf, bounds, seriesBy, onSeriesBy }) => {
  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of posList) {
      const o = outletOf(p);
      m.set(o, [...(m.get(o) ?? []), p]);
    }
    return Array.from(m.entries());
  }, [posList, outletOf]);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = +bounds.min.slice(0, 4); y <= +bounds.max.slice(0, 4); y++) ys.push(y);
    return ys;
  }, [bounds]);

  const selected = new Set(filters.pos);
  const allSelected = filters.pos.length === 0;
  const toggleGroup = (items: string[]) => {
    const on = items.every((p) => selected.has(p));
    const next = new Set(selected);
    items.forEach((p) => (on ? next.delete(p) : next.add(p)));
    const arr = Array.from(next);
    onChange({ ...filters, pos: arr.length === posList.length ? [] : arr });
  };

  const setRange = (from: string, to: string) => onChange({ ...filters, dateFrom: from, dateTo: to });
  const activeYear = years.find(
    (y) => filters.dateFrom === `${y}-01-01` && filters.dateTo === `${y}-12-31`,
  );
  const last30 = filters.dateTo === bounds.max && filters.dateFrom === addDays(bounds.max, -29);

  return (
    <div className="sticky top-0 z-30 space-y-2.5 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur print:static print:shadow-none">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Outlets</span>
        <button
          type="button"
          onClick={() => onChange({ ...filters, pos: [] })}
          className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${
            allSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All outlets
        </button>
        {groups.map(([outlet, items], gi) => {
          const groupOn = !allSelected && items.every((p) => selected.has(p));
          const color = colorFor(outlet, gi);
          return (
            <div key={outlet} className="flex items-center gap-0.5 rounded-full border border-slate-200 p-0.5">
              <button
                type="button"
                onClick={() => toggleGroup(items)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={groupOn ? { background: color, color: 'white' } : { color: '#334155' }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: groupOn ? 'white' : color }} />
                {outlet}
              </button>
              {items.length > 1 &&
                items.map((p) => {
                  const on = !allSelected && selected.has(p);
                  const short = p.replace(/^.*\((.*)\)\s*$/, '$1');
                  return (
                    <button
                      key={p}
                      type="button"
                      title={p}
                      onClick={() => toggleGroup([p])}
                      className={`cursor-pointer rounded-full px-2 py-0.5 text-[11px] ${
                        on ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {short}
                    </button>
                  );
                })}
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-slate-500">Compare by</span>
          <Segmented
            size="xs"
            value={seriesBy}
            onChange={onSeriesBy}
            options={[
              { value: 'outlet', label: 'Outlet' },
              { value: 'pos', label: 'Point of Sale' },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-slate-400" />
        <Segmented
          size="xs"
          value={
            !filters.dateFrom && !filters.dateTo ? 'all' : activeYear ? String(activeYear) : last30 ? 'l30' : 'custom'
          }
          onChange={(v) => {
            if (v === 'all') setRange('', '');
            else if (v === 'l30') setRange(addDays(bounds.max, -29), bounds.max);
            else if (v !== 'custom') setRange(`${v}-01-01`, `${v}-12-31`);
          }}
          options={[
            { value: 'all', label: 'All dates' },
            ...years.map((y) => ({ value: String(y), label: String(y) })),
            { value: 'l30', label: 'Last 30 days' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        <input
          type="date"
          aria-label="From date"
          value={filters.dateFrom || bounds.min}
          min={bounds.min}
          max={bounds.max}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
        />
        <span className="text-slate-400">–</span>
        <input
          type="date"
          aria-label="To date"
          value={filters.dateTo || bounds.max}
          min={bounds.min}
          max={bounds.max}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
        />

        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
        <Segmented
          size="xs"
          value={filters.foodBev}
          onChange={(v) => onChange({ ...filters, foodBev: v })}
          options={[
            { value: 'All', label: 'Food & Bev' },
            { value: 'Food', label: 'Food' },
            { value: 'Beverage', label: 'Beverage' },
            { value: 'Other', label: 'Other' },
          ]}
        />

        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by item or category…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-56 rounded-lg border border-slate-200 py-1.5 pl-8 pr-7 text-xs focus:border-indigo-500 focus:outline-none"
          />
          {filters.search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2 top-1.5 cursor-pointer text-slate-400 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
