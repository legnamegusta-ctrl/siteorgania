const DB_NAME = 'agrodb';
const DB_VERSION = 1;
let dbPromise = null;

export function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('visits')) {
        db.createObjectStore('visits', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function withStore(storeName, mode, callback) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = callback(store);
    tx.oncomplete = () => resolve(result && result.result ? result.result : result);
    tx.onerror = () => reject(tx.error || (result && result.error));
  });
}

export function list(storeName) {
  return withStore(storeName, 'readonly', (store) => store.getAll());
}

export function get(storeName, key) {
  return withStore(storeName, 'readonly', (store) => store.get(key));
}

export function put(storeName, value) {
  return withStore(storeName, 'readwrite', (store) => store.put(value));
}

export function del(storeName, key) {
  return withStore(storeName, 'readwrite', (store) => store.delete(key));
}
