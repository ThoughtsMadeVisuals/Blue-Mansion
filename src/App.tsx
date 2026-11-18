import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Printer, Settings as SettingsIcon, Trash2, Undo2 } from 'lucide-react';
import type { Filters, ParsedDataset, SeriesBy, Settings } from './types';
import { mergeIntoDataset, parseFile } from './lib/parse';
import { computeReport, datasetBounds, itemTrend, outletOf, shiftYears } from './lib/aggregate';
import { colorFor, longDate, shortDate } from './lib/format';
import { clearDataset, loadDataset, loadSettings, saveDataset, saveSettings } from './lib/storage';
import type { ViewContext } from './lib/metrics';
import { UploadPanel } from './components/UploadPanel';
import { FileStatus } from './components/FileStatus';
import { FilterBar } from './components/FilterBar';
import { Overview } from './components/Overview';
import { MonthlyView } from './components/MonthlyView';
import { DailyView } from './components/DailyView';
import { HoursView } from './components/HoursView';
import { ItemsView } from './components/ItemsView';
import { CategoriesView } from './components/CategoriesView';
import { TicketsView } from './components/TicketsView';
import { SettingsModal } from './components/SettingsModal';
import { Segmented } from './components/ui';

const EMPTY_FILTERS: Filters = { pos: [], dateFrom: '', dateTo: '', foodBev: 'All', search: '' };

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'monthly', label: 'Monthly & Year vs Year' },
  { id: 'daily', label: 'Daily & Festive Days' },
  { id: 'hours', label: 'Best Hours' },
  { id: 'items', label: 'Items' },
  { id: 'categories', label: 'Categories' },
  { id: 'tickets', label: 'Guests & Tickets' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function readTab(): TabId {
  try {
    const t = localStorage.getItem('bm_tab');
    if (t && TABS.some((x) => x.id === t)) return t as TabId;
  } catch {
    /* ignore */
  }
  return 'overview';
}

export default function App() {
  const [ds, setDs] = useState<ParsedDataset | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [savedFilters, setSavedFilters] = useState<Filters | null>(null);
  const [seriesBy, setSeriesBy] = useState<SeriesBy>('outlet');
  const [tab, setTabState] = useState<TabId>(readTab);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const setTab = (t: TabId) => {
    setTabState(t);
    try {
      localStorage.setItem('bm_tab', t);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    loadDataset().then((saved) => {
      if (saved && Array.isArray(saved.orders)) setDs(saved);
      setRestoring(false);
    });
  }, []);

  const handleFiles = async (files: File[]) => {
    setError(null);
    let current = ds;
    try {
      for (const f of files) {
        setBusy(`Reading ${f.name}…`);
        await new Promise((r) => setTimeout(r, 30));
        const parsed = await parseFile(f);
        current = mergeIntoDataset(current, parsed);
      }
      if (current) {
        setDs(current);
        setFilters(EMPTY_FILTERS);
        setSavedFilters(null);
        setBusy('Saving…');
        await saveDataset(current);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file.');
    } finally {
      setBusy(null);
    }
  };

  const bounds = useMemo(() => (ds ? datasetBounds(ds) : null), [ds]);
  const posList = useMemo(() => (ds ? Array.from(new Set(ds.orders.map((o) => o.pos))).sort() : []), [ds]);
  const outletFn = useCallback((p: string) => outletOf(p, settings), [settings]);

  // Stable colours: by outlet name or POS name, ordered by first appearance
  const colorOf = useMemo(() => {
    const names = seriesBy === 'outlet' ? Array.from(new Set(posList.map(outletFn))) : posList;
    const idx = new Map(names.map((n, i) => [n, i]));
    return (s: string) => colorFor(s, idx.get(s) ?? 0);
  }, [posList, outletFn, seriesBy]);

  const report = useMemo(
    () => (ds ? computeReport(ds, filters, settings, seriesBy) : null),
    [ds, filters, settings, seriesBy],
  );

  const { prev, prevComplete } = useMemo(() => {
    if (!ds || !bounds) return { prev: null, prevComplete: false };
    // Clamp to the data actually loaded, so "2026" (data to 14 Nov) is compared with 1 Jan – 14 Nov 2025
    const rawFrom = filters.dateFrom || bounds.min;
    const rawTo = filters.dateTo || bounds.max;
    const from = rawFrom < bounds.min ? bounds.min : rawFrom;
    const to = rawTo > bounds.max ? bounds.max : rawTo;
    const pf = shiftYears(from, -1);
    const pt = shiftYears(to, -1);
    if (pt < bounds.min) return { prev: null, prevComplete: false };
    const r = computeReport(ds, { ...filters, dateFrom: pf, dateTo: pt }, settings, seriesBy);
    return { prev: r.lineCount ? r : null, prevComplete: pf >= bounds.min && r.lineCount > 0 };
  }, [ds, bounds, filters, settings, seriesBy]);

  const trend = useMemo(
    () => (ds && selectedItem ? itemTrend(ds, filters, settings, seriesBy, selectedItem) : null),
    [ds, filters, settings, seriesBy, selectedItem],
  );

  const categoriesForSettings = useMemo(() => {
    if (!ds) return [];
    const m = new Map<string, { category: string; auto: ParsedDataset['lines'][number]['foodBev']; sales: number }>();
    for (const l of ds.lines) {
      const c = l.category || `No category · ${outletOf(ds.orders[l.o].pos, settings)}`;
      const e = m.get(c) ?? { category: c, auto: l.foodBev, sales: 0 };
      e.sales += l.salesExcl;
      m.set(c, e);
    }
    return Array.from(m.values()).sort((a, b) => b.sales - a.sales);
  }, [ds, settings]);

  // Guest counts that look like a default of 1 per receipt (not real covers)
  const guestIssues = useMemo(() => {
    const m = new Map<string, { n: number; ones: number }>();
    for (const o of ds?.orders ?? []) {
      if (o.isRefund) continue;
      const k = `${o.pos}|${o.dateKey.slice(0, 7)}`;
      const e = m.get(k) ?? { n: 0, ones: 0 };
      e.n++;
      if (o.guests === 1) e.ones++;
      m.set(k, e);
    }
    const out: Record<string, string[]> = {};
    for (const [k, e] of m) {
      if (e.n >= 30 && e.ones / e.n >= 0.97) {
        const [pos, month] = k.split('|');
        (out[pos] ??= []).push(month);
      }
    }
    for (const v of Object.values(out)) v.sort();
    return out;
  }, [ds]);

  const posByYear = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const o of ds?.orders ?? []) (m[o.dateKey.slice(0, 4)] ??= new Set()).add(o.pos);
    return Object.fromEntries(Object.entries(m).map(([y, set]) => [y, Array.from(set).sort()]));
  }, [ds]);

  const pickDate = (d: string) => {
    if (!savedFilters) setSavedFilters(filters);
    setFilters({ ...filters, dateFrom: d, dateTo: d });
    setTab('overview');
  };

  const periodLabel = bounds
    ? filters.dateFrom && filters.dateFrom === filters.dateTo
      ? longDate(filters.dateFrom)
      : `${shortDate(filters.dateFrom && filters.dateFrom > bounds.min ? filters.dateFrom : bounds.min)} – ${shortDate(
          filters.dateTo && filters.dateTo < bounds.max ? filters.dateTo : bounds.max,
        )}`
    : '';

  const ctx: ViewContext | null = report
    ? {
        report,
        prev,
        prevComplete,
        periodLabel,
        colorOf,
        posByYear,
        bounds: bounds!,
        selectedPos: filters.pos,
        guestIssues,
        setPos: (pos: string[]) => {
          setFilters({ ...filters, pos });
          setSavedFilters(null);
        },
      }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <header className="border-b border-slate-200 bg-white print:border-0">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold">The Blue Mansion · POS Sales Analytics</h1>
              <p className="text-xs text-slate-500">Odoo POS exports · all outlets · year against year</p>
            </div>
          </div>
          {ds && (
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <span className="text-[11px] text-slate-500">Sales</span>
              <Segmented
                size="xs"
                value={settings.salesBasis}
                onChange={(v) => {
                  const next = { ...settings, salesBasis: v };
                  setSettings(next);
                  saveSettings(next);
                }}
                options={[
                  { value: 'excl', label: 'Excl. tax' },
                  { value: 'incl', label: 'Incl. tax' },
                ]}
              />
              <button type="button" onClick={() => setSettingsOpen(true)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <SettingsIcon className="h-3.5 w-3.5" /> Settings
              </button>
              <button type="button" onClick={() => window.print()} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                <Printer className="h-3.5 w-3.5" /> Print / PDF
              </button>
              <button
                type="button"
                title="Remove all loaded data"
                aria-label="Remove all loaded data"
                onClick={() => {
                  if (!confirm('Remove all loaded data from this browser?')) return;
                  setDs(null);
                  setFilters(EMPTY_FILTERS);
                  setSelectedItem(null);
                  void clearDataset();
                }}
                className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-4 pt-5 sm:px-6">
        {!restoring && <UploadPanel onFiles={handleFiles} busy={busy} compact={Boolean(ds)} />}
        {ds && <FileStatus ds={ds} />}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {ds && bounds && report && ctx && (
          <>
            <FilterBar
              filters={filters}
              onChange={(f) => {
                setFilters(f);
                setSavedFilters(null);
              }}
              posList={posList}
              outletOf={outletFn}
              bounds={bounds}
              seriesBy={seriesBy}
              onSeriesBy={setSeriesBy}
            />

            <nav className="flex flex-wrap gap-1 border-b border-slate-200 print:hidden" aria-label="Report sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-xs font-medium sm:text-sm ${
                    tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">
                {TABS.find((t) => t.id === tab)?.label}
                <span className="ml-2 text-sm font-normal text-slate-500">{periodLabel}</span>
              </h2>
              {savedFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setFilters(savedFilters);
                    setSavedFilters(null);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Back to previous dates
                </button>
              )}
            </div>

            {report.lineCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                No sales match the current filters.
              </div>
            ) : (
              <>
                {tab === 'overview' && <Overview ctx={ctx} holidays={settings.holidays} onGoto={(t) => setTab(t as TabId)} />}
                {tab === 'monthly' && <MonthlyView ctx={ctx} />}
                {tab === 'daily' && <DailyView ctx={ctx} holidays={settings.holidays} onPickDate={pickDate} />}
                {tab === 'hours' && <HoursView ctx={ctx} />}
                {tab === 'items' && <ItemsView ctx={ctx} selected={selectedItem} onSelect={setSelectedItem} trend={trend} />}
                {tab === 'categories' && (
                  <CategoriesView
                    ctx={ctx}
                    onSearch={(q) => {
                      setFilters({ ...filters, search: q });
                      setTab('items');
                    }}
                  />
                )}
                {tab === 'tickets' && <TicketsView ctx={ctx} holidays={settings.holidays} onPickDate={pickDate} />}
              </>
            )}

            <SettingsModal
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              settings={settings}
              onSave={(s) => {
                setSettings(s);
                saveSettings(s);
              }}
              posList={posList}
              categories={categoriesForSettings}
            />
          </>
        )}
      </main>
    </div>
  );
}
