import type { FoodBev } from '../types';

/** Remove stray quote characters and extra whitespace Odoo sometimes leaves in names. */
export function cleanName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/^[\s'"`]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Default grouping of raw Odoo "Point of Sale" names into outlets.
 * "Mangga (Day)" and "Mangga (Dinner)" both belong to Mangga, the two Indigo
 * restaurant services belong to "Indigo Restaurant", and The Bar stays on its own.
 */
export function defaultOutletForPos(pos: string): string {
  const n = pos.trim().toLowerCase();
  if (!n) return 'Unknown';
  if (n.includes('mangga')) return 'Mangga';
  if (n === 'the bar' || n.includes('indigo bar')) return 'The Bar';
  if (n.includes('indigo')) return 'Indigo Restaurant';
  if (n.includes('gift')) return 'Gift Shop';
  return pos.trim();
}

const BEVERAGE_KEYWORDS = [
  'beverage', 'beverages', 'drink', 'wine', 'beer', 'draught', 'cocktail', 'mocktail',
  'spirit', 'whisky', 'whiskey', 'single malt', 'malt', 'gin', 'vodka', 'rum', 'tequila',
  'brandy', 'cognac', 'liqueur', 'liquor', 'bourbon', 'scotch', 'digestive', 'aperitif',
  'coffee', 'tea', 'juice', 'water', 'soft drink', 'soda', 'champagne', 'prosecco',
  'sparkling', 'asahi', 'carlsberg', 'heineken', 'guinness', 'tiger', 'sapporo', 'cider',
  'sake', 'smoothie', 'shake', 'latte', 'espresso', 'cappuccino', 'americano', 'mocha',
  'barista', 'highball', 'refresher', 'energiser', 'enegiser', 'boocha', 'kombucha',
  'kefir', 'frappe', 'shot', 'gls', 'glass', 'bottle', 'coke', 'sprite', 'tonic',
  'yakult', 'milo', 'chocolate drink', 'pinot', 'merlot', 'shiraz', 'cabernet', 'cab',
  'sauvignon', 'chardonnay', 'riesling', 'malbec', 'rose', 'prosecco', 'mojito',
  'martini', 'negroni', 'sling', 'spritz', 'lemongrass', 'coconut', 'teh', 'kopi',
  'reserva', 'gran reserva', 'brut', 'vintage', 'syrah', 'tempranillo', 'sangria', 'wine pairing',
];

const FOOD_KEYWORDS = [
  'food', 'breakfast', 'lunch', 'dinner', 'all day dining', 'big plate', 'small plate',
  'plate', 'sweet', 'starter', 'appetizer', 'appetiser', 'salad', 'soup', 'main', 'grill',
  'pasta', 'pizza', 'burger', 'sandwich', 'dessert', 'pastry', 'pastries', 'cake',
  'snack', 'bar bite', 'bites', 'side', 'noodle', 'rice', 'seafood', 'meat', 'steak',
  'nyonya', 'asian', 'western', 'sharing', 'platter', 'tapas', 'tea set', 'high tea',
  'menu', 'course', 'kids', 'fries', 'wings', 'satay', 'laksa', 'nasi', 'mee', 'char',
  'chicken', 'beef', 'lamb', 'pork', 'fish', 'prawn', 'lobster', 'scallop', 'duck',
  'waffle', 'toast', 'egg', 'bread', 'croissant', 'brulee', 'ice cream', 'sorbet',
  'pudding', 'tart', 'cookie', 'spring roll', 'curry', 'rendang', 'kuih', 'bahulu',
  'yule log', 'canape', 'foie gras', 'halibut', 'sirloin', 'wagyu', 'capellini', 'bisque',
  'gateau', 'cuttlefish', 'snapper', 'bamboo shoot', 'buffet', 'bowl', 'boquerones', 'tofu',
  'vegetable', 'mushroom', 'cheese', 'oyster', 'crab', 'squid', 'grouper', 'cod', 'salmon',
];

const FOOD_ONLY = /\b(cake|toast|egg|bread|croissant|waffle|noodle|rice|tea set|high tea)\b/i;

function hasKeyword(text: string, kw: string): boolean {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escaped}(s|es)?([^a-z]|$)`, 'i').test(text);
}

function fromSegments(segments: string[], bevFirst: boolean): FoodBev | null {
  for (const seg of segments) {
    const s = seg.toLowerCase();
    const isBev = BEVERAGE_KEYWORDS.some((k) => hasKeyword(s, k));
    const isFood = FOOD_KEYWORDS.some((k) => hasKeyword(s, k));
    if (isBev && !isFood) return 'Beverage';
    if (isFood && !isBev) return 'Food';
    if (isBev && isFood) return bevFirst ? 'Beverage' : 'Food';
  }
  return null;
}

/**
 * Decide Food / Beverage.
 * 1. Odoo "Product Category" (most reliable: "Beverage/Bar", "Food (Mangga)", "Desserts (Mangga)")
 * 2. POS category, most specific segment first
 * 3. Product name
 */
export function inferFoodBev(productCategory: string, category: string, product: string): FoodBev {
  if (productCategory) {
    const segs = productCategory.split('/').map((x) => x.trim().toLowerCase());
    const top = segs[0];
    if (/bev|drink|wine|liquor/.test(top)) return 'Beverage';
    if (/dessert|pastr|bakery|cake/.test(top)) return 'Food';
    if (/food/.test(top)) {
      // "Food/Breakfast", "Food/Dinner" are meal periods that also hold drinks
      // (e.g. "B- Orange Juice B'fast"), so check the item name for a drink first.
      const generic = segs.length > 1 && /breakfast|lunch|dinner|delivery|bar/.test(segs.slice(1).join(' '));
      if (generic && fromSegments([product], true) === 'Beverage' && !FOOD_ONLY.test(product)) return 'Beverage';
      return 'Food';
    }
  }
  if (category && category !== 'Uncategorized') {
    const segs = category.split('/').map((s) => s.trim()).filter(Boolean).reverse();
    const r = fromSegments(segs, true);
    if (r) return r;
  }
  if (product) {
    // Odoo wine-list prefixes: (B) bottle, (G) glass, (MB) Mangga bottle
    if (/^(\[[^\]]*\]\s*)?\((b|g|gls|mb|mg)\)\s/i.test(product)) return 'Beverage';
    const r = fromSegments([product], false);
    if (r) return r;
  }
  return 'Other';
}

/** Normalised key used to match the same product across files. */
export function productKey(product: string): string {
  return product.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
