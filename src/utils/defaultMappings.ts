import type { FoodBevType, MappingRules, Outlet, SubOutlet } from '../types/pos';

const STORAGE_KEY = 'bluemansion_pos_mapping_rules_v1';

export const DEFAULT_CONFIG_OUTLET: Record<string, Outlet> = {
  'mangga (day)': 'Mangga',
  'mangga (dinner)': 'Mangga',
  'mangga': 'Mangga',
  'the bar': 'Indigo Bar',
  'indigo bar': 'Indigo Bar',
  'indigo': 'Indigo Bar',
};

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
];

const FOOD_KEYWORDS = [
  'food',
  'breakfast',
  'lunch',
  'dinner',
  'all day dining',
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

export function inferSubOutlet(rawConfig: string): SubOutlet {
  const norm = rawConfig.trim().toLowerCase();
  if (norm.includes('mangga') && norm.includes('day')) return 'Mangga (Day)';
  if (norm.includes('mangga') && norm.includes('dinner')) return 'Mangga (Dinner)';
  if (norm.includes('the bar') || norm.includes('indigo')) return 'The Bar';
  return 'Unknown';
}

export function inferOutletFromConfig(
  rawConfig: string,
  rules: MappingRules
): Outlet {
  const norm = rawConfig.trim().toLowerCase();
  if (!norm) return 'Unassigned';

  for (const [key, outlet] of Object.entries(rules.configOutlet)) {
    if (norm === key.toLowerCase() || norm.includes(key.toLowerCase())) {
      return outlet;
    }
  }
  if (norm.includes('mangga')) return 'Mangga';
  if (norm.includes('bar') || norm.includes('indigo')) return 'Indigo Bar';
  return 'Unassigned';
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
  if (
    combined.includes('(tbm)') ||
    combined.includes('indigo bar') ||
    combined.includes('the bar')
  ) {
    return 'Indigo Bar';
  }
  if (
    combined.includes('(m)') ||
    combined.includes('(m-alm)') ||
    combined.includes('(mangga)') ||
    combined.includes('mangga')
  ) {
    return 'Mangga';
  }
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

  const catNorm = category.toLowerCase();
  const prodNorm = product.toLowerCase();

  for (const kw of FOOD_KEYWORDS) {
    if (matchesKeyword(catNorm, kw)) return 'Food';
  }
  for (const kw of BEVERAGE_KEYWORDS) {
    if (matchesKeyword(catNorm, kw)) return 'Beverage';
  }
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
    configOutlet: { ...DEFAULT_CONFIG_OUTLET },
  };
}

export function loadMappingRules(): MappingRules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultMappingRules();
    const parsed = JSON.parse(raw) as Partial<MappingRules>;
    return {
      categoryFoodBev: parsed.categoryFoodBev ?? {},
      categoryOutlet: parsed.categoryOutlet ?? {},
      itemOutlet: parsed.itemOutlet ?? {},
      configOutlet: {
        ...DEFAULT_CONFIG_OUTLET,
        ...(parsed.configOutlet ?? {}),
      },
    };
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
