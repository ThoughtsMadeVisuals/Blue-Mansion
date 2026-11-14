export type Outlet = 'Mangga' | 'Indigo Bar' | 'Unassigned';

export type SubOutlet = 'Mangga (Day)' | 'Mangga (Dinner)' | 'The Bar' | 'Unknown';

export type FoodBevType = 'Food' | 'Beverage' | 'Other';

export type OutletFilter = 'compare' | 'Mangga' | 'Indigo Bar' | 'Mangga (Day)' | 'Mangga (Dinner)';

export interface PosOrderLine {
  id: string;
  orderRef: string;
  orderDate: string | null;
  dateKey: string | null; // YYYY-MM-DD
  hour: number | null; // 0-23
  rawConfig: string;
  subOutlet: SubOutlet;
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

export interface ParsedDataset {
  lines: PosOrderLine[];
  pdfPayments: PdfPaymentSummary[];
  pdfDailySessions: PdfDailySessionRow[];
  capabilities: DatasetCapabilities;
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
