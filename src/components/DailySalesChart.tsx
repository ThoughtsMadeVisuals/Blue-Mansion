import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyAggRow } from '../utils/aggregator';
import { formatCompactRM, formatRM } from '../utils/formatters';

interface DailySalesChartProps {
  dailySales: DailyAggRow[];
  dailyPaymentsFallback: { dateKey: string; expected: number; counted: number }[];
  hasDailyItems: boolean;
}

export const DailySalesChart: React.FC<DailySalesChartProps> = ({
  dailySales,
  dailyPaymentsFallback,
  hasDailyItems,
}) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Daily Sales</h2>
          <p className="text-xs text-slate-500">
            {hasDailyItems
              ? 'Daily revenue trend comparing Mangga vs. Indigo Bar'
              : 'Daily POS session payment totals extracted from Sales_Details.pdf (combined outlets)'}
          </p>
        </div>
      </div>

      {hasDailyItems ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailySales} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dateKey" tick={{ fontSize: 11, fill: '#475569' }} />
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
              <Line
                type="monotone"
                dataKey="manggaSales"
                name="Mangga"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="indigoSales"
                name="Indigo Bar"
                stroke="#4f46e5"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : dailyPaymentsFallback.length > 0 ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dailyPaymentsFallback}
              margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dateKey" tick={{ fontSize: 11, fill: '#475569' }} />
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
                dataKey="expected"
                name="Daily Session Expected (Combined)"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="py-10 text-center text-xs text-slate-400">
          No daily sales data available for the current filters.
        </div>
      )}
    </section>
  );
};
