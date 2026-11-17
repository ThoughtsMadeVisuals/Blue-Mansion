import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoryAggRow, AggregatedReport } from '../utils/aggregator';
import { formatCompactRM, formatInt, formatRM } from '../utils/formatters';
import { ZoomableChartSection } from './ZoomableChartSection';

interface SalesByCategoryChartProps {
  categories: CategoryAggRow[];
  foodVsBev: AggregatedReport['foodVsBev'];
  outletLabel: string;
  accentColor: string;
}

export const SalesByCategoryChart: React.FC<SalesByCategoryChartProps> = ({
  categories,
  foodVsBev,
  outletLabel,
  accentColor,
}) => {
  const topCategories = categories.slice(0, 12);

  const foodVsBevPills = (
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
  );

  return (
    <ZoomableChartSection
      title="Sales by Category"
      subtitle={`${outletLabel} · Top ${topCategories.length} categories`}
      data={topCategories}
      getLabel={(item) => item.category}
      headerExtra={foodVsBevPills}
      heightClass="h-96"
      emptyState={
        topCategories.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No category data matches the current filters.
          </div>
        ) : undefined
      }
    >
      {(visibleData, isExpanded) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={visibleData}
            layout="vertical"
            margin={{ top: 6, right: 24, left: 8, bottom: 6 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCompactRM(Number(v))}
              tick={{ fontSize: isExpanded ? 12 : 11, fill: '#64748b' }}
            />
            <YAxis
              type="category"
              dataKey="category"
              axisLine={false}
              tickLine={false}
              width={150}
              tick={{ fontSize: isExpanded ? 12 : 11, fill: '#334155' }}
              interval={0}
            />
            <Tooltip
              formatter={(value: number) => [formatRM(value), 'Sales']}
              contentStyle={{
                borderRadius: '12px',
                borderColor: '#e2e8f0',
                fontSize: '12px',
              }}
            />
            <Bar
              dataKey="totalSales"
              name={`${outletLabel} Sales`}
              fill={accentColor}
              maxBarSize={24}
              radius={[0, 6, 6, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ZoomableChartSection>
  );
};
