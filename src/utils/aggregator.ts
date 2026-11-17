import type {
  FilterState,
  FoodBevType,
  MappingRules,
  Outlet,
  ParsedDataset,
  PosOrderLine,
} from '../types/pos';
import {
  inferFoodBev,
  inferOutletFromConfig,
  inferOutletFromHeuristics,
} from './defaultMappings';

export interface OutletMetrics {
  sales: number;
  qty: number;
  transactions: number;
  guests: number;
  avgTicket: number;
  avgSpendPerGuest: number;
}

export interface ItemAggRow {
  product: string;
  category: string;
  foodBev: FoodBevType;
  manggaQty: number;
  manggaSales: number;
  indigoQty: number;
  indigoSales: number;
  unassignedQty: number;
  unassignedSales: number;
  totalQty: number;
  totalSales: number;
}

export interface CategoryAggRow {
  category: string;
  foodBev: FoodBevType;
  manggaQty: number;
  manggaSales: number;
  indigoQty: number;
  indigoSales: number;
  totalQty: number;
  totalSales: number;
}

export interface HourAggRow {
  hour: number;
  label: string;
  manggaSales: number;
  indigoSales: number;
  totalSales: number;
  manggaTx: number;
  indigoTx: number;
  totalTx: number;
  manggaGuests: number;
  indigoGuests: number;
  totalGuests: number;
}

export interface DailyAggRow {
  dateKey: string;
  manggaSales: number;
  indigoSales: number;
  totalSales: number;
  manggaTx: number;
  indigoTx: number;
  totalTx: number;
  manggaGuests: number;
  indigoGuests: number;
  totalGuests: number;
}

export interface AggregatedReport {
  kpis: {
    mangga: OutletMetrics;
    indigo: OutletMetrics;
    total: OutletMetrics;
  };
  topFood: ItemAggRow[];
  topBeverage: ItemAggRow[];
  salesByItem: ItemAggRow[];
  salesByCategory: CategoryAggRow[];
  foodVsBev: {
    type: FoodBevType;
    manggaSales: number;
    indigoSales: number;
    totalSales: number;
    manggaQty: number;
    indigoQty: number;
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

  return {
    ...dataset,
    lines: updatedLines,
  };
}

function matchesOutletFilter(line: PosOrderLine, filter: FilterState['outletFilter']): boolean {
  if (filter === 'compare') return true;
  if (filter === 'Mangga') return line.outlet === 'Mangga';
  if (filter === 'Indigo Bar') return line.outlet === 'Indigo Bar';
  if (filter === 'Mangga (Day)') return line.subOutlet === 'Mangga (Day)';
  if (filter === 'Mangga (Dinner)') return line.subOutlet === 'Mangga (Dinner)';
  return true;
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
  let unassignedItemsCount = 0;

  for (const l of dataset.lines) {
    categorySet.add(l.category);
    productSet.add(l.product);
    if (l.outlet === 'Unassigned') unassignedItemsCount++;
  }

  const filtered = dataset.lines.filter((line) => {
    if (!matchesOutletFilter(line, filters.outletFilter)) return false;
    if (filters.foodBevFilter !== 'All' && line.foodBev !== filters.foodBevFilter) {
      return false;
    }
    if (filters.dateFrom && line.dateKey && line.dateKey < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && line.dateKey && line.dateKey > filters.dateTo) {
      return false;
    }
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
  });

  // Track unique orders per outlet for accurate transaction & guest counts
  const seenOrders = new Map<string, { outlet: Outlet; guests: number; dateKey: string | null; hour: number | null }>();

  let manggaSales = 0;
  let manggaQty = 0;
  let indigoSales = 0;
  let indigoQty = 0;
  let totalSales = 0;
  let totalQty = 0;

  const itemMap = new Map<string, ItemAggRow>();
  const catMap = new Map<string, CategoryAggRow>();
  const fbMap = new Map<
    FoodBevType,
    { manggaSales: number; indigoSales: number; totalSales: number; manggaQty: number; indigoQty: number; totalQty: number }
  >([
    ['Food', { manggaSales: 0, indigoSales: 0, totalSales: 0, manggaQty: 0, indigoQty: 0, totalQty: 0 }],
    ['Beverage', { manggaSales: 0, indigoSales: 0, totalSales: 0, manggaQty: 0, indigoQty: 0, totalQty: 0 }],
    ['Other', { manggaSales: 0, indigoSales: 0, totalSales: 0, manggaQty: 0, indigoQty: 0, totalQty: 0 }],
  ]);

  const hourBuckets: HourAggRow[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    manggaSales: 0,
    indigoSales: 0,
    totalSales: 0,
    manggaTx: 0,
    indigoTx: 0,
    totalTx: 0,
    manggaGuests: 0,
    indigoGuests: 0,
    totalGuests: 0,
  }));

  const dailyMap = new Map<string, DailyAggRow>();

  const ensureDay = (dateKey: string): DailyAggRow => {
    let row = dailyMap.get(dateKey);
    if (!row) {
      row = {
        dateKey,
        manggaSales: 0,
        indigoSales: 0,
        totalSales: 0,
        manggaTx: 0,
        indigoTx: 0,
        totalTx: 0,
        manggaGuests: 0,
        indigoGuests: 0,
        totalGuests: 0,
      };
      dailyMap.set(dateKey, row);
    }
    return row;
  };

  for (const line of filtered) {
    totalSales += line.subtotal;
    totalQty += line.qty;
    if (line.outlet === 'Mangga') {
      manggaSales += line.subtotal;
      manggaQty += line.qty;
    } else if (line.outlet === 'Indigo Bar') {
      indigoSales += line.subtotal;
      indigoQty += line.qty;
    }

    // Order tracking for transactions & guests
    if (line.sourceType === 'csv_xlsx') {
      const orderKey = `${line.outlet}::${line.orderRef}`;
      if (!seenOrders.has(orderKey)) {
        seenOrders.set(orderKey, {
          outlet: line.outlet,
          guests: line.guests ?? 0,
          dateKey: line.dateKey,
          hour: line.hour,
        });
      }
    }

    // Item aggregation
    const itemKey = `${line.product}|||${line.category}`;
    let itemRow = itemMap.get(itemKey);
    if (!itemRow) {
      itemRow = {
        product: line.product,
        category: line.category,
        foodBev: line.foodBev,
        manggaQty: 0,
        manggaSales: 0,
        indigoQty: 0,
        indigoSales: 0,
        unassignedQty: 0,
        unassignedSales: 0,
        totalQty: 0,
        totalSales: 0,
      };
      itemMap.set(itemKey, itemRow);
    }
    itemRow.totalQty += line.qty;
    itemRow.totalSales += line.subtotal;
    if (line.outlet === 'Mangga') {
      itemRow.manggaQty += line.qty;
      itemRow.manggaSales += line.subtotal;
    } else if (line.outlet === 'Indigo Bar') {
      itemRow.indigoQty += line.qty;
      itemRow.indigoSales += line.subtotal;
    } else {
      itemRow.unassignedQty += line.qty;
      itemRow.unassignedSales += line.subtotal;
    }

    // Category aggregation
    let catRow = catMap.get(line.category);
    if (!catRow) {
      catRow = {
        category: line.category,
        foodBev: line.foodBev,
        manggaQty: 0,
        manggaSales: 0,
        indigoQty: 0,
        indigoSales: 0,
        totalQty: 0,
        totalSales: 0,
      };
      catMap.set(line.category, catRow);
    }
    catRow.totalQty += line.qty;
    catRow.totalSales += line.subtotal;
    if (line.outlet === 'Mangga') {
      catRow.manggaQty += line.qty;
      catRow.manggaSales += line.subtotal;
    } else if (line.outlet === 'Indigo Bar') {
      catRow.indigoQty += line.qty;
      catRow.indigoSales += line.subtotal;
    }

    // Food vs Beverage
    const fb = fbMap.get(line.foodBev)!;
    fb.totalSales += line.subtotal;
    fb.totalQty += line.qty;
    if (line.outlet === 'Mangga') {
      fb.manggaSales += line.subtotal;
      fb.manggaQty += line.qty;
    } else if (line.outlet === 'Indigo Bar') {
      fb.indigoSales += line.subtotal;
      fb.indigoQty += line.qty;
    }

    // Hourly sales
    if (line.hour !== null && line.hour >= 0 && line.hour < 24) {
      const hb = hourBuckets[line.hour];
      hb.totalSales += line.subtotal;
      if (line.outlet === 'Mangga') hb.manggaSales += line.subtotal;
      else if (line.outlet === 'Indigo Bar') hb.indigoSales += line.subtotal;
    }

    // Daily sales
    if (line.dateKey) {
      const dr = ensureDay(line.dateKey);
      dr.totalSales += line.subtotal;
      if (line.outlet === 'Mangga') dr.manggaSales += line.subtotal;
      else if (line.outlet === 'Indigo Bar') dr.indigoSales += line.subtotal;
    }
  }

  // Aggregate unique order-level transactions and guests
  let manggaTx = 0;
  let indigoTx = 0;
  let totalTx = 0;
  let manggaGuests = 0;
  let indigoGuests = 0;
  let totalGuests = 0;

  for (const ord of seenOrders.values()) {
    totalTx += 1;
    totalGuests += ord.guests;
    if (ord.outlet === 'Mangga') {
      manggaTx += 1;
      manggaGuests += ord.guests;
    } else if (ord.outlet === 'Indigo Bar') {
      indigoTx += 1;
      indigoGuests += ord.guests;
    }

    if (ord.hour !== null && ord.hour >= 0 && ord.hour < 24) {
      const hb = hourBuckets[ord.hour];
      hb.totalTx += 1;
      hb.totalGuests += ord.guests;
      if (ord.outlet === 'Mangga') {
        hb.manggaTx += 1;
        hb.manggaGuests += ord.guests;
      } else if (ord.outlet === 'Indigo Bar') {
        hb.indigoTx += 1;
        hb.indigoGuests += ord.guests;
      }
    }

    if (ord.dateKey) {
      const dr = ensureDay(ord.dateKey);
      dr.totalTx += 1;
      dr.totalGuests += ord.guests;
      if (ord.outlet === 'Mangga') {
        dr.manggaTx += 1;
        dr.manggaGuests += ord.guests;
      } else if (ord.outlet === 'Indigo Bar') {
        dr.indigoTx += 1;
        dr.indigoGuests += ord.guests;
      }
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

  const makeMetrics = (sales: number, qty: number, tx: number, guests: number): OutletMetrics => ({
    sales,
    qty,
    transactions: tx,
    guests,
    avgTicket: tx > 0 ? sales / tx : 0,
    avgSpendPerGuest: guests > 0 ? sales / guests : 0,
  });

  return {
    kpis: {
      mangga: makeMetrics(manggaSales, manggaQty, manggaTx, manggaGuests),
      indigo: makeMetrics(indigoSales, indigoQty, indigoTx, indigoGuests),
      total: makeMetrics(totalSales, totalQty, totalTx, totalGuests),
    },
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
    if (!matchesOutletFilter(line, filters.outletFilter)) continue;
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
