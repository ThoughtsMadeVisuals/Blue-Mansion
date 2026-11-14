import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoryAggRow, AggregatedReport } from '../utils/aggregator';
import { formatCompactRM, formatInt, formatRM } from '../utils/formatters';

interface SalesByCategoryChartProps {
  categories: CategoryAggRow[];
  foodVsBev: AggregatedReport['foodVsBev'];
}

export const SalesByCategoryChart: React.FC<SalesByCategoryChartProps> = ({
  categories,
  foodVsBev,
}) => {
  const topCategories = categories.slice(0, 12);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Sales by Category</h2>
          <p className="text-xs text-slate-500">
            Top {topCategories.length} categories comparing Mangga vs. Indigo Bar
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {foodVsBev
            .filter((f) => f.totalSales > 0)
            .map((fb) => (
              <div
                key={fb.type}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
              >
                <span className="font-semibold text-slate-700">{fb.type}: </span>
                <span className="font-bold text-slate-900">{formatRM(fb.totalSales)}</span>
                <span className="ml-1.5 text-slate-500">({formatInt(fb.totalQty)} qty)</span>
              </div>
            ))}
        </div>
      </div>

      {topCategories.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          No category data matches the current filters.
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topCategories}
              margin={{ top: 10, right: 16, left: 4, bottom: 36 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 11, fill: '#475569' }}
                angle={-25}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis
                tickFormatter={(v) => formatCompactRM(Number(v))}
                tick={{ fontSize: 11, fill: '#475569' }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatRM(value), name]}
                contentStyle={{
                  borderRadius: '12px',
                  borderColor: '#e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar
                dataKey="manggaSales"
                name="Mangga"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="indigoSales"
                name="Indigo Bar"
                fill="#4f46e5"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
