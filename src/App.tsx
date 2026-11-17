import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2 } from 'lucide-react';
import type { FilterState, MappingRules, ParsedDataset } from './types/pos';
import { loadMappingRules, saveMappingRules } from './utils/defaultMappings';
import {
  clearDatasetFromStorage,
  loadDatasetFromStorage,
  saveDatasetToStorage,
} from './utils/datasetStorage';
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

const INITIAL_FILTERS: FilterState = {
  outletFilter: 'Mangga',
  dateFrom: '',
  dateTo: '',
  foodBevFilter: 'All',
  searchQuery: '',
};

function getOutletLabel(filter: FilterState['outletFilter']): string {
  if (filter === 'compare') return 'All Outlets';
  return filter;
}

function getAccentColor(filter: FilterState['outletFilter']): string {
  if (filter === 'Indigo Bar') return '#4f46e5';
  if (filter === 'compare') return '#334155';
  return '#10b981';
}

function mergeDatasets(existing: ParsedDataset | null, incoming: ParsedDataset): ParsedDataset {
  if (!existing) return incoming;
  return {
    lines: [...existing.lines, ...incoming.lines],
    pdfPayments: [...existing.pdfPayments, ...incoming.pdfPayments],
    pdfDailySessions: [...existing.pdfDailySessions, ...incoming.pdfDailySessions],
    capabilities: {
      hasHourly: existing.capabilities.hasHourly || incoming.capabilities.hasHourly,
      hasDailyItems: existing.capabilities.hasDailyItems || incoming.capabilities.hasDailyItems,
      hasDailyPayments:
        existing.capabilities.hasDailyPayments || incoming.capabilities.hasDailyPayments,
      hasGuests: existing.capabilities.hasGuests || incoming.capabilities.hasGuests,
      hasOrderLevelTransactions:
        existing.capabilities.hasOrderLevelTransactions ||
        incoming.capabilities.hasOrderLevelTransactions,
      totalPdfTransactions:
        (existing.capabilities.totalPdfTransactions ?? 0) +
          (incoming.capabilities.totalPdfTransactions ?? 0) || undefined,
      dateRangeLabel: existing.capabilities.dateRangeLabel ?? incoming.capabilities.dateRangeLabel,
      sourceFiles: [...existing.capabilities.sourceFiles, ...incoming.capabilities.sourceFiles],
    },
    fileSummaries: [
      ...(existing.fileSummaries ?? []),
      ...(incoming.fileSummaries ?? []),
    ],
    warnings: Array.from(new Set([...existing.warnings, ...incoming.warnings])),
  };
}

export function App() {
  const [rules, setRules] = useState<MappingRules>(() => loadMappingRules());
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadDatasetFromStorage().then((saved) => {
      if (active && saved) {
        setDataset(reapplyMappings(saved, rules));
      }
    });
    return () => {
      active = false;
    };
    // Only restore saved dataset once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilesSelected = async (fileList: FileList) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let merged: ParsedDataset | null = dataset;
      for (const file of Array.from(fileList)) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') {
          const parsed = await parseSalesDetailsPdfFile(file, rules);
          merged = mergeDatasets(merged, parsed);
        } else if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
          const parsed = await parseCsvOrXlsxFile(file, rules);
          merged = mergeDatasets(merged, parsed);
        } else {
          setErrorMsg(`Unsupported file format: ${file.name}. Please upload .csv, .xlsx, or .pdf.`);
        }
      }
      if (merged) {
        setDataset(merged);
        setFilters(INITIAL_FILTERS);
        void saveDatasetToStorage(merged);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to parse the uploaded file.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = () => {
    setErrorMsg(null);
    const sample = buildSampleDataset(rules);
    setDataset(sample);
    setFilters(INITIAL_FILTERS);
    void saveDatasetToStorage(sample);
  };

  const handleSaveRules = (nextRules: MappingRules) => {
    setRules(nextRules);
    saveMappingRules(nextRules);
    if (dataset) {
      const updated = reapplyMappings(dataset, nextRules);
      setDataset(updated);
      void saveDatasetToStorage(updated);
    }
  };

  const report = useMemo(() => {
    if (!dataset) return null;
    return aggregateDataset(dataset, filters);
  }, [dataset, filters]);

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
              <h1 className="text-lg font-bold text-slate-900">
                POS Sales Analytics
              </h1>
              <p className="text-xs text-slate-500">
                Odoo POS Management Report (Food &amp; Beverage · Hourly · Daily · Guests · Transactions)
              </p>
            </div>
          </div>

          {dataset && (
            <div className="flex flex-wrap items-center gap-2">
              {dataset.capabilities.sourceFiles.map((f, idx) => (
                <span
                  key={`${f}-${idx}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {f}
                </span>
              ))}
            </div>
          )}
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
          {dataset && <FileStatusPanel dataset={dataset} />}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
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
              onOpenMapping={() => setIsMappingOpen(true)}
              onClearData={() => {
                setDataset(null);
                setFilters(INITIAL_FILTERS);
                setSelectedProduct(null);
                void clearDatasetFromStorage();
              }}
            />

            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {getOutletLabel(filters.outletFilter)} — Management Sales Report
                </h2>
                <p className="text-xs text-slate-500">
                  {report.dateBounds
                    ? `Period: ${filters.dateFrom || report.dateBounds.min} to ${filters.dateTo || report.dateBounds.max}`
                    : dataset.capabilities.dateRangeLabel || 'Uploaded POS Report'}
                  {filters.foodBevFilter !== 'All' ? ` · ${filters.foodBevFilter} only` : ''}
                </p>
              </div>
            </div>

            <KpiCards
              report={report}
              capabilities={dataset.capabilities}
              outletLabel={getOutletLabel(filters.outletFilter)}
            />

            <MostSoldItemsPanel
              topFood={report.topFood}
              topBeverage={report.topBeverage}
              outletLabel={getOutletLabel(filters.outletFilter)}
              accentColor={getAccentColor(filters.outletFilter)}
            />

            <SalesByCategoryChart
              categories={report.salesByCategory}
              foodVsBev={report.foodVsBev}
              outletLabel={getOutletLabel(filters.outletFilter)}
              accentColor={getAccentColor(filters.outletFilter)}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SalesByHoursChart
                salesByHour={report.salesByHour}
                hasHourly={dataset.capabilities.hasHourly}
                outletLabel={getOutletLabel(filters.outletFilter)}
                accentColor={getAccentColor(filters.outletFilter)}
              />
              <DailySalesChart
                dailySales={report.dailySales}
                dailyPaymentsFallback={report.dailyPaymentsFallback}
                hasDailyItems={dataset.capabilities.hasDailyItems}
                outletLabel={getOutletLabel(filters.outletFilter)}
                accentColor={getAccentColor(filters.outletFilter)}
                onSelectDate={(dateKey) =>
                  setFilters((prev) => ({
                    ...prev,
                    dateFrom: dateKey,
                    dateTo: dateKey,
                  }))
                }
              />
            </div>

            <GuestsAndTransactionsPanel
              dailySales={report.dailySales}
              capabilities={dataset.capabilities}
              outletLabel={getOutletLabel(filters.outletFilter)}
              accentColor={getAccentColor(filters.outletFilter)}
            />

            <SalesByItemChart
              items={report.salesByItem}
              dataset={dataset}
              filters={filters}
              allCategories={report.allCategories}
              outletLabel={getOutletLabel(filters.outletFilter)}
              accentColor={getAccentColor(filters.outletFilter)}
              selectedProduct={selectedProduct}
              onSelectProduct={setSelectedProduct}
            />

            <SalesByItemTable
              items={report.salesByItem}
              totalSales={report.kpis.total.sales}
              outletLabel={getOutletLabel(filters.outletFilter)}
              selectedProduct={selectedProduct}
              onSelectProduct={setSelectedProduct}
            />

            <MappingModal
              isOpen={isMappingOpen}
              onClose={() => setIsMappingOpen(false)}
              categories={report.allCategories}
              rules={rules}
              onSave={handleSaveRules}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
