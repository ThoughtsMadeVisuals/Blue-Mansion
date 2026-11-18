import type { ParsedDataset } from '../types/pos';

const DB_NAME = 'bluemansion_pos_analytics';
const DB_VERSION = 1;
const STORE_NAME = 'datasets';
const ACTIVE_KEY = 'active_dataset';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// v2 stores one entry per uploaded file so files can be removed individually.
const FILES_KEY = 'active_files_v2';

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest | void
): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const req = fn(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function saveFilesToStorage(files: ParsedDataset[]): Promise<void> {
  try {
    await withStore('readwrite', (store) => {
      store.put(files, FILES_KEY);
      // Data saved by older versions is in a different format; drop it.
      store.delete(ACTIVE_KEY);
    });
  } catch {
    // Ignore storage errors (e.g. private browsing restrictions)
  }
}

export async function loadFilesFromStorage(): Promise<ParsedDataset[]> {
  try {
    const files = await withStore<ParsedDataset[] | undefined>('readonly', (store) =>
      store.get(FILES_KEY)
    );
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
  }
}

export async function clearAllStoredData(): Promise<void> {
  try {
    await withStore('readwrite', (store) => {
      store.clear();
    });
  } catch {
    // Ignore storage errors
  }
}
