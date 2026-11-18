import { describe, expect, it } from 'vitest';
import { normalizeRows } from '../../parsers/csvXlsxParser';
import { aggregateDataset } from '../aggregator';
import { createDefaultMappingRules } from '../defaultMappings';
import { checkDuplicate, combineFiles } from '../fileSet';
import type { FilterState } from '../../types/pos';

const rules = createDefaultMappingRules();
const FILTERS: FilterState = { outlets: [], dateFrom: '', dateTo: '', foodBevFilter: 'All', searchQuery: '' };

function order(i: number, pos: string, amount: number, extra: Record<string, unknown> = {}) {
  return {
    'Order Ref': extra['Order Ref'] ?? '/',
    Date: `2026-03-${String(1 + (i % 28)).padStart(2, '0')} 12:${String(i % 60).padStart(2, '0')}:00`,
    'Point of Sale': pos,
    'Receipt Number': `R-${i}`,
    Status: extra.Status ?? 'Posted',
    Guests: 2,
    'Order Lines/Product': 'Laksa',
    'Order Lines/Quantity': amount < 0 ? -1 : 1,
    'Order Lines/Tax Excl.': amount,
    ...extra,
  };
}

const rowsA = Array.from({ length: 20 }, (_, i) => order(i, i % 2 ? 'The Bar' : 'Mangga (Day)', 10));

describe('duplicate file detection', () => {
  it('rejects the same data uploaded again, even under another file name', () => {
    const a = normalizeRows(rowsA, 'export.csv', rules, 'a');
    const b = normalizeRows(rowsA, 'export (1).xlsx', rules, 'b');
    const check = checkDuplicate(b, [a]);
    expect(check.kind).toBe('same');
    if (check.kind === 'same') expect(check.duplicateOf).toEqual(['export.csv']);
  });

  it('rejects byte-identical files by content hash', () => {
    const a = normalizeRows(rowsA, 'x.csv', rules, 'a');
    const b = normalizeRows(rowsA.slice(0, 5), 'y.csv', rules, 'b');
    a.fileSummaries![0].contentHash = 'abc';
    b.fileSummaries![0].contentHash = 'abc';
    expect(checkDuplicate(b, [a]).kind).toBe('same');
  });

  it('keeps only new receipts when files partly overlap', () => {
    const a = normalizeRows(rowsA.slice(0, 10), 'jan.csv', rules, 'a');
    const b = normalizeRows(rowsA.slice(5, 20), 'jan-feb.csv', rules, 'b');
    const check = checkDuplicate(b, [a]);
    expect(check.kind).toBe('partial');
    if (check.kind !== 'partial') return;
    expect(check.overlap).toBe(5);
    const combined = combineFiles([a, check.dataset])!;
    const report = aggregateDataset(combined, FILTERS);
    expect(report.kpis.total.transactions).toBe(20);
    expect(report.kpis.total.sales).toBe(200);
  });

  it('accepts unrelated files', () => {
    const a = normalizeRows(rowsA.slice(0, 10), 'a.csv', rules, 'a');
    const b = normalizeRows(rowsA.slice(10), 'b.csv', rules, 'b');
    expect(checkDuplicate(b, [a]).kind).toBe('new');
  });
});

describe('outlet selection, refunds and file removal', () => {
  const rows = [
    ...rowsA,
    order(100, 'The Bar', -25, { 'Order Ref': 'The Bar - 000123 REFUND' }),
    order(101, 'Mangga (Day)', 40, { Status: 'Cancelled' }),
  ];
  const ds = normalizeRows(rows, 'mix.csv', rules, 'mix');

  it('combines several selected outlets', () => {
    const both = aggregateDataset(ds, { ...FILTERS, outlets: ['Mangga (Day)', 'Indigo Bar'] });
    const bar = aggregateDataset(ds, { ...FILTERS, outlets: ['Indigo Bar'] });
    const mangga = aggregateDataset(ds, { ...FILTERS, outlets: ['Mangga (Day)'] });
    expect(both.kpis.total.sales).toBeCloseTo(bar.kpis.total.sales + mangga.kpis.total.sales);
    expect(both.kpis.total.sales).toBe(175);
  });

  it('lists refunds (included in sales) and cancelled receipts (excluded)', () => {
    const r = aggregateDataset(ds, FILTERS);
    expect(r.refundSummary).toEqual({ orders: 1, sales: -25 });
    expect(r.refunds[0].receipt).toContain('REFUND');
    expect(r.voidSummary.cancelled).toEqual({ orders: 1, sales: 40 });
    expect(r.kpis.total.sales).toBe(200 - 25);

    const barOnly = aggregateDataset(ds, { ...FILTERS, outlets: ['Indigo Bar'] });
    expect(barOnly.voidReceipts).toHaveLength(0);
    expect(barOnly.refunds).toHaveLength(1);
  });

  it('removing a file removes all of its data', () => {
    const other = normalizeRows([order(500, 'Mangga (Day)', 99)], 'other.csv', rules, 'other');
    const remaining = [ds, other].filter((f) => f.fileSummaries?.[0].fileId !== 'mix');
    const r = aggregateDataset(combineFiles(remaining)!, FILTERS);
    expect(r.kpis.total.sales).toBe(99);
    expect(r.kpis.total.transactions).toBe(1);
  });
});

describe('refund sign correction', () => {
  it('fixes refund lines exported with a positive amount, using the receipt Total', () => {
    const rows = [
      // 2026-style refund: qty -1 but positive amounts; Total is negative
      { 'Order Ref': 'The Bar - 001856 REFUND', Date: '2026-11-16 18:25:36', 'Point of Sale': 'The Bar', 'Receipt Number': '266-3-001863', Status: 'Posted', Total: -99.12, Guests: 0, 'Order Lines/Product': 'Tiger Beer', 'Order Lines/Quantity': -1, 'Order Lines/Tax Excl.': 25, 'Order Lines/Tax Incl.': 29.5 },
      { 'Order Lines/Product': 'Kwai Feh Lemongrass', 'Order Lines/Quantity': -1, 'Order Lines/Tax Excl.': 59, 'Order Lines/Tax Incl.': 69.62 },
      // 2025-style refund: already negative, must stay as is
      { 'Order Ref': 'POS/Mangga/202512/31332 REFUND', Date: '2025-12-31 10:00:00', 'Point of Sale': 'Mangga (Day)', 'Receipt Number': 'R2', Status: 'Posted', Total: -16.96, Guests: 0, 'Order Lines/Product': 'Apple Juice', 'Order Lines/Quantity': -1, 'Order Lines/Tax Excl.': -16, 'Order Lines/Tax Incl.': -16.96 },
      // Normal sale
      { 'Order Ref': 'Mangga (Day) - 1', Date: '2025-12-31 11:00:00', 'Point of Sale': 'Mangga (Day)', 'Receipt Number': 'R3', Status: 'Posted', Total: 116, Guests: 2, 'Order Lines/Product': 'Laksa', 'Order Lines/Quantity': 2, 'Order Lines/Tax Excl.': 100, 'Order Lines/Tax Incl.': 116 },
    ];
    const ds = normalizeRows(rows, 'signs.csv', rules, 'signs');
    expect(ds.fileSummaries?.[0].signFixes).toEqual({ receipts: 1, lines: 2 });
    const r = aggregateDataset(ds, FILTERS);
    expect(r.kpis.total.sales).toBeCloseTo(100 - 16 - 84);
    expect(r.refundSummary).toEqual({ orders: 2, sales: -100 });
  });
});
