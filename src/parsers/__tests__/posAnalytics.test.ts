import { describe, expect, it } from 'vitest';
import { normalizeRows, parseDateTime, parseNumber } from '../csvXlsxParser';
import { parseSalesDetailsTextLines } from '../pdfSalesDetailsParser';
import { aggregateDataset, aggregateItemTrend } from '../../utils/aggregator';
import { createDefaultMappingRules } from '../../utils/defaultMappings';
import type { FilterState } from '../../types/pos';

const DEFAULT_FILTERS: FilterState = {
  outletFilter: 'compare',
  dateFrom: '',
  dateTo: '',
  foodBevFilter: 'All',
  searchQuery: '',
};

describe('csvXlsxParser', () => {
  it('parses RM currency strings and dates cleanly', () => {
    expect(parseNumber('RM 1,234.50')).toBeCloseTo(1234.5);
    expect(parseNumber('(45.00)')).toBeCloseTo(-45);

    const dt = parseDateTime('14/06/2024 07:30:00 PM');
    expect(dt).toEqual({
      iso: '2024-06-14 19:30:00',
      dateKey: '2024-06-14',
      hour: 19,
    });
  });

  it('carries forward grouped Odoo order headers and deduplicates guests & transactions', () => {
    const rules = createDefaultMappingRules();
    const rows = [
      {
        'Order Ref': 'POS/001',
        'Order Date': '2024-06-14 12:15:00',
        'Session / Point of Sale': 'Mangga (Day)',
        Guests: 3,
        'Lines / Product': 'Nyonya Laksa',
        'Lines / Product / POS Product Category': 'Mains',
        'Lines / Quantity': 2,
        'Lines / Subtotal': 68,
      },
      {
        // Grouped second line of POS/001 with blank order columns
        'Order Ref': '',
        'Order Date': '',
        'Session / Point of Sale': '',
        Guests: '',
        'Lines / Product': 'Flat White',
        'Lines / Product / POS Product Category': 'Coffee & Tea',
        'Lines / Quantity': 3,
        'Lines / Subtotal': 45,
      },
      {
        'Order Ref': 'POS/002',
        'Order Date': '2024-06-14 21:10:00',
        'Session / Point of Sale': 'The Bar',
        Guests: 2,
        'Lines / Product': 'Indigo Gin & Tonic (TBM)',
        'Lines / Product / POS Product Category': 'Cocktails',
        'Lines / Quantity': 2,
        'Lines / Subtotal': 92,
      },
    ];

    const dataset = normalizeRows(rows, 'test.xlsx', rules);
    expect(dataset.lines).toHaveLength(3);
    expect(dataset.capabilities.hasHourly).toBe(true);
    expect(dataset.capabilities.hasGuests).toBe(true);
    expect(dataset.capabilities.hasOrderLevelTransactions).toBe(true);

    const report = aggregateDataset(dataset, DEFAULT_FILTERS);
    expect(report.kpis.mangga.sales).toBeCloseTo(113);
    expect(report.kpis.mangga.transactions).toBe(1);
    expect(report.kpis.mangga.guests).toBe(3);

    expect(report.kpis.indigo.sales).toBeCloseTo(92);
    expect(report.kpis.indigo.transactions).toBe(1);
    expect(report.kpis.indigo.guests).toBe(2);

    expect(report.kpis.total.transactions).toBe(2);
    expect(report.kpis.total.guests).toBe(5);
    expect(report.topFood[0].product).toBe('Nyonya Laksa');
    expect(report.topBeverage[0].product).toBe('Flat White');
    expect(report.salesByHour[12].manggaSales).toBeCloseTo(113);
    expect(report.salesByHour[21].indigoSales).toBeCloseTo(92);
  });
});

describe('pdfSalesDetailsParser', () => {
  it('parses Sales, Payments, and Session Control lines from Odoo Sales Details PDF', () => {
    const rules = createDefaultMappingRules();
    const lines = [
      'Sales Details',
      '01/01/2024 12:00:45 AM - 31/12/2024 11:45:24 PM',
      'Sales',
      'Cocktails',
      'Blue Pea Martini (TBM) 120.0 RM5,760.00',
      'Breakfast',
      'Big Breakfast (M) 50.0 RM2,100.00',
      'Taxes on sales',
      'SST 6% RM471.60',
      'Payments',
      'Credit Card RM7,860.00',
      'Session Control',
      'Number of transactions: 85',
      'Credit Card POS/202406/14/00001 RM5,000.00 RM5,000.00 RM0.00',
    ];

    const dataset = parseSalesDetailsTextLines(lines, 'Sales_Details.pdf', rules);
    expect(dataset.lines).toHaveLength(2);
    expect(dataset.lines[0].outlet).toBe('Indigo Bar');
    expect(dataset.lines[0].foodBev).toBe('Beverage');
    expect(dataset.lines[1].outlet).toBe('Mangga');
    expect(dataset.lines[1].foodBev).toBe('Food');
    expect(dataset.capabilities.totalPdfTransactions).toBe(85);
    expect(dataset.pdfDailySessions).toHaveLength(1);
    expect(dataset.pdfDailySessions[0].dateKey).toBe('2024-06-14');
  });
});

describe('aggregator date & item search + trend', () => {
  it('filters by particular date and item search, and computes item daily/hourly trend', () => {
    const rules = createDefaultMappingRules();
    const rows = [
      {
        'Order Ref': 'POS/001',
        'Order Date': '2024-06-14 10:15:00',
        'Session / Point of Sale': 'Mangga (Day)',
        Guests: 2,
        'Lines / Product': 'Nyonya Laksa',
        'Lines / Product / POS Product Category': 'Mains',
        'Lines / Quantity': 2,
        'Lines / Subtotal': 68,
      },
      {
        'Order Ref': 'POS/002',
        'Order Date': '2024-06-15 14:20:00',
        'Session / Point of Sale': 'Mangga (Day)',
        Guests: 1,
        'Lines / Product': 'Nyonya Laksa',
        'Lines / Product / POS Product Category': 'Mains',
        'Lines / Quantity': 1,
        'Lines / Subtotal': 34,
      },
      {
        'Order Ref': 'POS/003',
        'Order Date': '2024-06-15 19:00:00',
        'Session / Point of Sale': 'Mangga (Dinner)',
        Guests: 2,
        'Lines / Product': 'Flat White',
        'Lines / Product / POS Product Category': 'Coffee & Tea',
        'Lines / Quantity': 2,
        'Lines / Subtotal': 30,
      },
    ];

    const dataset = normalizeRows(rows, 'multi_day.xlsx', rules);

    // Full report exposes availableDates and allProducts
    const fullReport = aggregateDataset(dataset, DEFAULT_FILTERS);
    expect(fullReport.availableDates).toEqual(['2024-06-14', '2024-06-15']);
    expect(fullReport.allProducts).toEqual(['Flat White', 'Nyonya Laksa']);

    // Single date filter
    const singleDayReport = aggregateDataset(dataset, {
      ...DEFAULT_FILTERS,
      dateFrom: '2024-06-15',
      dateTo: '2024-06-15',
    });
    expect(singleDayReport.kpis.total.sales).toBeCloseTo(64);
    expect(singleDayReport.salesByItem).toHaveLength(2);

    // Item search filter
    const itemSearchReport = aggregateDataset(dataset, {
      ...DEFAULT_FILTERS,
      searchQuery: 'laksa',
    });
    expect(itemSearchReport.salesByItem).toHaveLength(1);
    expect(itemSearchReport.salesByItem[0].totalQty).toBe(3);

    // Item trend across days & hours
    const trend = aggregateItemTrend(dataset, DEFAULT_FILTERS, 'Nyonya Laksa');
    expect(trend.totalQty).toBe(3);
    expect(trend.totalSales).toBeCloseTo(102);
    expect(trend.daily).toEqual([
      { dateKey: '2024-06-14', qty: 2, sales: 68 },
      { dateKey: '2024-06-15', qty: 1, sales: 34 },
    ]);
    expect(trend.hourly[10].qty).toBe(2);
    expect(trend.hourly[14].qty).toBe(1);
  });
});
