export type FoodBev = 'Food' | 'Beverage' | 'Other';

/** One POS receipt (order header row in the Odoo export). */
export interface PosOrder {
  /** Unique key used to de-duplicate orders across files. */
  key: string;
  orderRef: string;
  receipt: string;
  /** Raw "Point of Sale" value, e.g. "Mangga (Day)". */
  pos: string;
  dateKey: string; // YYYY-MM-DD
  hour: number; // 0-23
  dow: number; // 0 = Sunday … 6 = Saturday
  guests: number;
  isRefund: boolean;
}

/** One order line (item sold). */
export interface PosLine {
  /** Index into ParsedDataset.orders */
  o: number;
  product: string;
  /** POS category (or product category when no POS category exists). */
  category: string;
  /** Odoo internal Product Category, e.g. "Beverage/Bar". */
  productCategory: string;
  /** True when the category was copied from the same product in another file. */
  categoryInferred: boolean;
  foodBev: FoodBev;
  qty: number;
  salesExcl: number;
  salesIncl: number;
}

export interface FileSummary {
  fileName: string;
  rowsRead: number;
  ordersKept: number;
  linesKept: number;
  cancelledOrders: number;
  cancelledSales: number;
  draftOrders: number;
  draftSales: number;
  duplicateOrders: number;
  posNames: string[];
  dateFrom: string | null;
  dateTo: string | null;
  hasCategories: boolean;
  hasProductCategory: boolean;
  hasGuests: boolean;
  hasReceipt: boolean;
  detectedColumns: Record<string, string | undefined>;
  warnings: string[];
}

export interface ParsedDataset {
  orders: PosOrder[];
  lines: PosLine[];
  files: FileSummary[];
  inferredCategoryLines: number;
}

export type SalesBasis = 'excl' | 'incl';
export type SeriesBy = 'outlet' | 'pos';

export interface Filters {
  /** Selected raw POS names; empty = all. */
  pos: string[];
  dateFrom: string;
  dateTo: string;
  foodBev: 'All' | FoodBev;
  search: string;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  kind: 'holiday' | 'festive';
}

export interface Settings {
  /** Raw POS name -> outlet group name. */
  posOutlet: Record<string, string>;
  /** Category -> Food/Beverage/Other override. */
  categoryFoodBev: Record<string, FoodBev>;
  holidays: Holiday[];
  salesBasis: SalesBasis;
}
