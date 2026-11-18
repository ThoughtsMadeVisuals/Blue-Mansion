import React, { useMemo } from 'react';
import { BookOpenCheck } from 'lucide-react';
import type { FilterState, Outlet, ParsedDataset } from '../types/pos';
import type { AggregatedReport } from '../utils/aggregator';
import { EXCLUDED_OUTLETS, OUTLET_INFO } from '../utils/defaultMappings';
import { ITEM_TYPES } from '../types/pos';
import { formatInt, formatRM } from '../utils/formatters';

interface MethodologyPanelProps {
  dataset: ParsedDataset;
  report: AggregatedReport;
  filters: FilterState;
}

interface FileStats {
  receipts: number;
  sales: number;
  voidReceipts: number;
  voidSales: number;
  refunds: number;
}

const COLUMN_LABELS: [keyof NonNullable<NonNullable<ParsedDataset['fileSummaries']>[number]['columns']>, string][] = [
  ['sales', 'Sales amount'],
  ['qty', 'Quantity'],
  ['product', 'Item name'],
  ['category', 'Category'],
  ['outlet', 'Outlet (Point of Sale)'],
  ['date', 'Date & time'],
  ['receipt', 'Receipt number'],
  ['orderRef', 'Order ref'],
  ['status', 'Order status'],
  ['guests', 'Guests'],
];

const H = ({ children }: { children: React.ReactNode }) => (
  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h4>
);

export const MethodologyPanel: React.FC<MethodologyPanelProps> = ({ dataset, report, filters }) => {
  const summaries = dataset.fileSummaries ?? [];

  const { perFile, voidTotal, refundTotal } = useMemo(() => {
    const perFile = new Map<string, FileStats>();
    const orders = new Map<string, { file: string; status: string; refund: boolean; sales: number }>();
    for (const l of dataset.lines) {
      const o = orders.get(l.orderRef) ?? {
        file: l.sourceFile,
        status: l.orderStatus ?? 'valid',
        refund: l.isRefund ?? false,
        sales: 0,
      };
      o.sales += l.subtotal;
      orders.set(l.orderRef, o);
    }
    const voidTotal = { orders: 0, sales: 0 };
    const refundTotal = { orders: 0, sales: 0 };
    for (const o of orders.values()) {
      const s = perFile.get(o.file) ?? { receipts: 0, sales: 0, voidReceipts: 0, voidSales: 0, refunds: 0 };
      if (o.status !== 'valid') {
        s.voidReceipts += 1;
        s.voidSales += o.sales;
        voidTotal.orders += 1;
        voidTotal.sales += o.sales;
      } else {
        s.receipts += 1;
        s.sales += o.sales;
        if (o.refund || o.sales < 0) {
          s.refunds += 1;
          refundTotal.orders += 1;
          refundTotal.sales += o.sales;
        }
      }
      perFile.set(o.file, s);
    }
    return { perFile, voidTotal, refundTotal };
  }, [dataset]);

  const excluded = useMemo(() => {
    const map = new Map<Outlet, { lines: number; sales: number }>();
    for (const s of summaries) {
      for (const e of s.excluded ?? []) {
        const prev = map.get(e.outlet) ?? { lines: 0, sales: 0 };
        prev.lines += e.lines;
        prev.sales += e.sales;
        map.set(e.outlet, prev);
      }
    }
    return Array.from(map.entries());
  }, [summaries]);

  const signFixes = summaries.reduce(
    (acc, s) => ({
      receipts: acc.receipts + (s.signFixes?.receipts ?? 0),
      lines: acc.lines + (s.signFixes?.lines ?? 0),
    }),
    { receipts: 0, lines: 0 }
  );
  const duplicatesSkipped = summaries.reduce((acc, s) => acc + (s.duplicateOrdersSkipped ?? 0), 0);
  const salesColumns = Array.from(new Set(summaries.map((s) => s.columns?.sales).filter(Boolean)));
  const otherShare =
    report.kpis.total.sales !== 0
      ? (report.foodVsBev.find((f) => f.type === 'Other')?.totalSales ?? 0) / report.kpis.total.sales
      : 0;
  const hasCategory = summaries.some((s) => s.columns?.category);

  const activeFilters = [
    filters.outlets.length > 0 ? `POS: ${filters.outlets.join(', ')}` : 'POS: all outlets',
    filters.dateFrom || filters.dateTo
      ? `Dates: ${filters.dateFrom || report.dateBounds?.min || '…'} to ${filters.dateTo || report.dateBounds?.max || '…'}`
      : 'Dates: all',
    filters.foodBevFilter !== 'All' ? `${filters.foodBevFilter} only` : null,
    filters.searchQuery ? `Search: "${filters.searchQuery}"` : null,
  ].filter(Boolean);

  return (
    <section
      id="how-numbers-are-calculated"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <BookOpenCheck className="h-5 w-5 text-slate-600" />
        <h3 className="text-base font-semibold text-slate-900">How these numbers are calculated</h3>
      </div>

      <div className="grid grid-cols-1 gap-6 text-xs leading-relaxed text-slate-700 lg:grid-cols-2">
        {/* Sources */}
        <div className="lg:col-span-2">
          <H>Data used</H>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] text-slate-500">
                  <th scope="col" className="py-1.5 pr-3 font-semibold">File</th>
                  <th scope="col" className="px-3 py-1.5 text-right font-semibold">Rows read</th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">Period</th>
                  <th scope="col" className="px-3 py-1.5 text-right font-semibold">Receipts counted</th>
                  <th scope="col" className="px-3 py-1.5 text-right font-semibold">Sales counted</th>
                  <th scope="col" className="py-1.5 pl-3 text-right font-semibold">Cancelled / draft</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map((s) => {
                  const st = perFile.get(s.fileId);
                  return (
                    <tr key={s.fileId}>
                      <td className="py-1.5 pr-3 font-medium text-slate-800">{s.fileName}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {s.rowsRead !== undefined ? formatInt(s.rowsRead) : '—'}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums">
                        {s.dateFrom && s.dateTo ? `${s.dateFrom} to ${s.dateTo}` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatInt(st?.receipts ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatRM(st?.sales ?? 0)}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums">
                        {formatInt(st?.voidReceipts ?? 0)} · {formatRM(st?.voidSales ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Figures in this table cover each whole file (all dates and outlets in the report), not
            just the current filters.
          </p>
        </div>

        {/* Included */}
        <div>
          <H>Included</H>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Outlets:{' '}
              <strong>
                {report.outletsInData.length > 0
                  ? report.outletsInData.map((o) => OUTLET_INFO[o].name).join(', ')
                  : 'none'}
              </strong>
              .
            </li>
            <li>
              Completed receipts only (Odoo status Posted, Paid, Done or Invoiced, or no status
              column).
            </li>
            <li>
              Refunds: <strong>{formatInt(refundTotal.orders)}</strong> refund receipts (
              {formatRM(refundTotal.sales)}) are included and reduce sales, as in Odoo.
            </li>
            {signFixes.receipts > 0 && (
              <li>
                Sign corrections: on <strong>{formatInt(signFixes.receipts)}</strong> receipts
                ({formatInt(signFixes.lines)} lines) the export showed refund amounts without their
                minus sign, so the lines did not add up to the receipt’s own Total. Their sign was
                corrected so each receipt matches Odoo’s Total.
              </li>
            )}
            <li>
              Every item line, including set-menu items priced at RM 0 (they add to Items Sold but
              not to sales).
            </li>
          </ul>
        </div>

        {/* Excluded */}
        <div>
          <H>Not included</H>
          <ul className="list-disc space-y-1 pl-4">
            {excluded.length > 0 ? (
              excluded.map(([outlet, v]) => (
                <li key={outlet}>
                  {OUTLET_INFO[outlet].name}: {formatInt(v.lines)} item lines ({formatRM(v.sales)})
                </li>
              ))
            ) : (
              <li>
                Outlets left out of this report:{' '}
                {[...EXCLUDED_OUTLETS].map((o) => OUTLET_INFO[o].name).join(', ')} (none found in
                the loaded files).
              </li>
            )}
            <li>
              Cancelled and draft receipts: <strong>{formatInt(voidTotal.orders)}</strong> (
              {formatRM(voidTotal.sales)}). Listed under Cancelled Receipts &amp; Refunds.
            </li>
            <li>
              Receipts already loaded from another file:{' '}
              <strong>{formatInt(duplicatesSkipped)}</strong> skipped, so nothing is counted twice.
            </li>
            <li>Blank separator rows and “Total” rows in the export.</li>
          </ul>
        </div>

        {/* Definitions */}
        <div className="lg:col-span-2">
          <H>What each number means</H>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-900">Sales</dt>
              <dd>
                Sum of the item amounts before tax
                {salesColumns.length > 0 ? ` (column “${salesColumns.join('”, “')}”)` : ''}. They are
                lower than Odoo’s “Total”, which includes tax.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Transactions / Orders</dt>
              <dd>
                Number of receipts. Each order row in the export is one receipt, identified by its
                Receipt Number, because Odoo’s Order Ref repeats (often “/”).
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Guests</dt>
              <dd>The Guests value of each receipt, counted once per receipt.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Avg Ticket · Per Guest</dt>
              <dd>Sales ÷ receipts, and sales ÷ guests.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Items Sold (Qty)</dt>
              <dd>Sum of item quantities, including RM 0 set-menu items.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Outlet</dt>
              <dd>
                Taken from the Point of Sale column, matched by name (for example “The Bar” is Indigo
                Bar). Unrecognised names can be fixed in Mapping Rules.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Hours &amp; days</dt>
              <dd>From the order date and time, exactly as exported from Odoo.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Sales types</dt>
              <dd>
                Every item is put in one type: {ITEM_TYPES.join(', ')}.{' '}
                {hasCategory
                  ? 'The type comes from the item’s category, then its name.'
                  : 'The export has no category column, so the type comes from the item name and its menu code (for example [BV] drinks, [SW] sweets, (MG) wine by the glass).'}{' '}
                Anything not recognised is “Other” (currently {(otherShare * 100).toFixed(1)}% of
                sales). You can change any item’s type under Sales by Type; your choices are saved.
              </dd>
            </div>
          </dl>
        </div>

        {/* Columns per file */}
        <div className="lg:col-span-2">
          <H>Columns read from each file</H>
          <div className="space-y-1.5">
            {summaries.map((s) => (
              <p key={s.fileId}>
                <span className="font-medium text-slate-900">{s.fileName}:</span>{' '}
                {COLUMN_LABELS.filter(([k]) => s.columns?.[k])
                  .map(([k, label]) => `${label} ← “${s.columns?.[k]}”`)
                  .join(' · ') || 'not recorded (re-upload the file to see this)'}
              </p>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          <strong>Filters applied to the report above:</strong> {activeFilters.join(' · ')}. All data
          stays in this browser; nothing is uploaded to a server.
        </div>
      </div>
    </section>
  );
};
