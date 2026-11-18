import type { ParsedDataset, Settings } from '../types';
import { DEFAULT_HOLIDAYS } from './holidays';

const DB_NAME = 'bluemansion_pos_analytics_v2';
const STORE = 'datasets';
const KEY = 'active';
const SETTINGS_KEY = 'bluemansion_pos_settings_v2';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T | null> {
  try {
    const db = await openDb();
    const out = await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? ((req.result as T) ?? null) : null);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return out;
  } catch {
    return null;
  }
}

export const saveDataset = (ds: ParsedDataset) => run<void>('readwrite', (s) => s.put(ds, KEY));
export const loadDataset = () => run<ParsedDataset>('readonly', (s) => s.get(KEY));
export const clearDataset = () => run<void>('readwrite', (s) => s.delete(KEY));

export function defaultSettings(): Settings {
  return { posOutlet: {}, categoryFoodBev: {}, holidays: DEFAULT_HOLIDAYS, salesBasis: 'excl' };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const p = JSON.parse(raw) as Partial<Settings>;
    const d = defaultSettings();
    return {
      posOutlet: p.posOutlet ?? d.posOutlet,
      categoryFoodBev: p.categoryFoodBev ?? d.categoryFoodBev,
      holidays: Array.isArray(p.holidays) ? p.holidays : d.holidays,
      salesBasis: p.salesBasis === 'incl' ? 'incl' : 'excl',
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
