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
import { formatCompactRM, formatRM, formatShortDate } from '../utils/formatters';
import { ZoomableChartSection } from './ZoomableChartSection';
import type { Outlet } from '../types/pos';
import { OUTLET_INFO } from '../utils/defaultMappings';

interface DailySalesChartProps {
  dailySales: DailyAggRow[];
  /** When set (All Outlets view), each outlet is drawn as its own stacked bar. */
  outletsInData?: Outlet[] | null;
  dailyPaymentsFallback: { dateKey: string; expected: number; counted: number }[];
  hasDailyItems: boolean;
  outletLabel: string;
  accentColor: string;
  onSelectDate?: (dateKey: string) => void;
}

export const DailySalesChart: React.FC<DailySalesChartProps> = ({
  dailySales,
  outletsInData,
  dailyPaymentsFallback,
  hasDailyItems,
  outletLabel,
  accentColor,
  onSelectDate,
}) => {
  const subtitle = hasDailyItems
    ? `${outletLabel} · Daily revenue trend${onSelectDate ? ' (click a date to filter)' : ''}`
    : 'Daily POS session payment totals extracted from PDF (combined outlets)';

  if (hasDailyItems && outletsInData && outletsInData.length > 0) {
    return (
      <ZoomableChartSection
        title="Daily Sales"
        subtitle={`By outlet · stacked daily revenue${onSelectDate ? ' (click a date to filter)' : ''}`}
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
            <BarChart
              data={visibleData}
              margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
              onClick={(state) => {
                const label = state?.activeLabel;
                if (onSelectDate && typeof label === 'string' && label) {
                  onSelectDate(label);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="dateKey"
                tickFormatter={formatShortDate}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                minTickGap={24}
                tick={{ fontSize: isExpanded ? 12 : 11, fill: '#64748b' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v) => formatCompactRM(Number(v))}
                tick={{ fontSize: isExpanded ? 12 : 11, fill: '#64748b' }}
              />
              <Tooltip
                labelFormatter={(label) => `${formatShortDate(String(label))} (${String(label)})`}
                formatter={(value: number, name: string) => [formatRM(value), name]}
                contentStyle={{
                  borderRadius: '12px',
                  borderColor: '#e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {outletsInData.map((o) => (
                <Bar
                  key={o}
                  dataKey={(row: DailyAggRow) => row.outletSales[o] ?? 0}
                  name={o}
                  stackId="outlets"
                  fill={OUTLET_INFO[o].color}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ZoomableChartSection>
    );
  }

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
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="dateKey"
                tickFormatter={formatShortDate}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                minTickGap={24}
                tick={{ fontSize: isExpanded ? 12 : 11, fill: '#64748b' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v) => formatCompactRM(Number(v))}
                tick={{ fontSize: isExpanded ? 12 : 11, fill: '#64748b' }}
              />
              <Tooltip
                labelFormatter={(label) => `${formatShortDate(String(label))} (${String(label)})`}
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
                dot={visibleData.length <= 20 ? { r: isExpanded ? 4 : 3 } : false}
                activeDot={{ r: 5 }}
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
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="dateKey"
              tickFormatter={formatShortDate}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              minTickGap={24}
              tick={{ fontSize: isExpanded ? 12 : 11, fill: '#64748b' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v) => formatCompactRM(Number(v))}
              tick={{ fontSize: isExpanded ? 12 : 11, fill: '#64748b' }}
            />
            <Tooltip
              labelFormatter={(label) => `${formatShortDate(String(label))} (${String(label)})`}
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
              maxBarSize={36}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ZoomableChartSection>
  );
};
