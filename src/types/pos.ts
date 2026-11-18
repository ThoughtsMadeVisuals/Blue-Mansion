/**
 * Every POS entity is reported separately — sales are never merged across
 * outlets. 'Mangga' is only used when a Mangga line cannot be identified as
 * Day or Dinner (e.g. PDF summaries); 'Unassigned' is anything unrecognised.
 */
export const OUTLETS = [
  'Mangga (Day)',
  'Mangga (Dinner)',
  'Mangga',
  'Indigo Bar',
  'Indigo (Lunch)',
  'Indigo (Dinner)',
  'Gift Shop',
  'TCM',
  'QING',
  'Unassigned',
] as const;

export type Outlet = (typeof OUTLETS)[number];

export type FoodBevType = 'Food' | 'Beverage' | 'Other';

export type OutletFilter = 'compare' | Outlet;

export interface PosOrderLine {
  id: string;
  orderRef: string;
  orderDate: string | null;
  dateKey: string | null; // YYYY-MM-DD
  hour: number | null; // 0-23
  rawConfig: string;
  outlet: Outlet;
  guests: number | null;
  product: string;
  category: string;
  foodBev: FoodBevType;
  qty: number;
  subtotal: number;
  discountPct?: number;
  paymentMethod?: string;
  sourceType: 'csv_xlsx' | 'pdf_summary';
}

export interface PdfPaymentSummary {
  method: string;
  amount: number;
}

export interface PdfDailySessionRow {
  dateKey: string; // YYYY-MM-DD
  paymentMethod: string;
  sessionRef: string;
  expected: number;
  counted: number;
  difference: number;
}

export interface DatasetCapabilities {
  hasHourly: boolean;
  hasDailyItems: boolean;
  hasDailyPayments: boolean;
  hasGuests: boolean;
  hasOrderLevelTransactions: boolean;
  totalPdfTransactions?: number;
  dateRangeLabel?: string;
  sourceFiles: string[];
}

export interface UploadedFileSummary {
  fileName: string;
  lineCount: number;
  outlets: string[];
  dateFrom: string | null;
  dateTo: string | null;
  hasHourly: boolean;
  hasGuests: boolean;
}

export interface ParsedDataset {
  lines: PosOrderLine[];
  pdfPayments: PdfPaymentSummary[];
  pdfDailySessions: PdfDailySessionRow[];
  capabilities: DatasetCapabilities;
  fileSummaries?: UploadedFileSummary[];
  warnings: string[];
}

export interface MappingRules {
  categoryFoodBev: Record<string, FoodBevType>;
  categoryOutlet: Record<string, Outlet>;
  itemOutlet: Record<string, Outlet>;
  configOutlet: Record<string, Outlet>;
}

export interface FilterState {
  outletFilter: OutletFilter;
  dateFrom: string;
  dateTo: string;
  foodBevFilter: 'All' | FoodBevType;
  searchQuery: string;
}
