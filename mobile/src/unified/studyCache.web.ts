const DB_NAME = "companion-study";
const STORE = "snapshots";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Study cache is blocked"));
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export const read = (key: string): Promise<string | undefined> => transaction("readonly", store => store.get(key));
export const write = (key: string, value: string) => transaction("readwrite", store => store.put(value, key));
export const remove = (key: string) => transaction("readwrite", store => store.delete(key));
export const removeAccount = (prefix: string) =>
  transaction("readwrite", store => store.delete(IDBKeyRange.bound(prefix + "/", prefix + "/\uffff")));
