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

/**
 * Outlets that are recognised but left out of this report entirely. They are
 * still matched by name so their sales are dropped, rather than falling into
 * "Unassigned" or being mistaken for Indigo Bar.
 */
export const EXCLUDED_OUTLETS: ReadonlySet<Outlet> = new Set<Outlet>([
  'Indigo (Lunch)',
  'Indigo (Dinner)',
  'Gift Shop',
  'TCM',
  'QING',
]);

export function isExcludedOutlet(outlet: Outlet): boolean {
  return EXCLUDED_OUTLETS.has(outlet);
}

/** Outlets that appear in the report. */
export const REPORTED_OUTLETS: Outlet[] = OUTLETS.filter((o) => !EXCLUDED_OUTLETS.has(o));

export const ASSIGNABLE_OUTLETS: Outlet[] = OUTLETS.filter((o) => o !== 'Unassigned');

/** Warning text listing how many lines were dropped per excluded outlet. */
export function describeExcluded(counts: Map<Outlet, number>): string | null {
  const parts = OUTLETS.filter((o) => (counts.get(o) ?? 0) > 0).map(
    (o) => `${OUTLET_INFO[o].name} (${counts.get(o)!.toLocaleString('en-US')} lines)`
  );
  if (parts.length === 0) return null;
  return `Not included in this report: ${parts.join(', ')}.`;
}

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

// ---------------------------------------------------------------------------
// Item type rules. Checked in order; the first match wins.
// ---------------------------------------------------------------------------

/** Types the user asked to keep separate from Food and Beverage. */
const SPECIAL_TYPE_RULES: [RegExp, FoodBevType][] = [
  [/\bdiscount\b|\[disc/i, 'Discount'],
  [/\bopen beverages?\b/i, 'Open Beverage'],
  [/^open item\b/i, 'Open Item'],
  [/refreshment package/i, 'Refreshment Package'],
  [/afternoon tea|\btea for two\b|\btea set\b/i, 'Afternoon Tea'],
  [/\bbuffet\b|\bcourse menu\b|\b\d[- ]course\b|\bbrunch menu\b|\bsharing menu\b|\blunch set\b|\bset (?:lunch|dinner|menu)\b|\b(?:lunch|dinner) menu\b|\bbreakfast (?:adult|child)\b|\[extrabreakfast/i, 'Set Menu'],
  [/\btours?\b|corkage|delivery fee|\btips?\b|service charge/i, 'Other'],
  // Confirmed as drinks although their names/codes look like desserts
  [/lychee & earl grey|virgin colada|taromisu|cinnamon spice/i, 'Beverage'],
];

/** Words that make an item food even if it also contains a drink word
 *  (e.g. "Coconut Pancake", "Teh Tarik Creme Brulee", "Mushroom Cappucino"). */
const STRONG_FOOD_RE =
  /\b(?:pancakes?|cakes?|cheesecake|shortcake|brul[eé]e|tarts?|gateaux?|toast|waffles?|mousse|mochi|tiramisu|matchamisu|scones?|croissants?|entremet|pudding|eaton mess|eton mess|muesli|porridge|sorbet|gula melaka|mushroom cappucino|drizzle|sweet and sour|rice)\b/i;

/** Menu codes used in the POS item names. */
const FOOD_CODE_RE = /^(?:\[(?:SW|SP|BP|AD?\d|ADD|PT|BIGB)[^\]]*\]|(?:A\d|F|KIDS|LLA)\s*-\s)/i;
const BEVERAGE_CODE_RE =
  /^(?:\((?:G|MG|MB|B|HHG|HHB|MHHG|MHHB|TBM-HH)\)|\[(?:BV|C\d|T\d|J\d|KM|KS|MMB|COM|SS|HS|MA|KFLG)[^\]]*\]|(?:W|HH|C\d?)\s*-\s)/i;

const EXTRA_BEVERAGE_WORDS = [
  // cocktails & mocktails
  'mojito', 'negroni', 'margarita', 'martini', 'sling', 'spritz', 'sour', 'mule', 'collins',
  'daiquiri', 'caipirinha', 'caipiroska', 'cosmopolitan', 'old fashioned', 'colada', 'russian',
  'toddy', 'shirley temple', 'melon ball', 'kwai feh', 'pineapple express', 'punch',
  // spirits, liqueurs, beer
  'shot', 'bombay sapphire', 'botanist', 'tanqueray', 'macallan', 'glenfiddich', 'glenlivet',
  'singleton', 'suntory', 'kakubin', 'jameson', 'hendrick', 'midori', 'bailey', "bailey's",
  'kahlua', 'amaretto', 'cointreau', 'grand marnier', 'malibu', 'aperol', 'tiger',
  'kronenbourg', '1664',
  // wine
  'chardonnay', 'shiraz', 'malbec', 'melbec', 'cabernet', 'carbernet', 'cab', 'merlot', 'pinot',
  'riesling', 'sauvignon', 'moscato', 'rose', 'rosé', 'chianti', 'rioja', 'reserva', 'reserve',
  'valdobbiadene', 'cava', 'bubbles', 'viognier', 'torrontes', 'gewurztraminer',
  'gewurstraminner', 'carmenere', "nero d'avola", 'amarone', 'brunello', 'chablis', 'bourgogne',
  'rhone', 'chateauneuf', 'condrieu', 'pomerol', 'emillion', 'emilion', 'montrachet', 'verdejo',
  'marsanne', 'corvina', 'grenache', 'mataro', 'gavi', 'docg', 'doc', 'aoc', 'igp', 'bianco',
  'rouge', 'blanc', 'noir', 'glass', 'gls', 'bottle', 'angove', 'hereford', 'changyu',
  'chang yu', 'longyu', 'tannes', 'chalk hill', 'catena', 'alamos', 'saint clair', 'trimbach',
  'guigal', 'donnafugata', 'faustino', 'bichot', 'miraval', 'marlborough', 'grant burge',
  'arrogant frog', 'chateau',
  // soft drinks, coffee & tea
  'coke', 'sprite', 'ginger ale', 'tonic', 'limeade', 'cooler', 'sugarcane', 'lemongrass',
  'frappe', 'milkshake', 'still', 'acqua', 'acquapura', 'coconut', 'honey lemon', 'calamansi',
  'turmeric', 'americano', 'flat white', 'long black', 'mocha', 'cappucino', 'chamomile',
  'peppermint', 'earl grey', 'sencha', 'hot chocolate', 'iced chocolate', 'chocolate iced',
  'oat milk', 'soy milk', 'milk', 'extra shot', 'mix fruits', 'lime',
];

const EXTRA_FOOD_WORDS = [
  'nasi', 'satay', 'burger', 'cheeseburger', 'fries', 'laksa', 'wing', 'spring roll', 'penne',
  'spaghetti', 'capellini', 'conchiglie', 'carbonara', 'aglio', 'bolognese', 'pomodoro',
  'cauliflower', 'cucur', 'fritter', 'samosa', 'pakora', 'prawn', 'drumette', 'patatas',
  'mackerel', 'chicken', 'duck', 'beef', 'lamb', 'wagyu', 'snapper', 'halibut', 'fish', 'chip',
  'stroganoff', 'egg', 'omelette', 'omellete', 'paratha', 'acai', 'pain au', 'twist', 'mussel',
  'clam', 'calamari', 'albondigas', 'boquerones', 'emping', 'tomatoes', 'karaage', 'otah',
  'gado', 'rendang', 'benedict', 'pie tee', 'ossobuco', 'meatball', 'vegetable', 'gratin',
  'baguette', 'brookies', 'chocolate', 'yee sang', 'cheesy', 'onion', 'pistachio', 'slice',
  'ondeh', 'onde', 'lekor', 'tempe', 'tempeh', 'ulam', 'pate', 'wrap', 'kapitan', 'mushroom',
  'ketupat', 'salmon', 'tofu', 'millet', 'puff', 'choux', 'opera', 'decadent', 'kacang', 'ham',
  'shortrib', 'chop', 'mosaic', 'cheek', 'pulut', 'nutella',
];

function cleanItemName(product: string): string {
  return product.replace(/^[\s'"`]+/, '').trim();
}

function anyWord(text: string, words: readonly string[]): boolean {
  return words.some((w) => matchesKeyword(text, w));
}

export function inferFoodBev(
  category: string,
  product: string,
  rules: MappingRules
): FoodBevType {
  const name = cleanItemName(product);

  const itemOverride = rules.itemFoodBev?.[product];
  if (itemOverride) return itemOverride;
  if (rules.categoryFoodBev[category]) {
    return rules.categoryFoodBev[category];
  }

  for (const [re, type] of SPECIAL_TYPE_RULES) {
    if (re.test(name)) return type;
  }

  if (STRONG_FOOD_RE.test(name)) return 'Food';
  if (FOOD_CODE_RE.test(name)) return 'Food';
  if (BEVERAGE_CODE_RE.test(name)) return 'Beverage';

  // Check from most specific category segment (leaf) to parent segments
  const segments = category
    .split('/')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((s) => s !== 'uncategorized')
    .reverse();

  for (const seg of segments) {
    for (const kw of BEVERAGE_KEYWORDS) {
      if (matchesKeyword(seg, kw)) return 'Beverage';
    }
    for (const kw of FOOD_KEYWORDS) {
      if (matchesKeyword(seg, kw)) return 'Food';
    }
  }

  const prodNorm = name.toLowerCase();
  if (anyWord(prodNorm, BEVERAGE_KEYWORDS) || anyWord(prodNorm, EXTRA_BEVERAGE_WORDS)) {
    return 'Beverage';
  }
  if (anyWord(prodNorm, FOOD_KEYWORDS) || anyWord(prodNorm, EXTRA_FOOD_WORDS)) {
    return 'Food';
  }

  return 'Other';
}

export function createDefaultMappingRules(): MappingRules {
  return {
    categoryFoodBev: {},
    itemFoodBev: {},
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
        itemFoodBev: parsed.itemFoodBev ?? {},
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

export function clearMappingRules(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
