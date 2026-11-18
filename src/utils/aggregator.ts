import type {
  FilterState,
  FoodBevType,
  MappingRules,
  Outlet,
  ParsedDataset,
  PosOrderLine,
} from '../types/pos';
import { OUTLETS } from '../types/pos';
import {
  describeExcluded,
  inferFoodBev,
  inferOutletFromConfig,
  inferOutletFromHeuristics,
  isExcludedOutlet,
} from './defaultMappings';

export interface OutletMetrics {
  sales: number;
  qty: number;
  transactions: number;
  guests: number;
  avgTicket: number;
  avgSpendPerGuest: number;
}

export interface OutletBreakdownRow extends OutletMetrics {
  outlet: Outlet;
  foodSales: number;
  beverageSales: number;
  otherSales: number;
  share: number; // 0-1 of grand total sales
}

/** Sales per outlet, keyed by outlet id. Missing key = 0. */
export type OutletSales = Partial<Record<Outlet, number>>;

export interface ItemAggRow {
  product: string;
  category: string;
  foodBev: FoodBevType;
  outletSales: OutletSales;
  outletQty: OutletSales;
  totalQty: number;
  totalSales: number;
}

export interface CategoryAggRow {
  category: string;
  foodBev: FoodBevType;
  outletSales: OutletSales;
  totalQty: number;
  totalSales: number;
}

export interface HourAggRow {
  hour: number;
  label: string;
  outletSales: OutletSales;
  totalSales: number;
  totalTx: number;
  totalGuests: number;
}

export interface DailyAggRow {
  dateKey: string;
  outletSales: OutletSales;
  totalSales: number;
  totalTx: number;
  totalGuests: number;
}

/** One receipt, used for the cancelled and refund lists. */
export interface ReceiptRow {
  orderRef: string;
  receipt: string;
  outlet: Outlet;
  dateTime: string | null;
  status: PosOrderLine['orderStatus'];
  isRefund: boolean;
  sales: number;
  qty: number;
  items: string[];
  sourceFile: string;
}

export interface ReceiptGroupSummary {
  orders: number;
  sales: number;
}

export interface AggregatedReport {
  kpis: {
    byOutlet: Record<Outlet, OutletMetrics>;
    total: OutletMetrics;
  };
  /** One row per outlet that has sales in the current (non-outlet) filters. */
  outletBreakdown: OutletBreakdownRow[];
  /** Outlets with any lines in the whole dataset, in canonical order. */
  outletsInData: Outlet[];
  topFood: ItemAggRow[];
  topBeverage: ItemAggRow[];
  salesByItem: ItemAggRow[];
  salesByCategory: CategoryAggRow[];
  foodVsBev: {
    type: FoodBevType;
    totalSales: number;
    totalQty: number;
  }[];
  salesByHour: HourAggRow[];
  dailySales: DailyAggRow[];
  dailyPaymentsFallback: { dateKey: string; expected: number; counted: number }[];
  dateBounds: { min: string; max: string } | null;
  availableDates: string[];
  allCategories: string[];
  allProducts: string[];
  unassignedItemsCount: number;
  /** Cancelled / draft receipts (never counted in sales), newest first */
  voidReceipts: ReceiptRow[];
  voidSummary: { cancelled: ReceiptGroupSummary; draft: ReceiptGroupSummary };
  /** Refund receipts (included in sales as negative amounts), newest first */
  refunds: ReceiptRow[];
  refundSummary: ReceiptGroupSummary;
}

export interface ItemDailyPoint {
  dateKey: string;
  qty: number;
  sales: number;
}

export interface ItemHourlyPoint {
  hour: number;
  label: string;
  qty: number;
  sales: number;
}

export interface ItemTrendResult {
  product: string;
  totalQty: number;
  totalSales: number;
  daily: ItemDailyPoint[];
  hourly: ItemHourlyPoint[];
}

export function reapplyMappings(
  dataset: ParsedDataset,
  rules: MappingRules
): ParsedDataset {
  const updatedLines = dataset.lines.map((line) => {
    let outlet: Outlet = 'Unassigned';
    if (line.sourceType === 'csv_xlsx' && line.rawConfig) {
      outlet = inferOutletFromConfig(line.rawConfig, rules);
    }
    if (outlet === 'Unassigned') {
      outlet = inferOutletFromHeuristics(line.category, line.product, rules);
    }
    const foodBev = inferFoodBev(line.category, line.product, rules);
    return { ...line, outlet, foodBev };
  });

  // Drop outlets that are not part of this report (also cleans up datasets
  // saved before they were excluded).
  const excludedCounts = new Map<Outlet, number>();
  const keptLines = updatedLines.filter((line) => {
    if (!isExcludedOutlet(line.outlet)) return true;
    excludedCounts.set(line.outlet, (excludedCounts.get(line.outlet) ?? 0) + 1);
    return false;
  });

  const excludedNote = describeExcluded(excludedCounts);
  const warnings = excludedNote
    ? [...dataset.warnings, excludedNote]
    : dataset.warnings;

  return {
    ...dataset,
    lines: keptLines,
    warnings,
  };
}

function matchesOutletFilter(line: PosOrderLine, outlets: FilterState['outlets']): boolean {
  return outlets.length === 0 || outlets.includes(line.outlet);
}

function matchesDateFilter(line: PosOrderLine, filters: FilterState): boolean {
  if (filters.dateFrom && line.dateKey && line.dateKey < filters.dateFrom) return false;
  if (filters.dateTo && line.dateKey && line.dateKey > filters.dateTo) return false;
  return true;
}

/** Group lines into receipts (one row per order). */
function buildReceipts(lines: PosOrderLine[]): ReceiptRow[] {
  const map = new Map<string, ReceiptRow>();
  for (const l of lines) {
    let row = map.get(l.orderRef);
    if (!row) {
      row = {
        orderRef: l.orderRef,
        receipt: l.receipt,
        outlet: l.outlet,
        dateTime: l.orderDate,
        status: l.orderStatus,
        isRefund: l.isRefund,
        sales: 0,
        qty: 0,
        items: [],
        sourceFile: l.sourceFile,
      };
      map.set(l.orderRef, row);
    }
    row.sales += l.subtotal;
    row.qty += l.qty;
    if (row.items.length < 50) row.items.push(`${l.qty} × ${l.product}`);
  }
  return Array.from(map.values()).sort((a, b) =>
    (b.dateTime ?? '').localeCompare(a.dateTime ?? '')
  );
}

const sumGroup = (rows: ReceiptRow[]): ReceiptGroupSummary => ({
  orders: rows.length,
  sales: rows.reduce((acc, r) => acc + r.sales, 0),
});

function matchesNonOutletFilters(line: PosOrderLine, filters: FilterState): boolean {
  if (filters.foodBevFilter !== 'All' && line.foodBev !== filters.foodBevFilter) {
    return false;
  }
  if (!matchesDateFilter(line, filters)) return false;
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    if (
      !line.product.toLowerCase().includes(q) &&
      !line.category.toLowerCase().includes(q)
    ) {
      return false;
    }
  }
  return true;
}

function addTo(map: OutletSales, outlet: Outlet, value: number): void {
  map[outlet] = (map[outlet] ?? 0) + value;
}

const makeMetrics = (sales: number, qty: number, tx: number, guests: number): OutletMetrics => ({
  sales,
  qty,
  transactions: tx,
  guests,
  avgTicket: tx > 0 ? sales / tx : 0,
  avgSpendPerGuest: guests > 0 ? sales / guests : 0,
});

interface OrderInfo {
  outlet: Outlet;
  guests: number;
  dateKey: string | null;
  hour: number | null;
}

/** Unique orders (per outlet) for transaction & guest counts. */
function collectOrders(lines: PosOrderLine[]): Map<string, OrderInfo> {
  const seen = new Map<string, OrderInfo>();
  for (const line of lines) {
    if (line.sourceType !== 'csv_xlsx') continue;
    const key = `${line.outlet}::${line.orderRef}`;
    if (!seen.has(key)) {
      seen.set(key, {
        outlet: line.outlet,
        guests: line.guests ?? 0,
        dateKey: line.dateKey,
        hour: line.hour,
      });
    }
  }
  return seen;
}

function buildOutletBreakdown(lines: PosOrderLine[]): OutletBreakdownRow[] {
  const acc = new Map<
    Outlet,
    { sales: number; qty: number; tx: number; guests: number; food: number; bev: number; other: number }
  >();
  const get = (o: Outlet) => {
    let row = acc.get(o);
    if (!row) {
      row = { sales: 0, qty: 0, tx: 0, guests: 0, food: 0, bev: 0, other: 0 };
      acc.set(o, row);
    }
    return row;
  };

  let grand = 0;
  for (const line of lines) {
    const row = get(line.outlet);
    row.sales += line.subtotal;
    row.qty += line.qty;
    if (line.foodBev === 'Food') row.food += line.subtotal;
    else if (line.foodBev === 'Beverage') row.bev += line.subtotal;
    else row.other += line.subtotal;
    grand += line.subtotal;
  }
  for (const ord of collectOrders(lines).values()) {
    const row = get(ord.outlet);
    row.tx += 1;
    row.guests += ord.guests;
  }

  return OUTLETS.filter((o) => acc.has(o)).map((o) => {
    const r = acc.get(o)!;
    return {
      outlet: o,
      ...makeMetrics(r.sales, r.qty, r.tx, r.guests),
      foodSales: r.food,
      beverageSales: r.bev,
      otherSales: r.other,
      share: grand !== 0 ? r.sales / grand : 0,
    };
  });
}

export function aggregateDataset(
  dataset: ParsedDataset,
  filters: FilterState
): AggregatedReport {
  const allDates = dataset.lines
    .map((l) => l.dateKey)
    .filter((d): d is string => Boolean(d))
    .sort();
  const availableDates = Array.from(new Set(allDates));
  const dateBounds =
    availableDates.length > 0
      ? { min: availableDates[0], max: availableDates[availableDates.length - 1] }
      : null;

  const categorySet = new Set<string>();
  const productSet = new Set<string>();
  const outletSet = new Set<Outlet>();
  let unassignedItemsCount = 0;

  const validLines: PosOrderLine[] = [];
  const voidLines: PosOrderLine[] = [];
  for (const l of dataset.lines) {
    outletSet.add(l.outlet);
    // Lines from files saved before order status existed count as valid
    if (l.orderStatus && l.orderStatus !== 'valid') {
      voidLines.push(l);
      continue;
    }
    validLines.push(l);
    categorySet.add(l.category);
    productSet.add(l.product);
    if (l.outlet === 'Unassigned') unassignedItemsCount++;
  }

  const nonOutletFiltered = validLines.filter((line) =>
    matchesNonOutletFilters(line, filters)
  );
  const filtered = nonOutletFiltered.filter((line) =>
    matchesOutletFilter(line, filters.outlets)
  );

  // Cancelled / draft receipts and refunds follow the outlet & date filters
  const scope = (l: PosOrderLine) =>
    matchesOutletFilter(l, filters.outlets) && matchesDateFilter(l, filters);
  const voidReceipts = buildReceipts(voidLines.filter(scope));
  const scopedValid = validLines.filter(scope);
  const orderNet = new Map<string, number>();
  for (const l of scopedValid) orderNet.set(l.orderRef, (orderNet.get(l.orderRef) ?? 0) + l.subtotal);
  const refunds = buildReceipts(
    scopedValid.filter((l) => l.isRefund || (orderNet.get(l.orderRef) ?? 0) < 0)
  );

  const outletSales: Record<Outlet, { sales: number; qty: number; tx: number; guests: number }> =
    Object.fromEntries(OUTLETS.map((o) => [o, { sales: 0, qty: 0, tx: 0, guests: 0 }])) as Record<
      Outlet,
      { sales: number; qty: number; tx: number; guests: number }
    >;
  let totalSales = 0;
  let totalQty = 0;

  const itemMap = new Map<string, ItemAggRow>();
  const catMap = new Map<string, CategoryAggRow>();
  const fbMap = new Map<FoodBevType, { totalSales: number; totalQty: number }>([
    ['Food', { totalSales: 0, totalQty: 0 }],
    ['Beverage', { totalSales: 0, totalQty: 0 }],
    ['Other', { totalSales: 0, totalQty: 0 }],
  ]);

  const hourBuckets: HourAggRow[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    outletSales: {},
    totalSales: 0,
    totalTx: 0,
    totalGuests: 0,
  }));

  const dailyMap = new Map<string, DailyAggRow>();
  const ensureDay = (dateKey: string): DailyAggRow => {
    let row = dailyMap.get(dateKey);
    if (!row) {
      row = { dateKey, outletSales: {}, totalSales: 0, totalTx: 0, totalGuests: 0 };
      dailyMap.set(dateKey, row);
    }
    return row;
  };

  for (const line of filtered) {
    totalSales += line.subtotal;
    totalQty += line.qty;
    outletSales[line.outlet].sales += line.subtotal;
    outletSales[line.outlet].qty += line.qty;

    // Item aggregation
    const itemKey = `${line.product}|||${line.category}`;
    let itemRow = itemMap.get(itemKey);
    if (!itemRow) {
      itemRow = {
        product: line.product,
        category: line.category,
        foodBev: line.foodBev,
        outletSales: {},
        outletQty: {},
        totalQty: 0,
        totalSales: 0,
      };
      itemMap.set(itemKey, itemRow);
    }
    itemRow.totalQty += line.qty;
    itemRow.totalSales += line.subtotal;
    addTo(itemRow.outletSales, line.outlet, line.subtotal);
    addTo(itemRow.outletQty, line.outlet, line.qty);

    // Category aggregation
    let catRow = catMap.get(line.category);
    if (!catRow) {
      catRow = {
        category: line.category,
        foodBev: line.foodBev,
        outletSales: {},
        totalQty: 0,
        totalSales: 0,
      };
      catMap.set(line.category, catRow);
    }
    catRow.totalQty += line.qty;
    catRow.totalSales += line.subtotal;
    addTo(catRow.outletSales, line.outlet, line.subtotal);

    // Food vs Beverage
    const fb = fbMap.get(line.foodBev)!;
    fb.totalSales += line.subtotal;
    fb.totalQty += line.qty;

    // Hourly sales
    if (line.hour !== null && line.hour >= 0 && line.hour < 24) {
      const hb = hourBuckets[line.hour];
      hb.totalSales += line.subtotal;
      addTo(hb.outletSales, line.outlet, line.subtotal);
    }

    // Daily sales
    if (line.dateKey) {
      const dr = ensureDay(line.dateKey);
      dr.totalSales += line.subtotal;
      addTo(dr.outletSales, line.outlet, line.subtotal);
    }
  }

  // Unique order-level transactions and guests
  let totalTx = 0;
  let totalGuests = 0;
  for (const ord of collectOrders(filtered).values()) {
    totalTx += 1;
    totalGuests += ord.guests;
    outletSales[ord.outlet].tx += 1;
    outletSales[ord.outlet].guests += ord.guests;

    if (ord.hour !== null && ord.hour >= 0 && ord.hour < 24) {
      hourBuckets[ord.hour].totalTx += 1;
      hourBuckets[ord.hour].totalGuests += ord.guests;
    }
    if (ord.dateKey) {
      const dr = ensureDay(ord.dateKey);
      dr.totalTx += 1;
      dr.totalGuests += ord.guests;
    }
  }

  if (!dataset.capabilities.hasOrderLevelTransactions && dataset.capabilities.totalPdfTransactions) {
    totalTx = dataset.capabilities.totalPdfTransactions;
  }

  const salesByItem = Array.from(itemMap.values()).sort((a, b) => b.totalSales - a.totalSales);
  const topFood = salesByItem
    .filter((i) => i.foodBev === 'Food')
    .sort((a, b) => b.totalQty - a.totalQty);
  const topBeverage = salesByItem
    .filter((i) => i.foodBev === 'Beverage')
    .sort((a, b) => b.totalQty - a.totalQty);

  const salesByCategory = Array.from(catMap.values()).sort(
    (a, b) => b.totalSales - a.totalSales
  );

  const dailySales = Array.from(dailyMap.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey)
  );

  // PDF daily payments fallback
  const pdfDailyMap = new Map<string, { dateKey: string; expected: number; counted: number }>();
  for (const row of dataset.pdfDailySessions) {
    if (filters.dateFrom && row.dateKey < filters.dateFrom) continue;
    if (filters.dateTo && row.dateKey > filters.dateTo) continue;
    const prev = pdfDailyMap.get(row.dateKey) ?? {
      dateKey: row.dateKey,
      expected: 0,
      counted: 0,
    };
    prev.expected += row.expected;
    prev.counted += row.counted;
    pdfDailyMap.set(row.dateKey, prev);
  }

  const dailyPaymentsFallback = Array.from(pdfDailyMap.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey)
  );

  const byOutlet = Object.fromEntries(
    OUTLETS.map((o) => {
      const r = outletSales[o];
      return [o, makeMetrics(r.sales, r.qty, r.tx, r.guests)];
    })
  ) as Record<Outlet, OutletMetrics>;

  return {
    kpis: {
      byOutlet,
      total: makeMetrics(totalSales, totalQty, totalTx, totalGuests),
    },
    outletBreakdown: buildOutletBreakdown(nonOutletFiltered),
    outletsInData: OUTLETS.filter((o) => outletSet.has(o)),
    topFood,
    topBeverage,
    salesByItem,
    salesByCategory,
    foodVsBev: Array.from(fbMap.entries()).map(([type, vals]) => ({
      type,
      ...vals,
    })),
    salesByHour: hourBuckets,
    dailySales,
    dailyPaymentsFallback,
    dateBounds,
    availableDates,
    allCategories: Array.from(categorySet).sort(),
    allProducts: Array.from(productSet).sort(),
    unassignedItemsCount,
    voidReceipts,
    voidSummary: {
      cancelled: sumGroup(voidReceipts.filter((r) => r.status === 'cancelled')),
      draft: sumGroup(voidReceipts.filter((r) => r.status === 'draft')),
    },
    refunds,
    refundSummary: sumGroup(refunds),
  };
}

export function aggregateItemTrend(
  dataset: ParsedDataset,
  filters: FilterState,
  productName: string
): ItemTrendResult {
  const dailyMap = new Map<string, ItemDailyPoint>();
  const hourly: ItemHourlyPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    qty: 0,
    sales: 0,
  }));

  let totalQty = 0;
  let totalSales = 0;
  const target = productName.toLowerCase();

  for (const line of dataset.lines) {
    if (line.product.toLowerCase() !== target) continue;
    if (line.orderStatus && line.orderStatus !== 'valid') continue;
    if (!matchesOutletFilter(line, filters.outlets)) continue;
    if (filters.foodBevFilter !== 'All' && line.foodBev !== filters.foodBevFilter) continue;
    if (filters.dateFrom && line.dateKey && line.dateKey < filters.dateFrom) continue;
    if (filters.dateTo && line.dateKey && line.dateKey > filters.dateTo) continue;

    totalQty += line.qty;
    totalSales += line.subtotal;

    if (line.dateKey) {
      const existing = dailyMap.get(line.dateKey) ?? {
        dateKey: line.dateKey,
        qty: 0,
        sales: 0,
      };
      existing.qty += line.qty;
      existing.sales += line.subtotal;
      dailyMap.set(line.dateKey, existing);
    }

    if (line.hour !== null && line.hour >= 0 && line.hour < 24) {
      hourly[line.hour].qty += line.qty;
      hourly[line.hour].sales += line.subtotal;
    }
  }

  return {
    product: productName,
    totalQty,
    totalSales,
    daily: Array.from(dailyMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    hourly,
  };
}
