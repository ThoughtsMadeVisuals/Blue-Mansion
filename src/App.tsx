import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Info, RotateCcw, X, XCircle } from 'lucide-react';
import type { FilterState, MappingRules, Outlet, ParsedDataset } from './types/pos';
import {
  OUTLET_INFO,
  clearMappingRules,
  createDefaultMappingRules,
  loadMappingRules,
  saveMappingRules,
} from './utils/defaultMappings';
import {
  clearAllStoredData,
  loadFilesFromStorage,
  saveFilesToStorage,
} from './utils/datasetStorage';
import { checkDuplicate, combineFiles, fileSummaryOf, hashFile } from './utils/fileSet';
import { parseCsvOrXlsxFile } from './parsers/csvXlsxParser';
import { parseSalesDetailsPdfFile } from './parsers/pdfSalesDetailsParser';
import { aggregateDataset, reapplyMappings } from './utils/aggregator';
import { buildSampleDataset } from './utils/sampleData';
import { FileUploadPanel } from './components/FileUploadPanel';
import { FileStatusPanel } from './components/FileStatusPanel';
import { FilterBar } from './components/FilterBar';
import { KpiCards } from './components/KpiCards';
import { MostSoldItemsPanel } from './components/MostSoldItemsPanel';
import { SalesByCategoryChart } from './components/SalesByCategoryChart';
import { SalesByHoursChart } from './components/SalesByHoursChart';
import { DailySalesChart } from './components/DailySalesChart';
import { GuestsAndTransactionsPanel } from './components/GuestsAndTransactionsPanel';
import { SalesByItemChart } from './components/SalesByItemChart';
import { SalesByItemTable } from './components/SalesByItemTable';
import { MappingModal } from './components/MappingModal';
import { OutletBreakdownPanel } from './components/OutletBreakdownPanel';
import { ReceiptsPanel } from './components/ReceiptsPanel';
import { MethodologyPanel } from './components/MethodologyPanel';

const INITIAL_FILTERS: FilterState = {
  outlets: [],
  dateFrom: '',
  dateTo: '',
  foodBevFilter: 'All',
  searchQuery: '',
};

interface Notice {
  id: number;
  tone: 'error' | 'warning' | 'info';
  text: string;
}

function getOutletLabel(outlets: Outlet[]): string {
  if (outlets.length === 0) return 'All Outlets';
  if (outlets.length === 1) return OUTLET_INFO[outlets[0]].name;
  return outlets.join(' + ');
}

function getAccentColor(outlets: Outlet[]): string {
  if (outlets.length === 1) return OUTLET_INFO[outlets[0]].color;
  return '#334155';
}

let noticeSeq = 0;

export function App() {
  const [rules, setRules] = useState<MappingRules>(() => loadMappingRules());
  const [files, setFiles] = useState<ParsedDataset[]>([]);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const addNotice = (tone: Notice['tone'], text: string) =>
    setNotices((prev) => [...prev, { id: ++noticeSeq, tone, text }]);

  useEffect(() => {
    let active = true;
    loadFilesFromStorage().then((saved) => {
      if (active && saved.length > 0) {
        setFiles(saved.map((f) => reapplyMappings(f, rules)));
      }
    });
    return () => {
      active = false;
    };
    // Only restore saved files once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitFiles = (next: ParsedDataset[]) => {
    setFiles(next);
    void saveFilesToStorage(next);
  };

  /** Add parsed files one by one, checking each against what is already loaded. */
  const addParsedFiles = (incoming: ParsedDataset[], current: ParsedDataset[]) => {
    let next = current;
    for (const parsed of incoming) {
      const name = fileSummaryOf(parsed)?.fileName ?? 'File';
      const check = checkDuplicate(parsed, next);
      if (check.kind === 'same') {
        const why =
          check.reason === 'identical'
            ? 'it is the exact same file'
            : check.reason === 'summary'
              ? 'it has the same totals and period'
              : `${check.overlap.toLocaleString('en-US')} of its ${check.total.toLocaleString('en-US')} receipts are already loaded`;
        addNotice(
          'error',
          `"${name}" was not added: it looks like the same data as "${check.duplicateOf.join('", "')}" (${why}). Remove that file first if you want to replace it.`
        );
        continue;
      }
      if (check.kind === 'partial') {
        addNotice(
          'warning',
          `"${name}" overlaps with "${check.duplicateOf.join('", "')}": ${check.overlap.toLocaleString('en-US')} of its ${check.total.toLocaleString('en-US')} receipts were already loaded, so they were skipped to avoid counting them twice.`
        );
      }
      next = [...next, check.dataset];
    }
    return next;
  };

  const handleFilesSelected = async (fileList: FileList) => {
    setIsLoading(true);
    try {
      const parsedFiles: ParsedDataset[] = [];
      for (const file of Array.from(fileList)) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const fileId = `${file.name}@${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        let parsed: ParsedDataset | null = null;
        try {
          if (ext === 'pdf') {
            parsed = await parseSalesDetailsPdfFile(file, rules, fileId);
          } else if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
            parsed = await parseCsvOrXlsxFile(file, rules, fileId);
          } else {
            addNotice('error', `Unsupported file format: ${file.name}. Please upload .csv, .xlsx, or .pdf.`);
          }
        } catch (err) {
          addNotice(
            'error',
            `Could not read "${file.name}": ${err instanceof Error ? err.message : 'unknown error'}`
          );
        }
        if (!parsed) continue;
        const contentHash = await hashFile(file);
        parsed = {
          ...parsed,
          fileSummaries: (parsed.fileSummaries ?? []).map((s) => ({
            ...s,
            contentHash,
            uploadedAt: new Date().toISOString(),
          })),
        };
        parsedFiles.push(parsed);
      }
      const next = addParsedFiles(parsedFiles, files);
      if (next !== files) {
        commitFiles(next);
        setFilters(INITIAL_FILTERS);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = () => {
    const next = addParsedFiles([buildSampleDataset(rules)], files);
    if (next !== files) {
      commitFiles(next);
      setFilters(INITIAL_FILTERS);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    const target = files.find((f) => fileSummaryOf(f)?.fileId === fileId);
    const name = target ? fileSummaryOf(target)?.fileName : 'this file';
    if (!window.confirm(`Remove "${name}" and all of its data from the report?`)) return;
    commitFiles(files.filter((f) => fileSummaryOf(f)?.fileId !== fileId));
    setSelectedProduct(null);
    addNotice('info', `Removed "${name}".`);
  };

  const handleResetAll = () => {
    if (
      !window.confirm(
        'Reset the whole app? This removes every loaded file, your mapping rules and all filters from this browser.'
      )
    ) {
      return;
    }
    setFiles([]);
    setFilters(INITIAL_FILTERS);
    setSelectedProduct(null);
    setIsMappingOpen(false);
    clearMappingRules();
    setRules(createDefaultMappingRules());
    void clearAllStoredData();
    setNotices([{ id: ++noticeSeq, tone: 'info', text: 'App reset. All data has been cleared.' }]);
  };

  const handleSaveRules = (nextRules: MappingRules) => {
    setRules(nextRules);
    saveMappingRules(nextRules);
    if (files.length > 0) commitFiles(files.map((f) => reapplyMappings(f, nextRules)));
  };

  const dataset = useMemo(() => combineFiles(files), [files]);

  // Distinct POS config/session names, with the outlet each currently maps to
  const configNames = useMemo(() => {
    if (!dataset) return [];
    const map = new Map<string, { name: string; outlet: Outlet; lines: number }>();
    for (const l of dataset.lines) {
      if (l.sourceType !== 'csv_xlsx' || !l.rawConfig) continue;
      const prev = map.get(l.rawConfig);
      if (prev) prev.lines += 1;
      else map.set(l.rawConfig, { name: l.rawConfig, outlet: l.outlet, lines: 1 });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [dataset]);

  const report = useMemo(() => {
    if (!dataset) return null;
    return aggregateDataset(dataset, filters);
  }, [dataset, filters]);

  // Drop selected outlets that no longer have data (e.g. after removing a file)
  useEffect(() => {
    if (!report || filters.outlets.length === 0) return;
    const kept = filters.outlets.filter((o) => report.outletsInData.includes(o));
    if (kept.length !== filters.outlets.length) {
      setFilters((prev) => ({ ...prev, outlets: kept }));
    }
  }, [report, filters.outlets]);

  const outletLabel = getOutletLabel(filters.outlets);
  const accentColor = getAccentColor(filters.outlets);
  const stackedOutlets =
    report && filters.outlets.length !== 1
      ? filters.outlets.length > 1
        ? report.outletsInData.filter((o) => filters.outlets.includes(o))
        : report.outletsInData
      : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">POS Sales Analytics</h1>
              <p className="text-xs text-slate-500">
                Odoo POS Management Report (Food &amp; Beverage · Hourly · Daily · Guests · Transactions)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 cursor-pointer print:hidden"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset App
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6">
        <div className="print:hidden space-y-4">
          <FileUploadPanel
            onFilesSelected={handleFilesSelected}
            onLoadSample={handleLoadSample}
            isLoading={isLoading}
            compact={Boolean(dataset)}
          />
          {dataset && <FileStatusPanel dataset={dataset} onRemoveFile={handleRemoveFile} />}
        </div>

        {notices.length > 0 && (
          <div className="space-y-2 print:hidden" aria-live="polite">
            {notices.map((n) => {
              const tone =
                n.tone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : n.tone === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-sky-200 bg-sky-50 text-sky-900';
              const Icon = n.tone === 'error' ? XCircle : n.tone === 'warning' ? AlertTriangle : Info;
              return (
                <div
                  key={n.id}
                  role={n.tone === 'error' ? 'alert' : 'status'}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${tone}`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="flex-1">{n.text}</span>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => setNotices((prev) => prev.filter((x) => x.id !== n.id))}
                    className="rounded p-0.5 opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {dataset && dataset.warnings.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            {dataset.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {dataset && report && (
          <>
            <FilterBar
              filters={filters}
              onChange={setFilters}
              dateBounds={report.dateBounds}
              availableDates={report.availableDates}
              allProducts={report.allProducts}
              allCategories={report.allCategories}
              unassignedCount={report.unassignedItemsCount}
              outletsInData={report.outletsInData}
              onOpenMapping={() => setIsMappingOpen(true)}
            />

            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {outletLabel} — Management Sales Report
                </h2>
                <p className="text-xs text-slate-500">
                  {report.dateBounds
                    ? `Period: ${filters.dateFrom || report.dateBounds.min} to ${filters.dateTo || report.dateBounds.max}`
                    : dataset.capabilities.dateRangeLabel || 'Uploaded POS Report'}
                  {filters.foodBevFilter !== 'All' ? ` · ${filters.foodBevFilter} only` : ''}
                </p>
              </div>
            </div>

            <KpiCards report={report} capabilities={dataset.capabilities} outletLabel={outletLabel} />

            <OutletBreakdownPanel
              rows={report.outletBreakdown}
              capabilities={dataset.capabilities}
              activeOutlets={filters.outlets}
              onChangeOutlets={(outlets) => setFilters((prev) => ({ ...prev, outlets }))}
            />

            <MostSoldItemsPanel
              topFood={report.topFood}
              topBeverage={report.topBeverage}
              outletLabel={outletLabel}
              accentColor={accentColor}
            />

            <SalesByCategoryChart
              categories={report.salesByCategory}
              foodVsBev={report.foodVsBev}
              outletLabel={outletLabel}
              accentColor={accentColor}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SalesByHoursChart
                salesByHour={report.salesByHour}
                hasHourly={dataset.capabilities.hasHourly}
                outletLabel={outletLabel}
                accentColor={accentColor}
              />
              <DailySalesChart
                dailySales={report.dailySales}
                outletsInData={stackedOutlets}
                dailyPaymentsFallback={report.dailyPaymentsFallback}
                hasDailyItems={dataset.capabilities.hasDailyItems}
                outletLabel={outletLabel}
                accentColor={accentColor}
                onSelectDate={(dateKey) =>
                  setFilters((prev) => ({ ...prev, dateFrom: dateKey, dateTo: dateKey }))
                }
              />
            </div>

            <GuestsAndTransactionsPanel
              dailySales={report.dailySales}
              capabilities={dataset.capabilities}
              outletLabel={outletLabel}
              accentColor={accentColor}
            />

            <SalesByItemChart
              items={report.salesByItem}
              dataset={dataset}
              filters={filters}
              allCategories={report.allCategories}
              outletLabel={outletLabel}
              accentColor={accentColor}
              selectedProduct={selectedProduct}
              onSelectProduct={setSelectedProduct}
            />

            <SalesByItemTable
              items={report.salesByItem}
              totalSales={report.kpis.total.sales}
              outletLabel={outletLabel}
              selectedProduct={selectedProduct}
              onSelectProduct={setSelectedProduct}
            />

            <ReceiptsPanel report={report} outletLabel={outletLabel} />

            <MethodologyPanel dataset={dataset} report={report} filters={filters} />

            {isMappingOpen && (
              <MappingModal
                isOpen={isMappingOpen}
                onClose={() => setIsMappingOpen(false)}
                categories={report.allCategories}
                configNames={configNames}
                rules={rules}
                onSave={handleSaveRules}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
