import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HourAggRow } from '../utils/aggregator';
import { formatCompactRM, formatInt, formatRM } from '../utils/formatters';

interface SalesByHoursChartProps {
  salesByHour: HourAggRow[];
  hasHourly: boolean;
}

export const SalesByHoursChart: React.FC<SalesByHoursChartProps> = ({
  salesByHour,
  hasHourly,
}) => {
  const [metric, setMetric] = useState<'sales' | 'tx' | 'guests'>('sales');

  const manggaPeak = [...salesByHour].sort((a, b) => b.manggaSales - a.manggaSales)[0];
  const indigoPeak = [...salesByHour].sort((a, b) => b.indigoSales - a.indigoSales)[0];

  const dataKeyMangga =
    metric === 'sales' ? 'manggaSales' : metric === 'tx' ? 'manggaTx' : 'manggaGuests';
  const dataKeyIndigo =
    metric === 'sales' ? 'indigoSales' : metric === 'tx' ? 'indigoTx' : 'indigoGuests';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Sales by Hours</h2>
          <p className="text-xs text-slate-500">
            Hourly performance (00:00 – 23:00) comparing Mangga vs. Indigo Bar
          </p>
        </div>

        {hasHourly && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              {manggaPeak && manggaPeak.manggaSales > 0 && (
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
                  Mangga Peak: {manggaPeak.label}
                </span>
              )}
              {indigoPeak && indigoPeak.indigoSales > 0 && (
                <span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-medium text-indigo-800">
                  Indigo Peak: {indigoPeak.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
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
        )}
      </div>

      {!hasHourly ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50/50 py-10 text-center">
          <Clock className="mb-2 h-6 w-6 text-amber-500" />
          <p className="text-sm font-medium text-slate-800">
            Hourly timestamps are not included in Sales_Details.pdf
          </p>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            Export <strong>Point of Sale → Orders → Orders</strong> as <code>.xlsx</code> or{' '}
            <code>.csv</code> with the <code>Order Date</code> column to unlock hourly sales,
            transactions, and peak-hour curves.
          </p>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesByHour} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis
                tickFormatter={(v) =>
                  metric === 'sales' ? formatCompactRM(Number(v)) : formatInt(Number(v))
                }
                tick={{ fontSize: 11, fill: '#475569' }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  metric === 'sales' ? formatRM(value) : formatInt(value),
                  name,
                ]}
                contentStyle={{
                  borderRadius: '12px',
                  borderColor: '#e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area
                type="monotone"
                dataKey={dataKeyMangga}
                name="Mangga"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey={dataKeyIndigo}
                name="Indigo Bar"
                stroke="#4f46e5"
                fill="#4f46e5"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
