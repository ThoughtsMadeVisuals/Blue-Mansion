import React from 'react';
import { Calendar, Filter, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { FilterState, OutletFilter } from '../types/pos';

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  dateBounds: { min: string; max: string } | null;
  unassignedCount: number;
  onOpenMapping: () => void;
  onClearData: () => void;
}

const OUTLET_OPTIONS: { value: OutletFilter; label: string }[] = [
  { value: 'compare', label: 'Compare Both' },
  { value: 'Mangga', label: 'Mangga (All)' },
  { value: 'Mangga (Day)', label: 'Mangga (Day)' },
  { value: 'Mangga (Dinner)', label: 'Mangga (Dinner)' },
  { value: 'Indigo Bar', label: 'Indigo Bar' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChange,
  dateBounds,
  unassignedCount,
  onOpenMapping,
  onClearData,
}) => {
  return (
    <div className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Outlet Switcher */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
          {OUTLET_OPTIONS.map((opt) => {
            const active = filters.outletFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...filters, outletFilter: opt.value })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Food / Bev Filter */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <Filter className="ml-2 h-3.5 w-3.5 text-slate-400" />
          {(['All', 'Food', 'Beverage'] as const).map((fb) => {
            const active = filters.foodBevFilter === fb;
            return (
              <button
                key={fb}
                type="button"
                onClick={() => onChange({ ...filters, foodBevFilter: fb })}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {fb}
              </button>
            );
          })}
        </div>

        {/* Date Range */}
        {dateBounds && (
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={filters.dateFrom || dateBounds.min}
              min={dateBounds.min}
              max={dateBounds.max}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
            />
            <span className="text-slate-400">–</span>
            <input
              type="date"
              value={filters.dateTo || dateBounds.max}
              min={dateBounds.min}
              max={dateBounds.max}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
            />
          </div>
        )}

        {/* Search + Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search item or category..."
              value={filters.searchQuery}
              onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
              className="w-44 rounded-lg border border-slate-200 py-1.5 pl-8 pr-2.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={onOpenMapping}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Mapping Rules
            {unassignedCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                {unassignedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onClearData}
            title="Clear loaded data"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
