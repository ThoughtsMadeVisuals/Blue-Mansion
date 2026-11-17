import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HourAggRow } from '../utils/aggregator';
import { formatCompactRM, formatInt, formatRM } from '../utils/formatters';
import { ZoomableChartSection } from './ZoomableChartSection';

interface SalesByHoursChartProps {
  salesByHour: HourAggRow[];
  hasHourly: boolean;
  outletLabel: string;
  accentColor: string;
}

export const SalesByHoursChart: React.FC<SalesByHoursChartProps> = ({
  salesByHour,
  hasHourly,
  outletLabel,
  accentColor,
}) => {
  const [metric, setMetric] = useState<'sales' | 'tx' | 'guests'>('sales');
  const [hoursScope, setHoursScope] = useState<'active' | 'all'>('active');

  const dataKey =
    metric === 'sales' ? 'totalSales' : metric === 'tx' ? 'totalTx' : 'totalGuests';

  const filteredHours = React.useMemo(() => {
    if (hoursScope === 'all' || salesByHour.length === 0) return salesByHour;
    const activeIndices = salesByHour
      .map((row, idx) => (row.totalSales > 0 || row.totalTx > 0 || row.totalGuests > 0 ? idx : -1))
      .filter((idx) => idx >= 0);
    if (activeIndices.length === 0) return salesByHour;
    const firstIdx = Math.max(0, activeIndices[0] - 1);
    const lastIdx = Math.min(salesByHour.length - 1, activeIndices[activeIndices.length - 1] + 1);
    return salesByHour.slice(firstIdx, lastIdx + 1);
  }, [hoursScope, salesByHour]);

  const peakHour = [...salesByHour].sort((a, b) => b[dataKey] - a[dataKey])[0];
  const peakValueFormatted =
    peakHour && peakHour[dataKey] > 0
      ? metric === 'sales'
        ? formatRM(peakHour.totalSales)
        : metric === 'tx'
          ? `${formatInt(peakHour.totalTx)} tx`
          : `${formatInt(peakHour.totalGuests)} guests`
      : null;

  const headerControls = hasHourly ? (
    <div className="flex flex-wrap items-center gap-2">
      {peakHour && peakValueFormatted && (
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          Peak: <strong>{peakHour.label}</strong> ({peakValueFormatted})
        </span>
      )}

      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 print:hidden">
        {(
          [
            ['active', 'Active Hours'],
            ['all', '24h'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setHoursScope(key)}
            className={`rounded-lg px-2 py-1 text-xs font-medium cursor-pointer ${
              hoursScope === key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 print:hidden">
        {(
          [
            ['sales', 'Sales'],
            ['tx', 'Orders'],
            ['guests', 'Guests'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMetric(key)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium cursor-pointer ${
              metric === key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  ) : undefined;

  return (
    <ZoomableChartSection
      title="Sales by Hours"
      subtitle={`${outletLabel} · Hourly performance`}
      data={hasHourly ? filteredHours : []}
      getLabel={(item) => item.label}
      headerExtra={headerControls}
      emptyState={
        !hasHourly ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50/50 py-10 text-center">
            <Clock className="mb-2 h-6 w-6 text-amber-500" />
            <p className="text-sm font-medium text-slate-800">
              Hourly timestamps are not available in this file
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              Upload an Odoo POS Orders <code>.xlsx</code> or <code>.csv</code> export with{' '}
              <code>Date</code> to view hourly sales and peak hours.
            </p>
          </div>
        ) : undefined
      }
    >
      {(visibleData, isExpanded) => (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visibleData} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              minTickGap={22}
              tick={{ fontSize: isExpanded ? 12 : 11, fill: '#64748b' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v) =>
                metric === 'sales' ? formatCompactRM(Number(v)) : formatInt(Number(v))
              }
              tick={{ fontSize: isExpanded ? 12 : 11, fill: '#64748b' }}
            />
            <Tooltip
              formatter={(value: number) => [
                metric === 'sales' ? formatRM(value) : formatInt(value),
                metric === 'sales'
                  ? 'Sales'
                  : metric === 'tx'
                    ? 'Transactions'
                    : 'Guests',
              ]}
              contentStyle={{
                borderRadius: '12px',
                borderColor: '#e2e8f0',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              name={outletLabel}
              stroke={accentColor}
              fill={accentColor}
              fillOpacity={0.2}
              strokeWidth={2.5}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ZoomableChartSection>
  );
};
