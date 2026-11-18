import { describe, expect, it } from 'vitest';
import { mergeIntoDataset, normalizeRows, parseDate, parseNumber } from '../parse';
import { computeReport, avgTicket } from '../aggregate';
import { cleanName, defaultOutletForPos, inferFoodBev } from '../classify';
import { defaultSettings } from '../storage';
import type { Filters } from '../../types';

const ALL: Filters = { pos: [], dateFrom: '', dateTo: '', foodBev: 'All', search: '' };

const H = {
  'Order Ref': '',
  Date: '',
  'Point of Sale': '',
  'Receipt Number': '',
  Status: '',
  Guests: '',
  Total: '',
  'Order Lines/Product': '',
  'Order Lines/Quantity': '',
  'Order Lines/Tax Excl.': '',
  'Order Lines/Tax Incl.': '',
  'Order Lines/Product/Point of Sale Category': '',
  'Order Lines/Product/Product Category': '',
};
const row = (o: Partial<typeof H> | Record<string, unknown>) => ({ ...H, ...o });

describe('values', () => {
  it('parses numbers and dates', () => {
    expect(parseNumber('RM 1,234.50')).toBeCloseTo(1234.5);
    expect(parseNumber('(45.00)')).toBeCloseTo(-45);
    expect(parseDate('2025-12-31 23:10:55')).toMatchObject({ dateKey: '2025-12-31', hour: 23, dow: 3 });
    expect(parseDate('14/06/2024 07:30:00 PM')).toMatchObject({ dateKey: '2024-06-14', hour: 19 });
  });

  it('converts Excel serial dates without drifting seconds', () => {
    // 2026-11-14 20:54:11
    const serial = 46340 + (20 * 3600 + 54 * 60 + 11) / 86400;
    expect(parseDate(serial)?.iso).toBe('2026-11-14 20:54:11');
  });

  it('cleans stray quotes from item names', () => {
    expect(cleanName('"C2-Black Olive Bread')).toBe('C2-Black Olive Bread');
    expect(cleanName(`''"Festive Dinner Menu 2025 `)).toBe('Festive Dinner Menu 2025');
    expect(cleanName('[FRCB] C2 - "Loin" Of Chicken')).toBe('[FRCB] C2 - "Loin" Of Chicken');
  });
});

describe('classification', () => {
  it('groups points of sale into outlets', () => {
    expect(defaultOutletForPos('Mangga (Day)')).toBe('Mangga');
    expect(defaultOutletForPos('Mangga (Dinner)')).toBe('Mangga');
    expect(defaultOutletForPos('The Bar')).toBe('The Bar');
    expect(defaultOutletForPos('Indigo at The Blue Mansion (Dinner)')).toBe('Indigo Restaurant');
    expect(defaultOutletForPos('Gift Shop')).toBe('Gift Shop');
    expect(defaultOutletForPos('TCM')).toBe('TCM');
  });

  it('uses product category first, but spots drinks in meal-period categories', () => {
    expect(inferFoodBev('Beverage/Bar', 'Blue Mansion Special', '[SS] (TBM) Singapore Sling')).toBe('Beverage');
    expect(inferFoodBev('Desserts (Mangga)', 'SWEETS', '(M) Teh Tarik Creme Brulee')).toBe('Food');
    expect(inferFoodBev('Food/Breakfast', 'Breakfast', "B- Orange Juice B'fast")).toBe('Beverage');
    expect(inferFoodBev('Food/Breakfast', 'Breakfast', 'C1 - Americano B`fast')).toBe('Beverage');
    expect(inferFoodBev('Food/Breakfast', 'Breakfast', 'Toast with Kaya')).toBe('Food');
    expect(inferFoodBev('', '', '(B) LongYu Gran Reserva')).toBe('Beverage');
  });
});

describe('normalizeRows', () => {
  const rows = [
    row({ 'Order Ref': 'Mangga (Day) - 000001', Date: '2026-01-05 12:10:00', 'Point of Sale': 'Mangga (Day)', 'Receipt Number': '261-5-000001', Status: 'Posted', Guests: 3, Total: 116, 'Order Lines/Product': '(M) Nasi Lemak', 'Order Lines/Quantity': 2, 'Order Lines/Tax Excl.': 76, 'Order Lines/Tax Incl.': 88.16, 'Order Lines/Product/Point of Sale Category': 'BIG PLATES', 'Order Lines/Product/Product Category': 'Food (Mangga)' }),
    row({ 'Order Lines/Product': '(M) Coke', 'Order Lines/Quantity': 2, 'Order Lines/Tax Excl.': 20, 'Order Lines/Tax Incl.': 23.2, 'Order Lines/Product/Point of Sale Category': 'Soft Drinks', 'Order Lines/Product/Product Category': 'Beverage - Non Alcohol (Mangga)' }),
    // continuation row with only an extra POS category -> ignored
    row({ 'Order Lines/Product/Point of Sale Category': 'Qing - All Day Dining' }),
    // same order ref number later in the year (sequence restarted) -> separate order
    row({ 'Order Ref': 'Mangga (Day) - 000001', Date: '2026-08-12 18:00:00', 'Point of Sale': 'Mangga (Day)', 'Receipt Number': '264-5-000001', Status: 'Posted', Guests: 2, Total: 50, 'Order Lines/Product': '(M) Nasi Lemak', 'Order Lines/Quantity': 1, 'Order Lines/Tax Excl.': 38, 'Order Lines/Tax Incl.': 44.08, 'Order Lines/Product/Point of Sale Category': 'BIG PLATES', 'Order Lines/Product/Product Category': 'Food (Mangga)' }),
    // cancelled -> excluded
    row({ 'Order Ref': '/', Date: '2026-08-12 19:00:00', 'Point of Sale': 'The Bar', 'Receipt Number': '266-3-000010', Status: 'Cancelled', Guests: 4, Total: 99, 'Order Lines/Product': '(TBM) Tiger Beer', 'Order Lines/Quantity': 3, 'Order Lines/Tax Excl.': 66, 'Order Lines/Tax Incl.': 76.56 }),
    // unpaid draft -> excluded
    row({ 'Order Ref': '/', Date: '2026-08-12 19:30:00', 'Point of Sale': 'The Bar', 'Receipt Number': '266-3-000011', Status: 'New', Guests: 1, Total: 20, 'Order Lines/Product': '(TBM) Tiger Beer', 'Order Lines/Quantity': 1, 'Order Lines/Tax Excl.': 22, 'Order Lines/Tax Incl.': 25.52 }),
    // refund -> negative sales, not a transaction
    row({ 'Order Ref': 'The Bar - 000009 REFUND', Date: '2026-08-12 20:00:00', 'Point of Sale': 'The Bar', 'Receipt Number': '266-3-000012', Status: 'Paid', Guests: 1, Total: -20.88, 'Order Lines/Product': '(TBM) Apple Juice', 'Order Lines/Quantity': -1, 'Order Lines/Tax Excl.': -18, 'Order Lines/Tax Incl.': -20.88, 'Order Lines/Product/Point of Sale Category': 'Fresh Juice', 'Order Lines/Product/Product Category': 'Beverage/Bar' }),
  ];

  const res = normalizeRows(rows, 'test.xlsx');

  it('keeps valid orders and reports excluded ones', () => {
    expect(res.summary.ordersKept).toBe(3);
    expect(res.summary.cancelledOrders).toBe(1);
    expect(res.summary.cancelledSales).toBe(66);
    expect(res.summary.draftOrders).toBe(1);
    expect(res.lines).toHaveLength(4);
    expect(res.orders[2].isRefund).toBe(true);
  });

  it('counts transactions per receipt and guests once per order', () => {
    const ds = mergeIntoDataset(null, res);
    const r = computeReport(ds, ALL, defaultSettings(), 'outlet');
    expect(r.kpi.total.sales).toBeCloseTo(76 + 20 + 38 - 18);
    expect(r.kpi.total.tx).toBe(2);
    expect(r.kpi.total.guests).toBe(5);
    expect(avgTicket(r.kpi.s['Mangga'])).toBeCloseTo(134 / 2);
    expect(r.hourly[12].total.tx).toBe(1);
    expect(r.monthly.get('2026-08')!.total.sales).toBeCloseTo(20);
    expect(r.foodBev.Beverage.sales).toBeCloseTo(2);
  });

  it('skips orders already loaded and backfills missing categories', () => {
    let ds = mergeIntoDataset(null, res);
    ds = mergeIntoDataset(ds, normalizeRows(rows, 'copy.xlsx'));
    expect(ds.orders).toHaveLength(3);
    expect(ds.files[1].duplicateOrders).toBe(3);

    const noCat = normalizeRows(
      [
        {
          'Order Ref': 'POS/2025/1',
          Date: '2025-03-01 13:00:00',
          'Point of Sale': 'Mangga (Day)',
          'Receipt Number': 'Order 1',
          Status: 'Posted',
          Guests: 1,
          'Order Lines/Product': '"(M) Nasi Lemak',
          'Order Lines/Quantity': 1,
          'Order Lines/Tax Excl.': 35,
          'Order Lines/Tax Incl.': 37.1,
        },
      ],
      '2025.csv',
    );
    ds = mergeIntoDataset(ds, noCat);
    const line = ds.lines[ds.lines.length - 1];
    expect(line.product).toBe('(M) Nasi Lemak');
    expect(line.category).toBe('BIG PLATES');
    expect(line.categoryInferred).toBe(true);
    expect(line.foodBev).toBe('Food');
  });

  it('filters by outlet, date and type', () => {
    const ds = mergeIntoDataset(null, res);
    const r = computeReport(ds, { ...ALL, pos: ['The Bar'] }, defaultSettings(), 'outlet');
    expect(r.kpi.total.tx).toBe(0);
    expect(r.kpi.total.sales).toBeCloseTo(-18);
    const r2 = computeReport(ds, { ...ALL, dateFrom: '2026-08-01', foodBev: 'Food' }, defaultSettings(), 'outlet');
    expect(r2.kpi.total.sales).toBeCloseTo(38);
  });
});
