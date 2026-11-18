import type { Metrics, Report } from './aggregate';
import { avgTicket, spendPerGuest } from './aggregate';
import { int, num, rm, rmCompact } from './format';

export type MetricKey = 'sales' | 'tx' | 'guests' | 'avgTicket' | 'spg' | 'qty';

export const METRIC_LABEL: Record<MetricKey, string> = {
  sales: 'Sales',
  tx: 'Transactions',
  guests: 'Guests',
  avgTicket: 'Avg ticket',
  spg: 'Spend / guest',
  qty: 'Items sold',
};

export function metricValue(m: Metrics | undefined, k: MetricKey): number {
  if (!m) return 0;
  switch (k) {
    case 'sales':
      return m.sales;
    case 'tx':
      return m.tx;
    case 'guests':
      return m.guests;
    case 'qty':
      return m.qty;
    case 'avgTicket':
      return avgTicket(m);
    case 'spg':
      return spendPerGuest(m);
  }
}

export function isMoney(k: MetricKey): boolean {
  return k === 'sales' || k === 'avgTicket' || k === 'spg';
}

/** Ratios can't be summed or averaged per day; only totals can. */
export function isAdditive(k: MetricKey): boolean {
  return k === 'sales' || k === 'tx' || k === 'guests' || k === 'qty';
}

export function fmtMetric(k: MetricKey, v: number, compact = false): string {
  if (isMoney(k)) return compact ? rmCompact(v) : rm(v, k === 'sales' ? 0 : 2);
  if (k === 'qty' && !Number.isInteger(Math.round(v * 100) / 100)) return num(v, 1);
  return int(v);
}

export const METRIC_OPTIONS = (keys: MetricKey[]) => keys.map((k) => ({ value: k, label: METRIC_LABEL[k] }));

export interface ViewContext {
  report: Report;
  /** Same filters, one year earlier (null if no data for that period). */
  prev: Report | null;
  prevComplete: boolean;
  periodLabel: string;
  colorOf: (series: string) => string;
  /** Points of sale present in each year of the loaded data. */
  posByYear: Record<string, string[]>;
  /** First and last date in the loaded data. */
  bounds: { min: string; max: string };
  selectedPos: string[];
  /** Months where a point of sale's guest count looks like a default of 1 per receipt (YYYY-MM). */
  guestIssues: Record<string, string[]>;
  setPos: (pos: string[]) => void;
}
