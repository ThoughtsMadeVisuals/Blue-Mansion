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

/** 'valid' orders count as sales; cancelled/draft are shown separately only. */
export type OrderStatus = 'valid' | 'cancelled' | 'draft';

export interface PosOrderLine {
  id: string;
  orderRef: string;
  orderDate: string | null;
  dateKey: string | null; // YYYY-MM-DD
  hour: number | null; // 0-23
  rawConfig: string;
  outlet: Outlet;
  /** Id of the uploaded file this line came from */
  sourceFile: string;
  /** File-independent order identity, used to detect duplicate uploads */
  orderKey: string;
  /** Receipt number / order ref as shown in Odoo, for display */
  receipt: string;
  orderStatus: OrderStatus;
  /** Order is an Odoo refund (ref contains "REFUND") */
  isRefund: boolean;
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

export interface ExcludedOutletCount {
  outlet: Outlet;
  lines: number;
  sales: number;
}

export interface UploadedFileSummary {
  /** Unique id (file name + upload time) */
  fileId: string;
  fileName: string;
  /** SHA-256 of the file bytes, when available */
  contentHash?: string;
  uploadedAt?: string;
  rowsRead?: number;
  lineCount: number;
  /** Which spreadsheet column each figure was read from */
  columns?: Partial<Record<'orderRef' | 'receipt' | 'date' | 'outlet' | 'status' | 'guests' | 'product' | 'category' | 'qty' | 'sales', string>>;
  excluded?: ExcludedOutletCount[];
  /** Receipts whose line signs were corrected to match the order Total */
  signFixes?: { receipts: number; lines: number };
  /** Orders skipped because they were already loaded from another file */
  duplicateOrdersSkipped?: number;
  duplicateOf?: string[];
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
  /** Selected outlets; empty = all outlets */
  outlets: Outlet[];
  dateFrom: string;
  dateTo: string;
  foodBevFilter: 'All' | FoodBevType;
  searchQuery: string;
}
