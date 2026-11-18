import React, { useState } from 'react';
import { Ban, ReceiptText, Undo2 } from 'lucide-react';
import type { AggregatedReport, ReceiptRow } from '../utils/aggregator';
import { OUTLET_INFO } from '../utils/defaultMappings';
import { formatInt, formatRM } from '../utils/formatters';

interface ReceiptsPanelProps {
  report: AggregatedReport;
  outletLabel: string;
}

const PAGE = 25;

const STATUS_LABEL: Record<ReceiptRow['status'], string> = {
  valid: 'Completed',
  cancelled: 'Cancelled',
  draft: 'Draft (not paid)',
};

export const ReceiptsPanel: React.FC<ReceiptsPanelProps> = ({ report, outletLabel }) => {
  const [tab, setTab] = useState<'void' | 'refund'>('void');
  const [shown, setShown] = useState(PAGE);
  const voidRows = report.voidReceipts;
  const rows = tab === 'void' ? voidRows : report.refunds;
  const visible = rows.slice(0, shown);

  const cards = [
    {
      key: 'cancelled',
      icon: Ban,
      title: 'Cancelled receipts',
      count: report.voidSummary.cancelled.orders,
      value: report.voidSummary.cancelled.sales,
      note: 'Not counted in sales',
    },
    {
      key: 'draft',
      icon: ReceiptText,
      title: 'Draft / unpaid receipts',
      count: report.voidSummary.draft.orders,
      value: report.voidSummary.draft.sales,
      note: 'Not counted in sales',
    },
    {
      key: 'refund',
      icon: Undo2,
      title: 'Refunds',
      count: report.refundSummary.orders,
      value: report.refundSummary.sales,
      note: 'Included in sales (reduces the total)',
    },
  ];

  const switchTab = (next: 'void' | 'refund') => {
    setTab(next);
    setShown(PAGE);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Cancelled Receipts &amp; Refunds</h3>
        <p className="text-[11px] text-slate-500">
          {outletLabel} · follows the POS and date filters · amounts before tax
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <Icon className="h-4 w-4" />
                {c.title}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                {formatInt(c.count)}{' '}
                <span className="text-sm font-semibold text-slate-600">· {formatRM(c.value)}</span>
              </div>
              <div className="text-[11px] text-slate-500">{c.note}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
          {(
            [
              ['void', `Cancelled & draft (${formatInt(voidRows.length)})`],
              ['refund', `Refunds (${formatInt(report.refunds.length)})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => switchTab(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
                tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-400">
          {tab === 'void'
            ? 'No cancelled or draft receipts for the current filters.'
            : 'No refunds for the current filters.'}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-3 font-semibold">Date &amp; time</th>
                <th scope="col" className="px-3 py-2 font-semibold">Outlet</th>
                <th scope="col" className="px-3 py-2 font-semibold">Receipt</th>
                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2 font-semibold">Items</th>
                <th scope="col" className="py-2 pl-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr key={r.orderRef}>
                  <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-700">
                    {r.dateTime ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    <span
                      aria-hidden="true"
                      className="mr-1.5 inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: OUTLET_INFO[r.outlet].color }}
                    />
                    {r.outlet}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">{r.receipt || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        r.status === 'cancelled'
                          ? 'bg-rose-100 text-rose-800'
                          : r.status === 'draft'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {r.isRefund || tab === 'refund' ? 'Refund' : STATUS_LABEL[r.status]}
                      {r.isRefund && r.status !== 'valid' ? ` · ${STATUS_LABEL[r.status]}` : ''}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-slate-600" title={r.items.join('\n')}>
                    {r.items.length > 0 ? r.items.join(', ') : '—'}
                  </td>
                  <td
                    className={`whitespace-nowrap py-2 pl-3 text-right font-semibold tabular-nums ${
                      r.sales < 0 ? 'text-rose-700' : 'text-slate-900'
                    }`}
                  >
                    {formatRM(r.sales)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > shown && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE * 4)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Show more ({formatInt(rows.length - shown)} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
