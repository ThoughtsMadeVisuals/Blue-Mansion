import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDown, ArrowUp, BarChart2, Search, TrendingUp, X } from 'lucide-react';
import type { FilterState, ParsedDataset } from '../types/pos';
import { aggregateItemTrend, type ItemAggRow } from '../utils/aggregator';
import { formatCompactRM, formatInt, formatRM } from '../utils/formatters';

interface SalesByItemChartProps {
  items: ItemAggRow[];
  dataset: ParsedDataset;
  filters: FilterState;
  allCategories: string[];
  outletLabel: string;
  accentColor: string;
  selectedProduct: string | null;
  onSelectProduct: (product: string | null) => void;
}

type ChartSortField = 'totalSales' | 'totalQty' | 'avgPrice' | 'product';

export const SalesByItemChart: React.FC<SalesByItemChartProps> = ({
  items,
  dataset,
  filters,
  allCategories,
  outletLabel,
  accentColor,
  selectedProduct,
  onSelectProduct,
}) => {
  const [itemQuery, setItemQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<ChartSortField>('totalSales');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState<number>(15);
  const [trendMetric, setTrendMetric] = useState<'sales' | 'qty'>('sales');

  const chartData = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    const filtered = items.filter((row) => {
      if (categoryFilter !== 'All' && row.category !== categoryFilter) return false;
      if (q && !row.product.toLowerCase().includes(q) && !row.category.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    const withAvg = filtered.map((row) => ({
      ...row,
      avgPrice: row.totalQty > 0 ? row.totalSales / row.totalQty : 0,
      shortName: row.product.length > 26 ? `${row.product.slice(0, 25)}…` : row.product,
    }));

    withAvg.sort((a, b) => {
      if (sortBy === 'product') {
        return sortDir === 'asc'
          ? a.product.localeCompare(b.product)
          : b.product.localeCompare(a.product);
      }
      return sortDir === 'asc' ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy];
    });

    return withAvg.slice(0, limit);
  }, [items, itemQuery, categoryFilter, sortBy, sortDir, limit]);

  const activeTrendProduct = useMemo(() => {
    if (selectedProduct) return selectedProduct;
    if (chartData.length === 1) return chartData[0].product;
    return null;
  }, [selectedProduct, chartData]);

  const itemTrend = useMemo(() => {
    if (!activeTrendProduct) return null;
    return aggregateItemTrend(dataset, filters, activeTrendProduct);
  }, [dataset, filters, activeTrendProduct]);

  const metricKey = sortBy === 'totalQty' ? 'totalQty' : sortBy === 'avgPrice' ? 'avgPrice' : 'totalSales';
  const metricLabel =
    sortBy === 'totalQty' ? 'Qty Sold' : sortBy === 'avgPrice' ? 'Avg Price (RM)' : 'Sales (RM)';

  const chartHeight = Math.max(260, chartData.length * 32 + 40);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Item Sales Graph — {outletLabel}
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Search, filter by category, and sort items into the graph. Click any bar to inspect its daily &amp; hourly trend.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {/* Local Item Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter items in graph..."
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              className="w-44 rounded-lg border border-slate-200 py-1.5 pl-8 pr-6 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
            />
            {itemQuery && (
              <button
                type="button"
                onClick={() => setItemQuery('')}
                className="absolute right-1.5 top-1.5 rounded p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Clear item filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select
            aria-label="Filter graph by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="All">All Categories</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                ['totalSales', 'Sales'],
                ['totalQty', 'Qty'],
                ['avgPrice', 'Avg Price'],
                ['product', 'Name'],
              ] as const
            ).map(([field, label]) => (
              <button
                key={field}
                type="button"
                onClick={() => {
                  if (sortBy === field) {
                    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                  } else {
                    setSortBy(field);
                    setSortDir(field === 'product' ? 'asc' : 'desc');
                  }
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  sortBy === field
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title={sortDir === 'desc' ? 'Descending' : 'Ascending'}
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white/70 cursor-pointer"
            >
              {sortDir === 'desc' ? (
                <ArrowDown className="h-3.5 w-3.5" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Top N Limit */}
          <select
            aria-label="Number of items in graph"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            {[10, 15, 25, 40].map((n) => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Horizontal Bar Chart */}
      {chartData.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          No items match the current graph filters.
        </div>
      ) : (
        <div style={{ height: `${chartHeight}px` }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) =>
                  sortBy === 'totalQty' ? formatInt(Number(v)) : formatCompactRM(Number(v))
                }
                tick={{ fontSize: 11, fill: '#475569' }}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                width={175}
                tick={{ fontSize: 11, fill: '#334155' }}
                interval={0}
              />
              <Tooltip
                formatter={(value: number) => [
                  sortBy === 'totalQty' ? formatInt(value) : formatRM(value),
                  metricLabel,
                ]}
                labelFormatter={(_label, payload) => {
                  const row = payload?.[0]?.payload as
                    | (ItemAggRow & { avgPrice: number })
                    | undefined;
                  if (!row) return '';
                  return `${row.product} (${row.category}) · ${formatInt(row.totalQty)} qty · ${formatRM(row.totalSales)}`;
                }}
                contentStyle={{
                  borderRadius: '12px',
                  borderColor: '#e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Bar
                dataKey={metricKey}
                name={metricLabel}
                radius={[0, 6, 6, 0]}
                className="cursor-pointer"
                onClick={(barData) => {
                  const prod = (barData as unknown as { product?: string })?.product;
                  if (prod) {
                    onSelectProduct(selectedProduct === prod ? null : prod);
                  }
                }}
              >
                {chartData.map((entry) => {
                  const isSelected = activeTrendProduct === entry.product;
                  return (
                    <Cell
                      key={`${entry.product}-${entry.category}`}
                      fill={isSelected ? '#4f46e5' : accentColor}
                      fillOpacity={activeTrendProduct && !isSelected ? 0.45 : 0.9}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Selected Item Daily & Hourly Trend Drilldown */}
      {itemTrend && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Item Trend: {itemTrend.product}
                </h3>
                <p className="text-xs text-slate-600">
                  Total Sold: <strong>{formatInt(itemTrend.totalQty)}</strong> · Revenue:{' '}
                  <strong>{formatRM(itemTrend.totalSales)}</strong>
                  {itemTrend.totalQty > 0 && (
                    <>
                      {' '}
                      · Avg: <strong>{formatRM(itemTrend.totalSales / itemTrend.totalQty)}</strong>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-white p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setTrendMetric('sales')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                    trendMetric === 'sales'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sales (RM)
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMetric('qty')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                    trendMetric === 'qty'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Qty Sold
                </button>
              </div>

              {selectedProduct && (
                <button
                  type="button"
                  onClick={() => onSelectProduct(null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Daily Trend */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                Daily {trendMetric === 'sales' ? 'Sales (RM)' : 'Quantity'}
              </p>
              {itemTrend.daily.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  No daily breakdown available for this item.
                </p>
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={itemTrend.daily} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="dateKey" tick={{ fontSize: 10, fill: '#475569' }} />
                      <YAxis
                        tickFormatter={(v) =>
                          trendMetric === 'sales' ? formatCompactRM(Number(v)) : formatInt(Number(v))
                        }
                        tick={{ fontSize: 10, fill: '#475569' }}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          trendMetric === 'sales' ? formatRM(value) : formatInt(value),
                          trendMetric === 'sales' ? 'Sales' : 'Qty',
                        ]}
                        contentStyle={{ borderRadius: '10px', fontSize: '12px' }}
                      />
                      <Bar
                        dataKey={trendMetric}
                        fill="#4f46e5"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Hourly Trend */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                Hourly {trendMetric === 'sales' ? 'Sales (RM)' : 'Quantity'}
              </p>
              {!dataset.capabilities.hasHourly ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  Hourly timestamps are not available in this dataset.
                </p>
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={itemTrend.hourly} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} />
                      <YAxis
                        tickFormatter={(v) =>
                          trendMetric === 'sales' ? formatCompactRM(Number(v)) : formatInt(Number(v))
                        }
                        tick={{ fontSize: 10, fill: '#475569' }}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          trendMetric === 'sales' ? formatRM(value) : formatInt(value),
                          trendMetric === 'sales' ? 'Sales' : 'Qty',
                        ]}
                        contentStyle={{ borderRadius: '10px', fontSize: '12px' }}
                      />
                      <Area
                        type="monotone"
                        dataKey={trendMetric}
                        stroke="#4f46e5"
                        fill="#4f46e5"
                        fillOpacity={0.18}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
