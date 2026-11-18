import type { FoodBevType, MappingRules, Outlet } from '../types/pos';
import { OUTLETS } from '../types/pos';

// v2: outlet list was expanded; v1 config overrides relied on loose substring
// matches that merged outlets, so they are intentionally not carried over.
const STORAGE_KEY = 'bluemansion_pos_mapping_rules_v2';
const LEGACY_STORAGE_KEY = 'bluemansion_pos_mapping_rules_v1';

export interface OutletInfo {
  id: Outlet;
  /** Full display name */
  name: string;
  color: string;
}

export const OUTLET_INFO: Record<Outlet, OutletInfo> = {
  'Mangga (Day)': { id: 'Mangga (Day)', name: 'Mangga (Day)', color: '#10b981' },
  'Mangga (Dinner)': { id: 'Mangga (Dinner)', name: 'Mangga (Dinner)', color: '#047857' },
  Mangga: { id: 'Mangga', name: 'Mangga (Day/Dinner unknown)', color: '#6ee7b7' },
  'Indigo Bar': { id: 'Indigo Bar', name: 'Indigo Bar (The Bar)', color: '#4f46e5' },
  'Indigo (Lunch)': {
    id: 'Indigo (Lunch)',
    name: 'Indigo at The Blue Mansion (Lunch)',
    color: '#0ea5e9',
  },
  'Indigo (Dinner)': {
    id: 'Indigo (Dinner)',
    name: 'Indigo at The Blue Mansion (Dinner)',
    color: '#1e3a8a',
  },
  'Gift Shop': { id: 'Gift Shop', name: 'Gift Shop', color: '#f59e0b' },
  TCM: { id: 'TCM', name: 'TCM', color: '#e11d48' },
  QING: { id: 'QING', name: 'QING', color: '#9333ea' },
  Unassigned: { id: 'Unassigned', name: 'Unassigned', color: '#94a3b8' },
};

export const ASSIGNABLE_OUTLETS: Outlet[] = OUTLETS.filter((o) => o !== 'Unassigned');

export function isOutlet(value: unknown): value is Outlet {
  return typeof value === 'string' && (OUTLETS as readonly string[]).includes(value);
}

const BEVERAGE_KEYWORDS = [
  'wine',
  'beer',
  'draught',
  'cocktail',
  'mocktail',
  'spirit',
  'whisky',
  'whiskey',
  'gin',
  'vodka',
  'rum',
  'tequila',
  'brandy',
  'cognac',
  'liqueur',
  'coffee',
  'tea',
  'juice',
  'water',
  'soft drink',
  'soda',
  'beverage',
  'drink',
  'champagne',
  'prosecco',
  'sparkling',
  'asahi',
  'carlsberg',
  'heineken',
  'guinness',
  'cider',
  'sake',
  'smoothie',
  'shake',
  'latte',
  'espresso',
  'cappuccino',
  'barista',
  'highball',
  'refresher',
  'energiser',
  'enegiser',
  'boocha',
  'kombucha',
];

const FOOD_KEYWORDS = [
  'food',
  'breakfast',
  'lunch',
  'dinner',
  'all day dining',
  'big plate',
  'small plate',
  'plate',
  'sweet',
  'starter',
  'appetizer',
  'salad',
  'soup',
  'main',
  'grill',
  'pasta',
  'pizza',
  'burger',
  'sandwich',
  'dessert',
  'pastry',
  'cake',
  'snack',
  'bar bite',
  'bites',
  'side',
  'noodle',
  'rice',
  'seafood',
  'meat',
  'steak',
  'local',
  'nyonya',
  'asian',
  'western',
  'sharing',
  'platter',
  'tapas',
  'tea set',
  'high tea',
];

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

const DAY_RE = /\b(day|lunch|breakfast|brunch|morning)\b/;
const DINNER_RE = /\b(dinner|night|evening)\b/;

/**
 * Recognise an outlet from free text (an Odoo POS config/session name, or a
 * category/product name). Order matters: specific outlets are checked before
 * generic words so that e.g. "Indigo at the Blue Mansion (Lunch)" is never
 * swallowed by the bar.
 */
export function matchOutletName(text: string): Outlet {
  const norm = text.trim().toLowerCase();
  if (!norm) return 'Unassigned';

  if (has(norm, /gift/)) return 'Gift Shop';
  if (has(norm, /\btcm\b/)) return 'TCM';
  if (has(norm, /\bqing\b/)) return 'QING';

  if (has(norm, /mangga/)) {
    if (has(norm, DINNER_RE)) return 'Mangga (Dinner)';
    if (has(norm, DAY_RE)) return 'Mangga (Day)';
    return 'Mangga';
  }

  if (has(norm, /\bthe bar\b|indigo bar|\bbar\b/)) return 'Indigo Bar';

  if (has(norm, /indigo|blue mansion/)) {
    if (has(norm, DINNER_RE)) return 'Indigo (Dinner)';
    if (has(norm, /\blunch\b/)) return 'Indigo (Lunch)';
  }

  return 'Unassigned';
}

export function inferOutletFromConfig(
  rawConfig: string,
  rules: MappingRules
): Outlet {
  const norm = rawConfig.trim().toLowerCase();
  if (!norm) return 'Unassigned';

  // User overrides are exact matches on the config name
  const override = rules.configOutlet[norm];
  if (override) return override;

  return matchOutletName(norm);
}

export function inferOutletFromHeuristics(
  category: string,
  product: string,
  rules: MappingRules
): Outlet {
  if (rules.itemOutlet[product]) return rules.itemOutlet[product];
  if (rules.categoryOutlet[category]) return rules.categoryOutlet[category];

  const combined = `${category} ${product}`.toLowerCase();
  // Observed Odoo POS naming conventions in Straits Indigo SDN BHD
  if (combined.includes('(tbm)')) return 'Indigo Bar';
  if (
    combined.includes('(m)') ||
    combined.includes('(m-alm)') ||
    combined.includes('(mangga)')
  ) {
    return 'Mangga';
  }
  if (combined.includes('(tcm)')) return 'TCM';
  if (combined.includes('(qing)')) return 'QING';
  if (combined.includes('gift shop')) return 'Gift Shop';
  if (combined.includes('indigo bar') || combined.includes('the bar')) return 'Indigo Bar';
  if (combined.includes('mangga')) return 'Mangga';
  return 'Unassigned';
}

function matchesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'i').test(text);
}

export function inferFoodBev(
  category: string,
  product: string,
  rules: MappingRules
): FoodBevType {
  if (rules.categoryFoodBev[category]) {
    return rules.categoryFoodBev[category];
  }

  // Check from most specific category segment (leaf) to parent segments
  const segments = category
    .split('/')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .reverse();

  for (const seg of segments) {
    for (const kw of BEVERAGE_KEYWORDS) {
      if (matchesKeyword(seg, kw)) return 'Beverage';
    }
    for (const kw of FOOD_KEYWORDS) {
      if (matchesKeyword(seg, kw)) return 'Food';
    }
  }

  const prodNorm = product.toLowerCase();
  for (const kw of FOOD_KEYWORDS) {
    if (matchesKeyword(prodNorm, kw)) return 'Food';
  }
  for (const kw of BEVERAGE_KEYWORDS) {
    if (matchesKeyword(prodNorm, kw)) return 'Beverage';
  }

  return 'Other';
}

export function createDefaultMappingRules(): MappingRules {
  return {
    categoryFoodBev: {},
    categoryOutlet: {},
    itemOutlet: {},
    configOutlet: {},
  };
}

function cleanOutletRecord(record: unknown): Record<string, Outlet> {
  const out: Record<string, Outlet> = {};
  if (!record || typeof record !== 'object') return out;
  for (const [k, v] of Object.entries(record as Record<string, unknown>)) {
    if (isOutlet(v) && v !== 'Unassigned') out[k] = v;
  }
  return out;
}

export function loadMappingRules(): MappingRules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MappingRules>;
      return {
        categoryFoodBev: parsed.categoryFoodBev ?? {},
        categoryOutlet: cleanOutletRecord(parsed.categoryOutlet),
        itemOutlet: cleanOutletRecord(parsed.itemOutlet),
        configOutlet: cleanOutletRecord(parsed.configOutlet),
      };
    }
    // Carry over Food/Beverage and category/item choices from v1, but not
    // its config rules (those merged Indigo restaurant into the bar).
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Partial<MappingRules>;
      return {
        categoryFoodBev: parsed.categoryFoodBev ?? {},
        categoryOutlet: cleanOutletRecord(parsed.categoryOutlet),
        itemOutlet: cleanOutletRecord(parsed.itemOutlet),
        configOutlet: {},
      };
    }
    return createDefaultMappingRules();
  } catch {
    return createDefaultMappingRules();
  }
}

export function saveMappingRules(rules: MappingRules): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // Ignore storage quota errors
  }
}
