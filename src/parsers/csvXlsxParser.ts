import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { MappingRules, ParsedDataset, PosOrderLine } from '../types/pos';
import {
  inferFoodBev,
  inferOutletFromConfig,
  inferOutletFromHeuristics,
  inferSubOutlet,
} from '../utils/defaultMappings';

type RawRow = Record<string, unknown>;

interface ColumnMap {
  orderRef?: string;
  orderDate?: string;
  config?: string;
  guests?: string;
  product?: string;
  category?: string;
  qty?: string;
  subtotal?: string;
  discount?: string;
  paymentMethod?: string;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/[\s_]+/g, ' ');
}

function findColumn(headers: string[], candidates: string[]): string | undefined {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  // Exact match first
  for (const cand of candidates) {
    const found = normalized.find((h) => h.norm === cand);
    if (found) return found.raw;
  }
  // Suffix / partial match (e.g., "lines / product" matches "product")
  for (const cand of candidates) {
    const found = normalized.find(
      (h) => h.norm.endsWith(`/ ${cand}`) || h.norm.endsWith(`/${cand}`) || h.norm.includes(cand)
    );
    if (found) return found.raw;
  }
  return undefined;
}

function detectColumns(headers: string[]): ColumnMap {
  return {
    orderRef: findColumn(headers, [
      'order ref',
      'receipt number',
      'pos reference',
      'reference',
      'order',
      'name',
    ]),
    orderDate: findColumn(headers, [
      'order date',
      'date order',
      'date',
      'created on',
      'timestamp',
    ]),
    config: findColumn(headers, [
      'session / point of sale',
      'point of sale',
      'pos config',
      'config',
      'outlet',
      'session',
    ]),
    guests: findColumn(headers, [
      'customer count',
      'number of guests',
      'guests',
      'guest',
      'covers',
      'pax',
    ]),
    product: findColumn(headers, [
      'lines / product',
      'lines/product',
      'product name',
      'product',
      'item name',
      'item',
    ]),
    category: findColumn(headers, [
      'lines / product / pos product category',
      'lines / product / point of sale category',
      'pos product category',
      'pos category',
      'product category',
      'category',
    ]),
    qty: findColumn(headers, [
      'lines / quantity',
      'lines/quantity',
      'quantity',
      'product qty',
      'qty',
    ]),
    subtotal: findColumn(headers, [
      'order lines / tax excl.',
      'order lines / tax excl',
      'lines / tax excl.',
      'lines / tax excl',
      'tax excl.',
      'tax excl',
      'lines / subtotal',
      'lines / subtotal w/o tax',
      'subtotal w/o tax',
      'subtotal',
      'price subtotal',
      'order lines / tax incl.',
      'order lines / tax incl',
      'lines / total',
      'total',
      'amount',
    ]),
    discount: findColumn(headers, ['lines / discount (%)', 'discount (%)', 'discount']),
    paymentMethod: findColumn(headers, [
      'payments / payment method',
      'payment methods',
      'payment method',
    ]),
  };
}

export function parseNumber(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (val == null) return 0;
  let str = String(val).trim();
  if (!str) return 0;
  let negative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    negative = true;
    str = str.slice(1, -1);
  }
  str = str.replace(/rm/gi, '').replace(/,/g, '').replace(/%/g, '').trim();
  const num = Number(str);
  if (!Number.isFinite(num)) return 0;
  return negative ? -num : num;
}

export function parseDateTime(
  val: unknown
): { iso: string; dateKey: string; hour: number | null } | null {
  if (val == null || val === '') return null;

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    const hh = val.getHours();
    const mm = String(val.getMinutes()).padStart(2, '0');
    const ss = String(val.getSeconds()).padStart(2, '0');
    return {
      iso: `${y}-${m}-${d} ${String(hh).padStart(2, '0')}:${mm}:${ss}`,
      dateKey: `${y}-${m}-${d}`,
      hour: hh,
    };
  }

  // Excel serial date number
  if (typeof val === 'number' && val > 25000 && val < 80000) {
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    const fractionalDay = val - Math.floor(val) + 0.0000001;
    let totalSeconds = Math.floor(86400 * fractionalDay);
    const seconds = totalSeconds % 60;
    totalSeconds -= seconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds - hours * 3600) / 60);
    const y = dateInfo.getUTCFullYear();
    const m = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateInfo.getUTCDate()).padStart(2, '0');
    return {
      iso: `${y}-${m}-${d} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      dateKey: `${y}-${m}-${d}`,
      hour: hours,
    };
  }

  const str = String(val).trim();
  if (!str) return null;

  // Match DD/MM/YYYY [HH:MM[:SS] [AM/PM]]
  const dmyMatch = str.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i
  );
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    let hour: number | null = dmyMatch[4] != null ? Number(dmyMatch[4]) : null;
    const min = dmyMatch[5] != null ? Number(dmyMatch[5]) : 0;
    const sec = dmyMatch[6] != null ? Number(dmyMatch[6]) : 0;
    const ampm = dmyMatch[7]?.toUpperCase();
    if (hour !== null && ampm) {
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
    }
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const timeStr =
      hour !== null
        ? `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
        : '00:00:00';
    return { iso: `${dateKey} ${timeStr}`, dateKey, hour };
  }

  // Match YYYY-MM-DD [HH:MM[:SS]]
  const ymdMatch = str.match(
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    const hour: number | null = ymdMatch[4] != null ? Number(ymdMatch[4]) : null;
    const min = ymdMatch[5] != null ? Number(ymdMatch[5]) : 0;
    const sec = ymdMatch[6] != null ? Number(ymdMatch[6]) : 0;
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const timeStr =
      hour !== null
        ? `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
        : '00:00:00';
    return { iso: `${dateKey} ${timeStr}`, dateKey, hour };
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    const hh = parsed.getHours();
    return {
      iso: `${y}-${m}-${d} ${String(hh).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}:00`,
      dateKey: `${y}-${m}-${d}`,
      hour: hh,
    };
  }

  return null;
}

export function normalizeRows(
  rows: RawRow[],
  fileName: string,
  rules: MappingRules
): ParsedDataset {
  const warnings: string[] = [];
  if (rows.length === 0) {
    return {
      lines: [],
      pdfPayments: [],
      pdfDailySessions: [],
      capabilities: {
        hasHourly: false,
        hasDailyItems: false,
        hasDailyPayments: false,
        hasGuests: false,
        hasOrderLevelTransactions: false,
        sourceFiles: [fileName],
      },
      warnings: [`No rows found in ${fileName}.`],
    };
  }

  const headers = Object.keys(rows[0]);
  const cols = detectColumns(headers);

  if (!cols.product && !cols.subtotal) {
    warnings.push(
      `Could not detect standard Odoo POS Product or Subtotal columns in "${fileName}". Detected columns: ${headers.slice(0, 8).join(', ')}`
    );
  }

  const lines: PosOrderLine[] = [];
  let lastOrderRef = '';
  let lastParsedDate: { iso: string; dateKey: string; hour: number | null } | null = null;
  let lastConfig = '';
  let lastGuests: number | null = null;
  let lastPayment = '';

  let hasHourly = false;
  let hasDailyItems = false;
  let hasGuests = false;
  let hasOrderRef = false;

  rows.forEach((row, idx) => {
    const rawOrderRef = cols.orderRef ? String(row[cols.orderRef] ?? '').trim() : '';
    const rawDateVal = cols.orderDate ? row[cols.orderDate] : undefined;
    const rawConfig = cols.config ? String(row[cols.config] ?? '').trim() : '';
    const rawGuestsVal = cols.guests ? row[cols.guests] : undefined;
    const rawPayment = cols.paymentMethod ? String(row[cols.paymentMethod] ?? '').trim() : '';

    // When a new parent order header appears, update carry-forward state
    if (rawOrderRef) {
      lastOrderRef = rawOrderRef;
      hasOrderRef = true;
      lastGuests =
        rawGuestsVal !== undefined && rawGuestsVal !== '' && rawGuestsVal !== null
          ? parseNumber(rawGuestsVal)
          : null;
    } else if (rawGuestsVal !== undefined && rawGuestsVal !== '' && rawGuestsVal !== null) {
      lastGuests = parseNumber(rawGuestsVal);
    }

    const parsedDate = parseDateTime(rawDateVal);
    if (parsedDate) {
      lastParsedDate = parsedDate;
    }
    if (rawConfig) {
      lastConfig = rawConfig;
    }
    if (rawPayment) {
      lastPayment = rawPayment;
    }

    const product = cols.product ? String(row[cols.product] ?? '').trim() : '';
    const category = cols.category ? String(row[cols.category] ?? '').trim() || 'Uncategorized' : 'Uncategorized';
    const qty = cols.qty ? parseNumber(row[cols.qty]) : 1;
    const subtotal = cols.subtotal ? parseNumber(row[cols.subtotal]) : 0;
    const discountPct = cols.discount ? parseNumber(row[cols.discount]) : undefined;

    // Skip empty separator rows or totals rows
    if (!product && subtotal === 0) return;
    if (product.toLowerCase() === 'total' || rawOrderRef.toLowerCase() === 'total') return;

    const effectiveConfig = rawConfig || lastConfig;
    const subOutlet = inferSubOutlet(effectiveConfig);
    let outlet = inferOutletFromConfig(effectiveConfig, rules);
    if (outlet === 'Unassigned') {
      outlet = inferOutletFromHeuristics(category, product, rules);
    }

    const effectiveDate = parsedDate ?? lastParsedDate;
    if (effectiveDate) {
      hasDailyItems = true;
      if (effectiveDate.hour !== null) hasHourly = true;
    }

    const guests = lastGuests;
    if (guests !== null && guests > 0) hasGuests = true;

    const orderRef = lastOrderRef || `ROW-${idx + 1}`;
    const foodBev = inferFoodBev(category, product, rules);

    lines.push({
      id: `${fileName}-${idx}`,
      orderRef,
      orderDate: effectiveDate?.iso ?? null,
      dateKey: effectiveDate?.dateKey ?? null,
      hour: effectiveDate?.hour ?? null,
      rawConfig: effectiveConfig,
      subOutlet,
      outlet,
      guests,
      product: product || 'Order Total',
      category,
      foodBev,
      qty,
      subtotal,
      discountPct,
      paymentMethod: lastPayment || undefined,
      sourceType: 'csv_xlsx',
    });
  });

  const dates = lines
    .map((l) => l.dateKey)
    .filter((d): d is string => Boolean(d))
    .sort();
  const outlets = Array.from(
    new Set(lines.map((l) => (l.subOutlet !== 'Unknown' ? l.subOutlet : l.outlet)))
  ).filter((o) => o !== 'Unassigned');

  return {
    lines,
    pdfPayments: [],
    pdfDailySessions: [],
    capabilities: {
      hasHourly,
      hasDailyItems,
      hasDailyPayments: false,
      hasGuests,
      hasOrderLevelTransactions: hasOrderRef,
      sourceFiles: [fileName],
    },
    fileSummaries: [
      {
        fileName,
        lineCount: lines.length,
        outlets,
        dateFrom: dates[0] ?? null,
        dateTo: dates[dates.length - 1] ?? null,
        hasHourly,
        hasGuests,
      },
    ],
    warnings,
  };
}

export async function parseCsvOrXlsxFile(
  file: File,
  rules: MappingRules
): Promise<ParsedDataset> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    const text = await file.text();
    const parsed = Papa.parse<RawRow>(text, {
      header: true,
      skipEmptyLines: true,
    });
    return normalizeRows(parsed.data, file.name, rules);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });
  return normalizeRows(rows, file.name, rules);
}
