import { db } from '../config/firebase.js';
import {
  doc,
  setDoc,
  collection,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const KEY = 'agro.clients';

export function getClients() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addClient(client) {
  const clients = getClients();
  const now = new Date().toISOString();
  const newClient = {
    id: Date.now().toString(36),
    createdAt: now,
    updatedAt: now,
    ...client
  };
  clients.push(newClient);
  localStorage.setItem(KEY, JSON.stringify(clients));
  // Persistir no Firestore
  setDoc(doc(db, 'clients', newClient.id), newClient).catch((err) =>
    console.error('Erro ao salvar cliente no Firestore', err)
  );
  return newClient;
}

export async function syncClientsFromFirestore() {
  try {
    const snap = await getDocs(collection(db, 'clients'));
    const clients = snap.docs.map((d) => d.data());
    localStorage.setItem(KEY, JSON.stringify(clients));
    return clients;
  } catch (err) {
    console.error('Erro ao buscar clientes do Firestore', err);
    return [];
  }
}
