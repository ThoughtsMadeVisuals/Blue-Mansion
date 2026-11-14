import React from 'react';
import { Users } from 'lucide-react';
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
import type { DailyAggRow } from '../utils/aggregator';
import type { DatasetCapabilities } from '../types/pos';
import { formatInt } from '../utils/formatters';

interface GuestsAndTransactionsPanelProps {
  dailySales: DailyAggRow[];
  capabilities: DatasetCapabilities;
}

export const GuestsAndTransactionsPanel: React.FC<GuestsAndTransactionsPanelProps> = ({
  dailySales,
  capabilities,
}) => {
  const showTx = capabilities.hasOrderLevelTransactions && dailySales.length > 0;
  const showGuests = capabilities.hasGuests && dailySales.length > 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Amount of Guest */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900">Amount of Guest (Daily)</h2>
          <p className="text-xs text-slate-500">
            Total covers/guests per day comparing Mangga vs. Indigo Bar
          </p>
        </div>

        {!showGuests ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-200 bg-amber-50/50 py-10 text-center">
            <Users className="mb-2 h-6 w-6 text-amber-500" />
            <p className="text-sm font-medium text-slate-800">
              Guest counts require an Odoo Orders CSV/Excel export
            </p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Include the <code>Guests</code> / <code>Customer Count</code> column when exporting
              from Odoo POS.
            </p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySales} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dateKey" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(v: number, name: string) => [formatInt(v), name]}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="manggaGuests" name="Mangga Guests" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="indigoGuests" name="Indigo Bar Guests" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Transactions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900">Transactions (Daily)</h2>
          <p className="text-xs text-slate-500">
            Distinct POS orders/receipts per day comparing Mangga vs. Indigo Bar
          </p>
        </div>

        {!showTx ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              {capabilities.totalPdfTransactions
                ? `Total Combined Transactions (PDF): ${formatInt(capabilities.totalPdfTransactions)}`
                : 'No order-level transactions available'}
            </p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Upload an Odoo Orders CSV/Excel export with <code>Order Ref</code> and{' '}
              <code>Order Date</code> to break down transactions by day and outlet.
            </p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySales} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dateKey" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(v: number, name: string) => [formatInt(v), name]}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="manggaTx" name="Mangga Orders" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="indigoTx" name="Indigo Bar Orders" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
};
