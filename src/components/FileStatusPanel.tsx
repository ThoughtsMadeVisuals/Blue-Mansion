import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import type { Outlet, ParsedDataset, UploadedFileSummary } from '../types/pos';
import { OUTLET_INFO, REPORTED_OUTLETS } from '../utils/defaultMappings';
import { formatInt } from '../utils/formatters';

interface FileStatusPanelProps {
  dataset: ParsedDataset;
}

function deriveSummaries(dataset: ParsedDataset): UploadedFileSummary[] {
  if (dataset.fileSummaries && dataset.fileSummaries.length > 0) {
    return dataset.fileSummaries;
  }
  return dataset.capabilities.sourceFiles.map((fileName) => {
    const fileLines = dataset.lines.filter((l) => l.id.startsWith(`${fileName}-`));
    const dates = fileLines
      .map((l) => l.dateKey)
      .filter((d): d is string => Boolean(d))
      .sort();
    const outlets = Array.from(
      new Set<string>(fileLines.map((l) => l.outlet))
    ).filter((o) => o !== 'Unassigned');

    return {
      fileName,
      lineCount: fileLines.length,
      outlets,
      dateFrom: dates[0] ?? null,
      dateTo: dates[dates.length - 1] ?? null,
      hasHourly: dataset.capabilities.hasHourly,
      hasGuests: dataset.capabilities.hasGuests,
    };
  });
}

export const FileStatusPanel: React.FC<FileStatusPanelProps> = ({ dataset }) => {
  const [expanded, setExpanded] = useState(false);
  const summaries = deriveSummaries(dataset);

  const outletCounts = new Map<Outlet, number>();
  for (const l of dataset.lines) {
    outletCounts.set(l.outlet, (outletCounts.get(l.outlet) ?? 0) + 1);
  }

  // Every entity is listed separately; the generic "Mangga" and "Unassigned"
  // buckets only appear when lines actually landed in them.
  const establishmentChecklist = REPORTED_OUTLETS.filter(
    (o) => (o !== 'Mangga' && o !== 'Unassigned') || (outletCounts.get(o) ?? 0) > 0
  ).map((o) => ({
    label: OUTLET_INFO[o].name,
    done: (outletCounts.get(o) ?? 0) > 0 && o !== 'Unassigned',
    warn: o === 'Unassigned' || o === 'Mangga',
    count: outletCounts.get(o) ?? 0,
  }));

  const criteriaChecklist = [
    { label: 'Items & Categories', done: dataset.lines.length > 0 },
    { label: 'Hourly Sales', done: dataset.capabilities.hasHourly },
    {
      label: 'Daily Sales',
      done: dataset.capabilities.hasDailyItems || dataset.capabilities.hasDailyPayments,
    },
    { label: 'Amount of Guests', done: dataset.capabilities.hasGuests },
    {
      label: 'Transactions',
      done:
        dataset.capabilities.hasOrderLevelTransactions ||
        Boolean(dataset.capabilities.totalPdfTransactions),
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700">
            Files Loaded ({summaries.length}):
          </span>
          {establishmentChecklist.map((item) => (
            <span
              key={item.label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${
                item.done
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {item.done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <CircleDashed className="h-3.5 w-3.5 text-amber-500" />
              )}
              {item.label}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
        >
          {expanded ? (
            <>
              Hide file details
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show file details
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 lg:grid-cols-3">
          {/* Added Files */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Files Added ({summaries.length})
            </h3>
            <div className="space-y-1.5">
              {summaries.map((file, idx) => (
                <div
                  key={`${file.fileName}-${idx}`}
                  className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs"
                >
                  <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">
                      {file.fileName}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {formatInt(file.lineCount)} rows
                      {file.dateFrom && file.dateTo
                        ? ` · ${file.dateFrom} to ${file.dateTo}`
                        : ''}
                    </div>
                    {file.outlets.length > 0 && (
                      <div className="mt-0.5 text-[11px] text-emerald-800">
                        Found: {file.outlets.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Establishments Status */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Establishments Status
            </h3>
            <div className="space-y-1.5">
              {establishmentChecklist.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                    item.done
                      ? 'border-emerald-200 bg-emerald-50/40 text-slate-800'
                      : 'border-amber-200 bg-amber-50/60 text-amber-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 font-medium">
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <CircleDashed className="h-4 w-4 text-amber-500" />
                    )}
                    {item.label}
                  </span>
                  <span className="text-[11px] font-medium">
                    {item.count > 0
                      ? `${formatInt(item.count)} lines${item.warn ? ' · check Mapping Rules' : ''}`
                      : 'Not added yet'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Report Data Coverage */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Report Data Coverage
            </h3>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
              {criteriaChecklist.map((c) => (
                <div
                  key={c.label}
                  className={`flex items-center justify-between rounded-xl border px-3 py-1.5 text-xs ${
                    c.done
                      ? 'border-slate-200 bg-slate-50 text-slate-800'
                      : 'border-amber-200 bg-amber-50/60 text-amber-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 font-medium">
                    {c.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    {c.label}
                  </span>
                  <span className="text-[11px] font-medium">
                    {c.done ? 'Ready' : 'Missing'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
