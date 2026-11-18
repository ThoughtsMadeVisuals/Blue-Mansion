import { describe, expect, it } from 'vitest';
import { createDefaultMappingRules, inferFoodBev } from '../defaultMappings';

const rules = createDefaultMappingRules();
const type = (name: string) => inferFoodBev('Uncategorized', name, rules);

describe('item types (decisions confirmed by the user)', () => {
  it.each([
    // Set menus & packages
    ['Buffet @ Mangga Cafe', 'Set Menu'],
    ['4 Course Menu Adult', 'Set Menu'],
    ['3 Course Menu Kids', 'Set Menu'],
    ['Qing Brunch Menu', 'Set Menu'],
    ['Lunch Set RM38', 'Set Menu'],
    ['Sharing Menu (RM130/pax)', 'Set Menu'],
    ['Event - Bar 3 Course Vegan Lunch 2026', 'Set Menu'],
    ['[EXTRABREAKFAST(A)] Breakfast ADULT', 'Set Menu'],
    ['Refreshment Package', 'Refreshment Package'],
    ['Courtyard Afternoon Tea Set', 'Afternoon Tea'],
    ['(M) Tea for Two (Afternoon Tea)', 'Afternoon Tea'],
    ['Additional Afternoon Tea (1 Pax)', 'Afternoon Tea'],
    // Open items, discounts, other
    ['Open Item', 'Open Item'],
    ['Open Item - Soft Boiled Eggs', 'Open Item'],
    ['(TBM) Open Beverages (Non Alcohol)', 'Open Beverage'],
    ['(TBM) Open Beverage (Alcohol)', 'Open Beverage'],
    ['[DISC3] Discount', 'Discount'],
    ['Tour Closure', 'Other'],
    ['Ala Carte - Bar Corkage 2026', 'Other'],
    ['Delivery Fee', 'Other'],
    ['[TIPS] Tips', 'Other'],
    // Confirmed drinks
    ['Coconut', 'Beverage'],
    ['[J4] Watermelon', 'Beverage'],
    ['Mix Fruits', 'Beverage'],
    ['D - Lychee & Earl Grey', 'Beverage'],
    ['[SW3] Virgin Colada "Coconut"', 'Beverage'],
    ['Taromisu Coffee', 'Beverage'],
    ['Event - Bar Pre Dinner Cocktails 2026', 'Beverage'],
  ])('%s -> %s', (name, expected) => {
    expect(type(name)).toBe(expected);
  });
});

describe('item types (automatic rules)', () => {
  it.each([
    ['[KFLG] (TBM) Kwai Feh Lemongrass', 'Beverage'],
    ['(MG) Angove Chardonnay (Glass)', 'Beverage'],
    ['[C2C] (M) Americano (Iced)', 'Beverage'],
    ['(TBM) Negroni', 'Beverage'],
    ['Chocolate Milkshake', 'Beverage'],
    ['(M) Nasi Lemak Ayam Berempah', 'Food'],
    ['(M) Coconut Pancake', 'Food'],
    ['(M) Teh Tarik Creme Brulee', 'Food'],
    ['KAHLUA TIRAMISU', 'Food'],
    ['Coconut Rice', 'Food'],
    ['Lemon Drizzle', 'Food'],
    ['Sweet and Sour Hericium Mushroom (v)', 'Food'],
    ['Mushroom Cappucino', 'Food'],
    ['[SW12] Mango Coconut Glk A Melaka Baked Cheesecake', 'Food'],
  ])('%s -> %s', (name, expected) => {
    expect(type(name)).toBe(expected);
  });

  it('a type chosen for one item overrides the rules', () => {
    const custom = { ...createDefaultMappingRules(), itemFoodBev: { Coconut: 'Food' as const } };
    expect(inferFoodBev('Uncategorized', 'Coconut', custom)).toBe('Food');
    expect(inferFoodBev('Uncategorized', '(M) Coconut', custom)).toBe('Beverage');
  });
});
