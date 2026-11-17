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

  const peakHour = [...salesByHour].sort((a, b) => b.totalSales - a.totalSales)[0];
  const dataKey =
    metric === 'sales' ? 'totalSales' : metric === 'tx' ? 'totalTx' : 'totalGuests';

  const headerControls = hasHourly ? (
    <div className="flex flex-wrap items-center gap-2">
      {peakHour && peakHour.totalSales > 0 && (
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          Peak Hour: <strong>{peakHour.label}</strong> ({formatRM(peakHour.totalSales)})
        </span>
      )}

      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 print:hidden">
        {(
          [
            ['sales', 'Sales (RM)'],
            ['tx', 'Transactions'],
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
      subtitle={`${outletLabel} · Hourly performance (00:00 – 23:00)`}
      data={hasHourly ? salesByHour : []}
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
          <AreaChart data={visibleData} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: isExpanded ? 12 : 11, fill: '#475569' }}
            />
            <YAxis
              tickFormatter={(v) =>
                metric === 'sales' ? formatCompactRM(Number(v)) : formatInt(Number(v))
              }
              tick={{ fontSize: isExpanded ? 12 : 11, fill: '#475569' }}
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
