import type { FoodBevType } from '../types/pos';

/** Badge colours for each sales type (Tailwind classes). */
export const TYPE_BADGE: Record<FoodBevType, string> = {
  Food: 'bg-emerald-50 text-emerald-700',
  Beverage: 'bg-indigo-50 text-indigo-700',
  'Set Menu': 'bg-amber-50 text-amber-800',
  'Afternoon Tea': 'bg-pink-50 text-pink-700',
  'Refreshment Package': 'bg-cyan-50 text-cyan-800',
  'Open Item': 'bg-violet-50 text-violet-700',
  'Open Beverage': 'bg-sky-50 text-sky-700',
  Discount: 'bg-rose-50 text-rose-700',
  Other: 'bg-slate-100 text-slate-600',
};

export const TYPE_DESCRIPTION: Record<FoodBevType, string> = {
  Food: 'Dishes, desserts, pastries and snacks',
  Beverage: 'Drinks: coffee, tea, juices, soft drinks, beer, wine, spirits and cocktails',
  'Set Menu': 'Buffets, course menus, lunch sets, sharing menus and set breakfasts',
  'Afternoon Tea': 'Afternoon tea sets, Tea for Two and extra afternoon tea',
  'Refreshment Package': 'Refreshment packages',
  'Open Item': 'Open-price items keyed in by staff',
  'Open Beverage': 'Open-price drinks keyed in by staff',
  Discount: 'Discount lines',
  Other: 'Tours, corkage, delivery fees, tips and anything not recognised',
};
