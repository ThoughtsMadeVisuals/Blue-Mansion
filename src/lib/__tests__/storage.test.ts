import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings } from '../storage';
import { DEFAULT_HOLIDAYS } from '../holidays';

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => (store[k] = v),
  };
});

describe('settings', () => {
  it('refreshes built-in holidays from older saved settings but keeps added ones', () => {
    store['bluemansion_pos_settings_v2'] = JSON.stringify({
      holidays: [
        { date: '2026-03-21', name: 'old name', kind: 'holiday' },
        { date: '2026-09-25', name: 'Mid-Autumn Festival', kind: 'festive' },
      ],
    });
    const s = loadSettings();
    expect(s.holidays.find((h) => h.date === '2026-03-20')).toBeTruthy();
    expect(s.holidays.find((h) => h.date === '2026-09-25')?.name).toBe('Mid-Autumn Festival');
    expect(s.holidays.length).toBe(DEFAULT_HOLIDAYS.length + 1);
  });
});
