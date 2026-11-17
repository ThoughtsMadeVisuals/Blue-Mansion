import React, { useEffect, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Printer,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type { FilterState, OutletFilter } from '../types/pos';

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  dateBounds: { min: string; max: string } | null;
  availableDates: string[];
  allProducts: string[];
  allCategories: string[];
  unassignedCount: number;
  onOpenMapping: () => void;
  onClearData: () => void;
}

const OUTLET_OPTIONS: { value: OutletFilter; label: string }[] = [
  { value: 'Mangga', label: 'Mangga' },
  { value: 'Mangga (Day)', label: 'Mangga (Day)' },
  { value: 'Mangga (Dinner)', label: 'Mangga (Dinner)' },
  { value: 'Indigo Bar', label: 'Indigo Bar' },
  { value: 'compare', label: 'All Outlets' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChange,
  dateBounds,
  availableDates,
  allProducts,
  allCategories,
  unassignedCount,
  onOpenMapping,
  onClearData,
}) => {
  const [dateMode, setDateMode] = useState<'range' | 'single'>('range');

  useEffect(() => {
    if (filters.dateFrom && filters.dateFrom === filters.dateTo) {
      setDateMode('single');
    }
  }, [filters.dateFrom, filters.dateTo]);

  const activeSingleDate =
    filters.dateFrom || (availableDates[availableDates.length - 1] ?? dateBounds?.max ?? '');

  const handleModeSwitch = (mode: 'range' | 'single') => {
    setDateMode(mode);
    if (mode === 'single') {
      const target =
        filters.dateFrom ||
        filters.dateTo ||
        availableDates[availableDates.length - 1] ||
        dateBounds?.max ||
        '';
      if (target) {
        onChange({ ...filters, dateFrom: target, dateTo: target });
      }
    } else {
      onChange({ ...filters, dateFrom: '', dateTo: '' });
    }
  };

  const stepSingleDate = (delta: -1 | 1) => {
    if (availableDates.length === 0) return;
    const idx = availableDates.indexOf(activeSingleDate);
    let nextIdx = idx;
    if (idx === -1) {
      nextIdx = delta === -1 ? availableDates.length - 1 : 0;
    } else {
      nextIdx = Math.min(availableDates.length - 1, Math.max(0, idx + delta));
    }
    const nextDate = availableDates[nextIdx];
    onChange({ ...filters, dateFrom: nextDate, dateTo: nextDate });
  };

  const hasDateFilter = Boolean(filters.dateFrom || filters.dateTo);
  const singleIdx = availableDates.indexOf(activeSingleDate);

  return (
    <div className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-sm backdrop-blur print:hidden">
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

        {/* Date Range or Particular Date */}
        {dateBounds && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => handleModeSwitch('range')}
                className={`rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer ${
                  dateMode === 'range'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Range
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('single')}
                className={`rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer ${
                  dateMode === 'single'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Single Date
              </button>
            </div>

            <Calendar className="h-3.5 w-3.5 text-slate-400" />

            {dateMode === 'single' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => stepSingleDate(-1)}
                  disabled={singleIdx === 0}
                  title="Previous available date"
                  className="rounded-lg border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <input
                  type="date"
                  aria-label="Particular date"
                  value={activeSingleDate}
                  min={dateBounds.min}
                  max={dateBounds.max}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      dateFrom: e.target.value,
                      dateTo: e.target.value,
                    })
                  }
                  className="rounded-lg border border-indigo-200 bg-indigo-50/40 px-2 py-1 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => stepSingleDate(1)}
                  disabled={singleIdx === availableDates.length - 1}
                  title="Next available date"
                  className="rounded-lg border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="date"
                  aria-label="Date from"
                  value={filters.dateFrom || dateBounds.min}
                  min={dateBounds.min}
                  max={dateBounds.max}
                  onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                />
                <span className="text-slate-400">–</span>
                <input
                  type="date"
                  aria-label="Date to"
                  value={filters.dateTo || dateBounds.max}
                  min={dateBounds.min}
                  max={dateBounds.max}
                  onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                />
              </>
            )}

            {hasDateFilter && (
              <button
                type="button"
                onClick={() => {
                  setDateMode('range');
                  onChange({ ...filters, dateFrom: '', dateTo: '' });
                }}
                title="Reset to all dates"
                className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
              >
                <X className="h-3 w-3" />
                All
              </button>
            )}
          </div>
        )}

        {/* Search + Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              list="pos-item-search-list"
              placeholder="Search item or category..."
              value={filters.searchQuery}
              onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
              className="w-52 rounded-lg border border-slate-200 py-1.5 pl-8 pr-7 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
            />
            {filters.searchQuery && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, searchQuery: '' })}
                title="Clear search"
                className="absolute right-2 top-1.5 rounded p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <datalist id="pos-item-search-list">
              {allProducts.map((p) => (
                <option key={`p-${p}`} value={p} />
              ))}
              {allCategories.map((c) => (
                <option key={`c-${c}`} value={c} />
              ))}
            </datalist>
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
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
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
