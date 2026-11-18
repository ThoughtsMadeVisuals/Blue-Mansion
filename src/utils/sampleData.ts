import type { MappingRules, ParsedDataset } from '../types/pos';
import { normalizeRows } from '../parsers/csvXlsxParser';

export function buildSampleDataset(rules: MappingRules): ParsedDataset {
  const sampleRows: Record<string, unknown>[] = [];
  const manggaFood = [
    ['Nyonya Laksa (M)', 'Mains', 34],
    ['Blue Mansion Breakfast', 'Breakfast', 42],
    ['Hainanese Chicken Chop', 'Mains', 38],
    ['Truffle Fries', 'Bar Bites', 22],
    ['Pandan Kaya Toast', 'Breakfast', 16],
    ['Gula Melaka Sago', 'Desserts', 18],
  ] as const;

  const manggaBev = [
    ['Flat White', 'Coffee & Tea', 15],
    ['Iced Latte', 'Coffee & Tea', 17],
    ['Fresh Watermelon Juice', 'Juices', 16],
    ['Asahi Draft Pint', 'Beer & Draught', 28],
  ] as const;

  const indigoBev = [
    ['Indigo Gin & Tonic (TBM)', 'Cocktails', 46],
    ['Blue Pea Martini (TBM)', 'Cocktails', 48],
    ['House Shiraz Glass', 'House Wines', 38],
    ['Asahi Draft Pint', 'Beer & Draught', 30],
    ['Macallan 12Y Double Cask', 'Whisky & Spirits', 68],
    ['Sparkling Water', 'Waters & Soft Drinks', 18],
  ] as const;

  const indigoFood = [
    ['Crispy Calamari (TBM)', 'Bar Bites', 28],
    ['Wagyu Beef Sliders (TBM)', 'Bar Bites', 44],
    ['Artisanal Cheese Platter', 'Sharing Platters', 65],
  ] as const;

  // Other Blue Mansion outlets: [Odoo POS name, opening hours, orders/day, menu]
  const otherOutlets: {
    config: string;
    hours: number[];
    orders: number;
    menu: readonly (readonly [string, string, number])[];
  }[] = [
    {
      config: 'Indigo at the Blue Mansion (Lunch)',
      hours: [12, 13, 14],
      orders: 8,
      menu: [
        ['Nyonya Set Lunch', 'Lunch Mains', 58],
        ['Perut Ikan', 'Lunch Mains', 42],
        ['Iced Lemon Tea', 'Soft Drinks', 12],
      ],
    },
    {
      config: 'Indigo at the Blue Mansion (Dinner)',
      hours: [19, 20, 21],
      orders: 10,
      menu: [
        ['Indigo Tasting Menu', 'Dinner Mains', 168],
        ['Kapitan Chicken Curry', 'Dinner Mains', 62],
        ['House Red Wine Glass', 'House Wines', 40],
      ],
    },
    {
      config: 'Gift Shop',
      hours: [10, 11, 15, 16],
      orders: 6,
      menu: [
        ['Blue Mansion Postcard Set', 'Souvenirs', 18],
        ['Peranakan Tile Coaster', 'Souvenirs', 35],
        ['Nutmeg Balm', 'Souvenirs', 22],
      ],
    },
    {
      config: 'TCM',
      hours: [10, 11, 14, 15],
      orders: 4,
      menu: [
        ['Herbal Consultation', 'TCM Services', 80],
        ['Ginseng Tea', 'Herbal Tea', 25],
      ],
    },
    {
      config: 'QING',
      hours: [18, 19, 20],
      orders: 7,
      menu: [
        ['Qing Signature Dim Sum', 'Small Plates', 32],
        ['Chrysanthemum Tea', 'Tea', 14],
      ],
    },
  ];

  let orderCounter = 1001;
  // Generate 14 days of realistic sample data
  for (let day = 1; day <= 14; day++) {
    const dayStr = String(day).padStart(2, '0');
    const isWeekend = day % 7 === 6 || day % 7 === 0;
    const manggaOrders = isWeekend ? 14 : 9;
    const indigoOrders = isWeekend ? 16 : 10;

    for (let o = 0; o < manggaOrders; o++) {
      const isDinner = o >= Math.floor(manggaOrders * 0.6);
      const hour = isDinner ? 18 + (o % 4) : 8 + (o % 9);
      const config = isDinner ? 'Mangga (Dinner)' : 'Mangga (Day)';
      const guests = 1 + (o % 4);
      const ref = `POS/202406/${dayStr}/${orderCounter++}`;
      const dateStr = `2024-06-${dayStr} ${String(hour).padStart(2, '0')}:${String((o * 17) % 60).padStart(2, '0')}:00`;

      const foodPick = manggaFood[(day + o) % manggaFood.length];
      const bevPick = manggaBev[(day + o) % manggaBev.length];

      sampleRows.push({
        'Order Ref': ref,
        'Order Date': dateStr,
        'Session / Point of Sale': config,
        Guests: guests,
        'Lines / Product': foodPick[0],
        'Lines / Product / POS Product Category': foodPick[1],
        'Lines / Quantity': 1 + (o % 2),
        'Lines / Subtotal': foodPick[2] * (1 + (o % 2)),
      });
      sampleRows.push({
        'Order Ref': '',
        'Order Date': '',
        'Session / Point of Sale': '',
        Guests: '',
        'Lines / Product': bevPick[0],
        'Lines / Product / POS Product Category': bevPick[1],
        'Lines / Quantity': 1 + (o % 2),
        'Lines / Subtotal': bevPick[2] * (1 + (o % 2)),
      });
    }

    for (let o = 0; o < indigoOrders; o++) {
      const hour = (17 + (o % 7)) % 24;
      const guests = 1 + (o % 5);
      const ref = `POS/202406/${dayStr}/${orderCounter++}`;
      const dateStr = `2024-06-${dayStr} ${String(hour).padStart(2, '0')}:${String((o * 13) % 60).padStart(2, '0')}:00`;

      const bevPick = indigoBev[(day + o) % indigoBev.length];
      const qty = 1 + (o % 3);
      sampleRows.push({
        'Order Ref': ref,
        'Order Date': dateStr,
        'Session / Point of Sale': 'The Bar',
        Guests: guests,
        'Lines / Product': bevPick[0],
        'Lines / Product / POS Product Category': bevPick[1],
        'Lines / Quantity': qty,
        'Lines / Subtotal': bevPick[2] * qty,
      });

      if (o % 2 === 0) {
        const foodPick = indigoFood[(day + o) % indigoFood.length];
        sampleRows.push({
          'Order Ref': '',
          'Order Date': '',
          'Session / Point of Sale': '',
          Guests: '',
          'Lines / Product': foodPick[0],
          'Lines / Product / POS Product Category': foodPick[1],
          'Lines / Quantity': 1,
          'Lines / Subtotal': foodPick[2],
        });
      }
    }
  }

  for (let day = 1; day <= 14; day++) {
    const dayStr = String(day).padStart(2, '0');
    const isWeekend = day % 7 === 6 || day % 7 === 0;
    for (const outlet of otherOutlets) {
      const orders = outlet.orders + (isWeekend ? 3 : 0);
      for (let o = 0; o < orders; o++) {
        const hour = outlet.hours[o % outlet.hours.length];
        const pick = outlet.menu[(day + o) % outlet.menu.length];
        const qty = 1 + (o % 2);
        sampleRows.push({
          'Order Ref': `POS/202406/${dayStr}/${orderCounter++}`,
          'Order Date': `2024-06-${dayStr} ${String(hour).padStart(2, '0')}:${String((o * 11) % 60).padStart(2, '0')}:00`,
          'Session / Point of Sale': outlet.config,
          Guests: 1 + (o % 3),
          'Lines / Product': pick[0],
          'Lines / Product / POS Product Category': pick[1],
          'Lines / Quantity': qty,
          'Lines / Subtotal': pick[2] * qty,
        });
      }
    }
  }

  return normalizeRows(sampleRows, 'Sample_Odoo_POS_Demo.xlsx', rules);
}
