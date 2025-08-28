import { db, auth } from '../config/firebase.js';
import { doc, setDoc } from '/vendor/firebase/9.6.0/firebase-firestore.js';

const KEY = 'agro.sales';

export function getSales() {
  const userId = (window.getCurrentUid && window.getCurrentUid()) || auth.currentUser?.uid;
  const all = JSON.parse(localStorage.getItem(KEY) || '[]');
  return userId ? all.filter((s) => s.agronomistId === userId) : all;
}

export function addSale(sale) {
  // read raw list to avoid double-filter when saving
  const all = JSON.parse(localStorage.getItem(KEY) || '[]');
  const now = new Date().toISOString();
  const newSale = {
    id: Date.now().toString(36),
    createdAt: now,
    ...sale,
    agronomistId: (window.getCurrentUid && window.getCurrentUid()) || auth.currentUser?.uid || null,
    synced: navigator.onLine,
  };
  all.push(newSale);
  localStorage.setItem(KEY, JSON.stringify(all));
  if (navigator.onLine) {
    setDoc(doc(db, 'sales', newSale.id), newSale)
      .then(() => {
        const list = JSON.parse(localStorage.getItem(KEY) || '[]');
        const idx = list.findIndex((s) => s.id === newSale.id);
        if (idx >= 0) {
          list[idx].synced = true;
          localStorage.setItem(KEY, JSON.stringify(list));
        }
      })
      .catch((err) => console.error('Erro ao salvar venda no Firestore', err));
  }
  return newSale;
}

export function getSalesByClient(clientId) {
  return getSales().filter((s) => s.clientId === clientId);
}

