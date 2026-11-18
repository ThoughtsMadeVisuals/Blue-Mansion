import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { ParsedDataset } from '../types';
import { int, rm, shortDate } from '../lib/format';

export const FileStatus: React.FC<{ ds: ParsedDataset }> = ({ ds }) => {
  const [open, setOpen] = useState(false);
  const warnCount = ds.files.reduce((n, f) => n + f.warnings.length, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white text-xs shadow-sm print:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="flex flex-wrap items-center gap-2 text-slate-700">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <b>{ds.files.length} file{ds.files.length > 1 ? 's' : ''} loaded</b>
          <span className="text-slate-500">
            · {int(ds.orders.length)} orders · {int(ds.lines.length)} item lines
          </span>
          {warnCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
              <AlertTriangle className="h-3 w-3" /> {warnCount} note{warnCount > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 text-slate-500">
          File details {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-4">
          {ds.files.map((f) => (
            <div key={f.fileName} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold text-slate-800">{f.fileName}</div>
                <div className="text-slate-500">
                  {f.dateFrom && f.dateTo ? `${shortDate(f.dateFrom)} → ${shortDate(f.dateTo)}` : 'No dates'}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600 sm:grid-cols-4">
                <span>Orders kept: <b>{int(f.ordersKept)}</b></span>
                <span>Item lines: <b>{int(f.linesKept)}</b></span>
                <span>
                  Cancelled excluded: <b>{int(f.cancelledOrders)}</b> ({rm(f.cancelledSales, 0)})
                </span>
                <span>
                  Unpaid drafts excluded: <b>{int(f.draftOrders)}</b> ({rm(f.draftSales, 0)})
                </span>
                {f.duplicateOrders > 0 && (
                  <span>Already loaded (skipped): <b>{int(f.duplicateOrders)}</b></span>
                )}
                <span className="col-span-2 sm:col-span-4">Points of sale: {f.posNames.join(', ') || '—'}</span>
              </div>
              {f.warnings.map((w, i) => (
                <div key={i} className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                </div>
              ))}
            </div>
          ))}
          {ds.inferredCategoryLines > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-sky-50 p-2 text-sky-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {int(ds.inferredCategoryLines)} item lines had no category in their file and were given the category of
              the same item in another file.
            </div>
          )}
          <div className="text-slate-500">
            Sales use the Order Lines Tax Excl. amount by default (switch to Tax Incl. in the header). Transactions count
            each receipt once; refunds reduce sales but are not counted as transactions or guests.
          </div>
        </div>
      )}
    </div>
  );
};
