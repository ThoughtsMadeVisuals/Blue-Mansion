import React from 'react';
import { Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyAggRow } from '../utils/aggregator';
import type { DatasetCapabilities } from '../types/pos';
import { formatInt, formatShortDate } from '../utils/formatters';
import { ZoomableChartSection } from './ZoomableChartSection';

interface GuestsAndTransactionsPanelProps {
  dailySales: DailyAggRow[];
  capabilities: DatasetCapabilities;
  outletLabel: string;
  accentColor: string;
}

export const GuestsAndTransactionsPanel: React.FC<GuestsAndTransactionsPanelProps> = ({
  dailySales,
  capabilities,
  outletLabel,
  accentColor,
}) => {
  const showTx = capabilities.hasOrderLevelTransactions && dailySales.length > 0;
  const showGuests = capabilities.hasGuests && dailySales.length > 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Amount of Guest */}
      <ZoomableChartSection
        title="Amount of Guest (Daily)"
        subtitle={`${outletLabel} · Total covers/guests per day`}
        data={showGuests ? dailySales : []}
        getLabel={(item) => item.dateKey}
        heightClass="h-64"
        emptyState={
          !showGuests ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50/50 py-10 text-center">
              <Users className="mb-2 h-6 w-6 text-amber-500" />
              <p className="text-sm font-medium text-slate-800">
                Guest counts require an Odoo Orders CSV/Excel export
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Include the <code>Guests</code> column when exporting from Odoo POS.
              </p>
            </div>
          ) : undefined
        }
      >
        {(visibleData, isExpanded) => (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
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
                width={44}
                tick={{ fontSize: isExpanded ? 12 : 11, fill: '#64748b' }}
              />
              <Tooltip
                labelFormatter={(label) => `${formatShortDate(String(label))} (${String(label)})`}
                formatter={(v: number) => [formatInt(v), 'Guests']}
                contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
              />
              <Bar
                dataKey="totalGuests"
                name={`${outletLabel} Guests`}
                fill={accentColor}
                maxBarSize={32}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ZoomableChartSection>

      {/* Transactions */}
      <ZoomableChartSection
        title="Transactions (Daily)"
        subtitle={`${outletLabel} · Distinct POS orders/receipts per day`}
        data={showTx ? dailySales : []}
        getLabel={(item) => item.dateKey}
        heightClass="h-64"
        emptyState={
          !showTx ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                {capabilities.totalPdfTransactions
                  ? `Total Combined Transactions (PDF): ${formatInt(capabilities.totalPdfTransactions)}`
                  : 'No order-level transactions available'}
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Upload an Odoo Orders CSV/Excel export with <code>Order Ref</code> and{' '}
                <code>Date</code> to break down transactions by day.
              </p>
            </div>
          ) : undefined
        }
      >
        {(visibleData, isExpanded) => (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
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
                width={44}
                tick={{ fontSize: isExpanded ? 12 : 11, fill: '#64748b' }}
              />
              <Tooltip
                labelFormatter={(label) => `${formatShortDate(String(label))} (${String(label)})`}
                formatter={(v: number) => [formatInt(v), 'Transactions']}
                contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
              />
              <Bar
                dataKey="totalTx"
                name={`${outletLabel} Transactions`}
                fill={accentColor}
                maxBarSize={32}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ZoomableChartSection>
    </div>
  );
};
