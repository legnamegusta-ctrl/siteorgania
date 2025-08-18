const DB_NAME = 'organia-crm';
const DB_VERSION = 1;

export const STORE_NAMES = {
  LEADS: 'organia:crm:leads',
  VISITAS: 'organia:crm:visitas',
  PROPOSTAS: 'organia:crm:propostas',
  CLIENTES: 'organia:crm:clientes'
};

let db;
let useLocalStorage = false;

async function initDB() {
  if (db || useLocalStorage) return db;
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        Object.values(STORE_NAMES).forEach((name) => {
          if (!database.objectStoreNames.contains(name)) {
            database.createObjectStore(name, { keyPath: 'id' });
          }
        });
      };
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };
      request.onerror = () => {
        console.warn('IndexedDB indisponível, usando localStorage');
        useLocalStorage = true;
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB não suportado, usando localStorage');
      useLocalStorage = true;
      resolve(null);
    }
  });
}

function lsGet(store) {
  const data = localStorage.getItem(store);
  return data ? JSON.parse(data) : [];
}

function lsSet(store, arr) {
  localStorage.setItem(store, JSON.stringify(arr));
}

export async function getAll(store) {
  await initDB();
  if (useLocalStorage) {
    return lsGet(store);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getById(store, id) {
  await initDB();
  if (useLocalStorage) {
    return lsGet(store).find((r) => r.id === id) || null;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function insert(store, data) {
  data.syncFlag = data.syncFlag || 'local-only';
  await initDB();
  if (useLocalStorage) {
    const arr = lsGet(store);
    arr.push(data);
    lsSet(store, arr);
    return data;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).add(data);
    tx.oncomplete = () => resolve(data);
    tx.onerror = () => reject(tx.error);
  });
}

export async function update(store, id, data) {
  data.syncFlag = data.syncFlag || 'local-only';
  await initDB();
  if (useLocalStorage) {
    const arr = lsGet(store);
    const idx = arr.findIndex((r) => r.id === id);
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], ...data };
      lsSet(store, arr);
      return arr[idx];
    }
    return null;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const storeObj = tx.objectStore(store);
    const getReq = storeObj.get(id);
    getReq.onsuccess = () => {
      const existing = { ...getReq.result, ...data };
      storeObj.put(existing);
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function upsert(store, data) {
  const existing = await getById(store, data.id);
  if (existing) {
    return update(store, data.id, data);
  }
  return insert(store, data);
}

// util synchronous wrappers for localStorage usage
export function getAllSync(store) {
  return lsGet(store);
}

export function getByIdSync(store, id) {
  return lsGet(store).find((r) => r.id === id) || null;
}

export function clearStore(store) {
  if (useLocalStorage) {
    lsSet(store, []);
  } else if (db) {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
  }
}
