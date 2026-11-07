'use client';
// The site's one IndexedDB database ("zipyzee"): Text editor documents, Make with Zee documents and recent photos. Bump VERSION and
// add the store in `upgrade` when a new kind of data needs a home.
const NAME = 'zipyzee';
const VERSION = 3;
export type StoreName = 'textdocs' | 'zeedocs' | 'recentphotos';

let opening: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  return (opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ['textdocs', 'zeedocs', 'recentphotos'] as StoreName[]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  }));
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/** Writes and deletes in one transaction. */
export async function write<T>(store: StoreName, put: T[], del: string[] = []): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    put.forEach((x) => s.put(x));
    del.forEach((id) => s.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
