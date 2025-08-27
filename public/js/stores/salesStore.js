import { db } from '../config/firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const KEY = 'agro.sales';

export function getSales() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addSale(sale) {
  const sales = getSales();
  const now = new Date().toISOString();
  const newSale = {
    id: Date.now().toString(36),
    createdAt: now,
    ...sale,
  };
  sales.push(newSale);
  localStorage.setItem(KEY, JSON.stringify(sales));
  setDoc(doc(db, 'sales', newSale.id), newSale).catch((err) =>
    console.error('Erro ao salvar venda no Firestore', err)
  );
  return newSale;
}

export function getSalesByClient(clientId) {
  return getSales().filter((s) => s.clientId === clientId);
}
