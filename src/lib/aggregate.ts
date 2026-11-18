import type { FoodBev, Filters, ParsedDataset, SeriesBy, Settings } from '../types';
import { defaultOutletForPos } from './classify';

export interface Metrics {
  sales: number;
  qty: number;
  tx: number;
  guests: number;
  /** Sales from orders that recorded at least one guest (for spend per guest). */
  guestSales: number;
}

export interface Bucket {
  total: Metrics;
  s: Record<string, Metrics>;
}

export interface ItemRow {
  product: string;
  category: string;
  foodBev: FoodBev;
  qty: number;
  sales: number;
  s: Record<string, { qty: number; sales: number }>;
}

export interface CategoryRow {
  category: string;
  /** Type with the largest share of this category's sales. */
  foodBev: FoodBev;
  fbSales?: Record<FoodBev, number>;
  qty: number;
  sales: number;
  s: Record<string, number>;
}

export interface Report {
  series: string[];
  kpi: Bucket;
  monthly: Map<string, Bucket>; // YYYY-MM
  daily: Map<string, Bucket>; // YYYY-MM-DD
  hourly: Bucket[]; // 24
  /** [dow][hour] totals */
  dowHour: { sales: number; tx: number }[][];
  items: ItemRow[];
  categories: CategoryRow[];
  productCategories: CategoryRow[];
  foodBev: Record<FoodBev, { sales: number; qty: number; s: Record<string, number> }>;
  /** Discount lines (e.g. "[DISC1] Discount"): included in sales, kept out of item/category lists. */
  discounts: { sales: number; s: Record<string, number> };
  /** Days with sales: overall, per series, and per weekday (0 = Sunday). */
  days: { total: number; s: Record<string, number>; dow: number[]; dowS: Record<string, number[]> };
  lineCount: number;
}

export function isDiscountLine(product: string): boolean {
  return /\bdiscount\b/i.test(product);
}

export const emptyMetrics = (): Metrics => ({ sales: 0, qty: 0, tx: 0, guests: 0, guestSales: 0 });

export const avgTicket = (m: Metrics) => (m.tx > 0 ? m.sales / m.tx : 0);
export const spendPerGuest = (m: Metrics) => (m.guests > 0 ? m.guestSales / m.guests : 0);

function newBucket(): Bucket {
  return { total: emptyMetrics(), s: {} };
}

function seriesMetrics(b: Bucket, key: string): Metrics {
  let m = b.s[key];
  if (!m) {
    m = emptyMetrics();
    b.s[key] = m;
  }
  return m;
}

function getBucket(map: Map<string, Bucket>, key: string): Bucket {
  let b = map.get(key);
  if (!b) {
    b = newBucket();
    map.set(key, b);
  }
  return b;
}

export function outletOf(pos: string, settings: Settings): string {
  return settings.posOutlet[pos]?.trim() || defaultOutletForPos(pos);
}

export function foodBevOf(category: string, auto: FoodBev, settings: Settings): FoodBev {
  return settings.categoryFoodBev[category] ?? auto;
}

export function computeReport(
  ds: ParsedDataset,
  filters: Filters,
  settings: Settings,
  seriesBy: SeriesBy,
): Report {
  const useIncl = settings.salesBasis === 'incl';
  const posFilter = filters.pos.length ? new Set(filters.pos) : null;
  const q = filters.search.trim().toLowerCase();

  // Series key per order (outlet group or raw POS), cached per POS name
  const posSeries = new Map<string, string>();
  const seriesOf = (pos: string) => {
    let s = posSeries.get(pos);
    if (s === undefined) {
      s = seriesBy === 'outlet' ? outletOf(pos, settings) : pos;
      posSeries.set(pos, s);
    }
    return s;
  };

  const orderOk = new Uint8Array(ds.orders.length); // 0 unknown, 1 pass, 2 fail
  const orderUsed = new Uint8Array(ds.orders.length);

  const kpi = newBucket();
  const monthly = new Map<string, Bucket>();
  const daily = new Map<string, Bucket>();
  const hourly = Array.from({ length: 24 }, newBucket);
  const dowHour = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ sales: 0, tx: 0 })));
  const items = new Map<string, ItemRow>();
  const cats = new Map<string, CategoryRow>();
  const pcats = new Map<string, CategoryRow>();
  const fb: Report['foodBev'] = {
    Food: { sales: 0, qty: 0, s: {} },
    Beverage: { sales: 0, qty: 0, s: {} },
    Other: { sales: 0, qty: 0, s: {} },
  };
  const seriesTotals = new Map<string, number>();
  let lineCount = 0;
  const discounts: Report['discounts'] = { sales: 0, s: {} };

  for (const line of ds.lines) {
    const oi = line.o;
    let ok = orderOk[oi];
    const order = ds.orders[oi];
    if (ok === 0) {
      ok = 1;
      if (posFilter && !posFilter.has(order.pos)) ok = 2;
      else if (filters.dateFrom && order.dateKey < filters.dateFrom) ok = 2;
      else if (filters.dateTo && order.dateKey > filters.dateTo) ok = 2;
      orderOk[oi] = ok;
    }
    if (ok === 2) continue;

    const category = line.category || `No category · ${outletOf(order.pos, settings)}`;
    const foodBev = foodBevOf(category, line.foodBev, settings);
    if (filters.foodBev !== 'All' && foodBev !== filters.foodBev) continue;
    if (q && !line.product.toLowerCase().includes(q) && !category.toLowerCase().includes(q)) continue;

    lineCount++;
    orderUsed[oi] = 1;
    const sales = useIncl ? line.salesIncl : line.salesExcl;
    const qty = line.qty;
    const gs = order.guests > 0 ? sales : 0;
    const series = seriesOf(order.pos);
    seriesTotals.set(series, (seriesTotals.get(series) ?? 0) + sales);

    const add = (b: Bucket) => {
      b.total.sales += sales;
      b.total.qty += qty;
      b.total.guestSales += gs;
      const m = seriesMetrics(b, series);
      m.sales += sales;
      m.qty += qty;
      m.guestSales += gs;
    };
    add(kpi);
    add(getBucket(monthly, order.dateKey.slice(0, 7)));
    add(getBucket(daily, order.dateKey));
    add(hourly[order.hour]);
    dowHour[order.dow][order.hour].sales += sales;

    if (isDiscountLine(line.product)) {
      discounts.sales += sales;
      discounts.s[series] = (discounts.s[series] ?? 0) + sales;
      continue;
    }

    const itemKey = line.product;
    let it = items.get(itemKey);
    if (!it) {
      it = { product: line.product, category, foodBev, qty: 0, sales: 0, s: {} };
      items.set(itemKey, it);
    }
    it.qty += qty;
    it.sales += sales;
    const is = (it.s[series] ??= { qty: 0, sales: 0 });
    is.qty += qty;
    is.sales += sales;

    let cr = cats.get(category);
    if (!cr) {
      cr = { category, foodBev, qty: 0, sales: 0, s: {}, fbSales: { Food: 0, Beverage: 0, Other: 0 } };
      cats.set(category, cr);
    }
    cr.qty += qty;
    cr.sales += sales;
    cr.s[series] = (cr.s[series] ?? 0) + sales;
    cr.fbSales![foodBev] += Math.abs(sales);

    const pk = line.productCategory || 'Uncategorized';
    let pr = pcats.get(pk);
    if (!pr) {
      pr = { category: pk, foodBev, qty: 0, sales: 0, s: {}, fbSales: { Food: 0, Beverage: 0, Other: 0 } };
      pcats.set(pk, pr);
    }
    pr.qty += qty;
    pr.sales += sales;
    pr.s[series] = (pr.s[series] ?? 0) + sales;
    pr.fbSales![foodBev] += Math.abs(sales);

    const f = fb[foodBev];
    f.sales += sales;
    f.qty += qty;
    f.s[series] = (f.s[series] ?? 0) + sales;
  }

  // Order-level counts: transactions (excluding refunds) and guests
  for (let i = 0; i < ds.orders.length; i++) {
    if (!orderUsed[i]) continue;
    const o = ds.orders[i];
    if (o.isRefund) continue;
    const series = seriesOf(o.pos);
    const add = (b: Bucket) => {
      b.total.tx += 1;
      b.total.guests += o.guests;
      const m = seriesMetrics(b, series);
      m.tx += 1;
      m.guests += o.guests;
    };
    add(kpi);
    add(getBucket(monthly, o.dateKey.slice(0, 7)));
    add(getBucket(daily, o.dateKey));
    add(hourly[o.hour]);
    dowHour[o.dow][o.hour].tx += 1;
  }

  for (const r of [...cats.values(), ...pcats.values()]) {
    const f = r.fbSales!;
    r.foodBev = (['Food', 'Beverage', 'Other'] as FoodBev[]).reduce((a, b) => (f[b] > f[a] ? b : a), 'Food');
  }

  const days: Report['days'] = { total: 0, s: {}, dow: Array(7).fill(0), dowS: {} };
  for (const [d, b] of daily) {
    const w = dowOf(d);
    days.total++;
    days.dow[w]++;
    for (const [k, m] of Object.entries(b.s)) {
      if (!m.tx && !m.sales) continue;
      days.s[k] = (days.s[k] ?? 0) + 1;
      (days.dowS[k] ??= Array(7).fill(0))[w]++;
    }
  }

  const series = Array.from(seriesTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  return {
    series,
    kpi,
    monthly,
    daily,
    hourly,
    dowHour,
    items: Array.from(items.values()).sort((a, b) => b.sales - a.sales),
    categories: Array.from(cats.values()).sort((a, b) => b.sales - a.sales),
    productCategories: Array.from(pcats.values()).sort((a, b) => b.sales - a.sales),
    foodBev: fb,
    discounts,
    days,
    lineCount,
  };
}

/** Shift a YYYY-MM-DD date by whole years (Feb 29 -> Feb 28). */
export function shiftYears(dateKey: string, years: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const ny = y + years;
  const last = new Date(Date.UTC(ny, m, 0)).getUTCDate();
  return `${ny}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function dowOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function datasetBounds(ds: ParsedDataset): { min: string; max: string } | null {
  let min = '';
  let max = '';
  for (const o of ds.orders) {
    if (!min || o.dateKey < min) min = o.dateKey;
    if (!max || o.dateKey > max) max = o.dateKey;
  }
  return min ? { min, max } : null;
}

export interface ItemTrend {
  monthly: Map<string, { qty: number; sales: number }>;
  hourly: { qty: number; sales: number }[];
  bySeries: Record<string, { qty: number; sales: number }>;
}

/** Month-by-month and hour-by-hour figures for one item (ignores the text filter). */
export function itemTrend(
  ds: ParsedDataset,
  filters: Filters,
  settings: Settings,
  seriesBy: SeriesBy,
  product: string,
): ItemTrend {
  const useIncl = settings.salesBasis === 'incl';
  const posFilter = filters.pos.length ? new Set(filters.pos) : null;
  const monthly = new Map<string, { qty: number; sales: number }>();
  const hourly = Array.from({ length: 24 }, () => ({ qty: 0, sales: 0 }));
  const bySeries: Record<string, { qty: number; sales: number }> = {};
  for (const l of ds.lines) {
    if (l.product !== product) continue;
    const o = ds.orders[l.o];
    if (posFilter && !posFilter.has(o.pos)) continue;
    if (filters.dateFrom && o.dateKey < filters.dateFrom) continue;
    if (filters.dateTo && o.dateKey > filters.dateTo) continue;
    const sales = useIncl ? l.salesIncl : l.salesExcl;
    const mk = o.dateKey.slice(0, 7);
    const m = monthly.get(mk) ?? { qty: 0, sales: 0 };
    m.qty += l.qty;
    m.sales += sales;
    monthly.set(mk, m);
    hourly[o.hour].qty += l.qty;
    hourly[o.hour].sales += sales;
    const s = seriesBy === 'outlet' ? outletOf(o.pos, settings) : o.pos;
    const bs = (bySeries[s] ??= { qty: 0, sales: 0 });
    bs.qty += l.qty;
    bs.sales += sales;
  }
  return { monthly, hourly, bySeries };
}
