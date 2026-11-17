import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyAggRow } from '../utils/aggregator';
import { formatCompactRM, formatRM } from '../utils/formatters';
import { ZoomableChartSection } from './ZoomableChartSection';

interface DailySalesChartProps {
  dailySales: DailyAggRow[];
  dailyPaymentsFallback: { dateKey: string; expected: number; counted: number }[];
  hasDailyItems: boolean;
  outletLabel: string;
  accentColor: string;
  onSelectDate?: (dateKey: string) => void;
}

export const DailySalesChart: React.FC<DailySalesChartProps> = ({
  dailySales,
  dailyPaymentsFallback,
  hasDailyItems,
  outletLabel,
  accentColor,
  onSelectDate,
}) => {
  const subtitle = hasDailyItems
    ? `${outletLabel} · Daily revenue trend${onSelectDate ? ' (click a date to filter)' : ''}`
    : 'Daily POS session payment totals extracted from PDF (combined outlets)';

  if (hasDailyItems) {
    return (
      <ZoomableChartSection
        title="Daily Sales"
        subtitle={subtitle}
        data={dailySales}
        getLabel={(item) => item.dateKey}
        emptyState={
          dailySales.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No daily sales data available for the current filters.
            </div>
          ) : undefined
        }
      >
        {(visibleData, isExpanded) => (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={visibleData}
              margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
              onClick={(state) => {
                const label = state?.activeLabel;
                if (onSelectDate && typeof label === 'string' && label) {
                  onSelectDate(label);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="dateKey"
                tick={{ fontSize: isExpanded ? 12 : 11, fill: '#475569' }}
              />
              <YAxis
                tickFormatter={(v) => formatCompactRM(Number(v))}
                tick={{ fontSize: isExpanded ? 12 : 11, fill: '#475569' }}
              />
              <Tooltip
                formatter={(value: number) => [formatRM(value), 'Daily Sales']}
                contentStyle={{
                  borderRadius: '12px',
                  borderColor: '#e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Line
                type="monotone"
                dataKey="totalSales"
                name={outletLabel}
                stroke={accentColor}
                strokeWidth={2.5}
                dot={{ r: isExpanded ? 4 : 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ZoomableChartSection>
    );
  }

  return (
    <ZoomableChartSection
      title="Daily Sales"
      subtitle={subtitle}
      data={dailyPaymentsFallback}
      getLabel={(item) => item.dateKey}
      emptyState={
        dailyPaymentsFallback.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No daily sales data available for the current filters.
          </div>
        ) : undefined
      }
    >
      {(visibleData, isExpanded) => (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={visibleData}
            margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="dateKey"
              tick={{ fontSize: isExpanded ? 12 : 11, fill: '#475569' }}
            />
            <YAxis
              tickFormatter={(v) => formatCompactRM(Number(v))}
              tick={{ fontSize: isExpanded ? 12 : 11, fill: '#475569' }}
            />
            <Tooltip
              formatter={(value: number) => [formatRM(value), 'Expected']}
              contentStyle={{
                borderRadius: '12px',
                borderColor: '#e2e8f0',
                fontSize: '12px',
              }}
            />
            <Bar
              dataKey="expected"
              name="Daily Session Expected"
              fill={accentColor}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ZoomableChartSection>
  );
};
