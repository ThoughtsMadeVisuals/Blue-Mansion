import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { FileSummary, ParsedDataset, PosLine, PosOrder } from '../types';
import { cleanName, inferFoodBev, productKey } from './classify';

type RawRow = Record<string, unknown>;

// ---------------------------------------------------------------- columns

function norm(h: string): string {
  return h.trim().toLowerCase().replace(/\s*\/\s*/g, ' / ').replace(/[\s_]+/g, ' ');
}

function find(headers: string[], exact: string[], partial: string[] = []): string | undefined {
  const n = headers.map((h) => ({ raw: h, n: norm(h) }));
  for (const c of exact) {
    const f = n.find((h) => h.n === c);
    if (f) return f.raw;
  }
  for (const c of partial) {
    const f = n.find((h) => h.n.endsWith(c));
    if (f) return f.raw;
  }
  return undefined;
}

export function detectColumns(headers: string[]) {
  return {
    orderRef: find(headers, ['order ref', 'order reference', 'pos reference', 'name']),
    receipt: find(headers, ['receipt number', 'receipt', 'receipt no']),
    date: find(headers, ['date', 'order date', 'date order', 'created on']),
    pos: find(headers, ['point of sale', 'session / point of sale', 'pos', 'outlet']),
    status: find(headers, ['status', 'order status', 'state']),
    guests: find(headers, ['guests', 'customer count', 'number of guests', 'covers', 'pax']),
    total: find(headers, ['total', 'amount total']),
    product: find(
      headers,
      ['order lines / product', 'lines / product', 'product', 'product name', 'item'],
    ),
    qty: find(headers, ['order lines / quantity', 'lines / quantity', 'quantity', 'qty']),
    excl: find(
      headers,
      ['order lines / tax excl.', 'order lines / tax excl', 'lines / tax excl.', 'lines / subtotal w/o tax', 'lines / subtotal'],
      ['tax excl.', 'tax excl', 'subtotal w/o tax'],
    ),
    incl: find(
      headers,
      ['order lines / tax incl.', 'order lines / tax incl', 'lines / tax incl.', 'lines / subtotal incl.'],
      ['tax incl.', 'tax incl'],
    ),
    posCategory: find(headers, [], ['point of sale category', 'pos category', 'pos product category']),
    productCategory: find(headers, [], ['product / product category']) ??
      find(headers, ['product category']),
  };
}

// ---------------------------------------------------------------- values

export function parseNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  let neg = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    neg = true;
    s = s.slice(1, -1);
  }
  const n = Number(s.replace(/rm/gi, '').replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

export interface ParsedDate {
  iso: string;
  dateKey: string;
  hour: number;
  dow: number;
}

function build(y: number, m: number, d: number, hh: number, mi: number, ss: number): ParsedDate {
  const p = (x: number) => String(x).padStart(2, '0');
  const dateKey = `${y}-${p(m)}-${p(d)}`;
  return {
    iso: `${dateKey} ${p(hh)}:${p(mi)}:${p(ss)}`,
    dateKey,
    hour: hh,
    dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
  };
}

export function parseDate(v: unknown): ParsedDate | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 90000) {
    // Excel serial date. Convert with whole seconds in UTC so no timezone drift.
    const totalSec = Math.round(v * 86400);
    const days = Math.floor(totalSec / 86400);
    const secOfDay = totalSec - days * 86400;
    const dt = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
    return build(
      dt.getUTCFullYear(),
      dt.getUTCMonth() + 1,
      dt.getUTCDate(),
      Math.floor(secOfDay / 3600),
      Math.floor((secOfDay % 3600) / 60),
      secOfDay % 60,
    );
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return build(v.getFullYear(), v.getMonth() + 1, v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return build(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i);
  if (m) {
    let hh = +(m[4] ?? 0);
    const ap = m[7]?.toUpperCase();
    if (ap === 'PM' && hh < 12) hh += 12;
    if (ap === 'AM' && hh === 12) hh = 0;
    return build(+m[3], +m[2], +m[1], hh, +(m[5] ?? 0), +(m[6] ?? 0));
  }
  return null;
}

const CANCELLED = /cancel/i;
const DRAFT = /^(new|draft|quotation)$/i;

// ---------------------------------------------------------------- rows

export interface FileParseResult {
  orders: PosOrder[];
  /** Lines with `o` relative to this file's orders array. */
  lines: PosLine[];
  summary: FileSummary;
}

export function normalizeRows(rows: RawRow[], fileName: string): FileParseResult {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const c = detectColumns(headers);
  const warnings: string[] = [];
  const summary: FileSummary = {
    fileName,
    rowsRead: rows.length,
    ordersKept: 0,
    linesKept: 0,
    cancelledOrders: 0,
    cancelledSales: 0,
    draftOrders: 0,
    draftSales: 0,
    duplicateOrders: 0,
    posNames: [],
    dateFrom: null,
    dateTo: null,
    hasCategories: Boolean(c.posCategory || c.productCategory),
    hasProductCategory: Boolean(c.productCategory),
    hasGuests: Boolean(c.guests),
    hasReceipt: Boolean(c.receipt),
    detectedColumns: c,
    warnings,
  };

  if (!rows.length) {
    warnings.push('The file is empty.');
    return { orders: [], lines: [], summary };
  }
  if (!c.product || !(c.excl || c.incl)) {
    warnings.push(
      `Could not find the "Order Lines/Product" and "Order Lines/Tax Excl." columns. Columns found: ${headers.join(', ')}`,
    );
    return { orders: [], lines: [], summary };
  }
  if (!c.date) warnings.push('No "Date" column found, so daily, monthly and hourly charts will be empty.');
  if (!c.pos) warnings.push('No "Point of Sale" column found, so outlets cannot be told apart.');
  if (!summary.hasCategories)
    warnings.push(
      'This file has no category columns. Categories were copied from other uploaded files where the same item appears. Re-export with "Order Lines/Product/Point of Sale Category" and "Order Lines/Product/Product Category" for full accuracy.',
    );
  if (!c.status) warnings.push('No "Status" column found, so cancelled orders cannot be excluded.');

  const orders: PosOrder[] = [];
  const lines: PosLine[] = [];
  const posSet = new Set<string>();
  let current: { idx: number; skip: 'cancelled' | 'draft' | 'nodate' | null } | null = null;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  const str = (row: RawRow, col?: string) => (col ? String(row[col] ?? '').trim() : '');

  rows.forEach((row, i) => {
    const pos = str(row, c.pos);
    const ref = str(row, c.orderRef);
    const receipt = str(row, c.receipt);
    const isHeader = Boolean(pos || receipt || (ref && c.date && row[c.date] !== '' && row[c.date] != null));

    if (isHeader) {
      const status = str(row, c.status);
      const skip = CANCELLED.test(status) ? 'cancelled' : DRAFT.test(status) ? 'draft' : null;
      const d = c.date ? parseDate(row[c.date]) : null;
      if (!d && !skip) {
        // Header without a usable date: keep lines but they can't go in time charts.
        warnings.length < 20 && warnings.push(`Row ${i + 2}: order ${ref || receipt} has no readable date and was skipped.`);
        current = { idx: -1, skip: 'nodate' };
        return;
      }
      if (skip) {
        current = { idx: -1, skip };
        if (skip === 'cancelled') summary.cancelledOrders++;
        else summary.draftOrders++;
      } else {
        const order: PosOrder = {
          key: `${pos}|${receipt || ref || `row${i}`}|${d!.iso}`,
          orderRef: ref,
          receipt,
          pos: pos || 'Unknown',
          dateKey: d!.dateKey,
          hour: d!.hour,
          dow: d!.dow,
          guests: c.guests ? Math.max(0, parseNumber(row[c.guests])) : 0,
          isRefund: /refund/i.test(ref) || (c.total ? parseNumber(row[c.total]) < 0 : false),
        };
        orders.push(order);
        posSet.add(order.pos);
        if (!minDate || order.dateKey < minDate) minDate = order.dateKey;
        if (!maxDate || order.dateKey > maxDate) maxDate = order.dateKey;
        current = { idx: orders.length - 1, skip: null };
      }
    }

    const product = cleanName(row[c.product!]);
    if (!product || !current) return; // category-only continuation rows, blank rows

    const salesExcl = c.excl ? parseNumber(row[c.excl]) : parseNumber(row[c.incl!]);
    const salesIncl = c.incl ? parseNumber(row[c.incl]) : salesExcl;
    if (current.skip) {
      if (current.skip === 'cancelled') summary.cancelledSales += salesExcl;
      else if (current.skip === 'draft') summary.draftSales += salesExcl;
      return;
    }
    if (current.idx < 0) return;

    const posCategory = cleanName(str(row, c.posCategory));
    const productCategory = cleanName(str(row, c.productCategory));
    const category = posCategory || productCategory || '';
    lines.push({
      o: current.idx,
      product,
      category,
      productCategory,
      categoryInferred: false,
      foodBev: inferFoodBev(productCategory, category, product),
      qty: c.qty ? parseNumber(row[c.qty]) : 1,
      salesExcl,
      salesIncl,
    });
  });

  summary.ordersKept = orders.length;
  summary.linesKept = lines.length;
  summary.posNames = Array.from(posSet).sort();
  summary.dateFrom = minDate;
  summary.dateTo = maxDate;
  return { orders, lines, summary };
}

export async function parseFile(file: File): Promise<FileParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  let rows: RawRow[];
  if (ext === 'csv') {
    const text = await file.text();
    rows = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true }).data;
  } else if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    // raw serial numbers for dates (avoids the library's timezone drift)
    rows = XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true });
  } else {
    throw new Error(`Unsupported file type: ${file.name}. Please upload an Odoo .csv or .xlsx export.`);
  }
  return normalizeRows(rows, file.name);
}

// ---------------------------------------------------------------- merge

/** Add a parsed file to the dataset, skipping orders already loaded, then backfill categories. */
export function mergeIntoDataset(existing: ParsedDataset | null, incoming: FileParseResult): ParsedDataset {
  const orders = existing ? existing.orders.slice() : [];
  const lines = existing ? existing.lines.slice() : [];
  const files = existing ? existing.files.filter((f) => f.fileName !== incoming.summary.fileName) : [];
  const seen = new Set(orders.map((o) => o.key));
  const remap = new Map<number, number>();

  incoming.orders.forEach((o, i) => {
    if (seen.has(o.key)) {
      incoming.summary.duplicateOrders++;
      return;
    }
    seen.add(o.key);
    remap.set(i, orders.length);
    orders.push(o);
  });
  for (const l of incoming.lines) {
    const idx = remap.get(l.o);
    if (idx !== undefined) lines.push({ ...l, o: idx });
  }
  files.push(incoming.summary);
  const inferred = backfillCategories(lines);
  return { orders, lines, files, inferredCategoryLines: inferred };
}

/** Copy categories onto lines that have none, from the same product in other files. */
export function backfillCategories(lines: PosLine[]): number {
  const known = new Map<string, { category: string; productCategory: string }>();
  for (const l of lines) {
    if (l.category && !l.categoryInferred) {
      const k = productKey(l.product);
      if (!known.has(k)) known.set(k, { category: l.category, productCategory: l.productCategory });
    }
  }
  let count = 0;
  for (const l of lines) {
    if (l.category && !l.categoryInferred) continue;
    const hit = known.get(productKey(l.product));
    if (hit) {
      l.category = hit.category;
      l.productCategory = hit.productCategory;
      l.categoryInferred = true;
      l.foodBev = inferFoodBev(hit.productCategory, hit.category, l.product);
      count++;
    } else if (!l.category) {
      l.foodBev = inferFoodBev('', '', l.product);
    }
  }
  return count;
}
