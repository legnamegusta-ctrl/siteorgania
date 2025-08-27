import { db, auth } from '../config/firebase.js';
import {
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const KEY = 'agro.clients';

export function getClients() {
  const userId = auth.currentUser?.uid;
  const clients = JSON.parse(localStorage.getItem(KEY) || '[]');
  return userId ? clients.filter((c) => c.agronomistId === userId) : clients;
}

export function addClient(client) {
  const userId = auth.currentUser?.uid || null;
  const clients = getClients();
  const now = new Date().toISOString();
  const newClient = {
    id: Date.now().toString(36),
    createdAt: now,
    updatedAt: now,
    agronomistId: userId,
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
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn('syncClientsFromFirestore: usuário não autenticado');
      return [];
    }
    const q = query(collection(db, 'clients'), where('agronomistId', '==', userId));
    const snap = await getDocs(q);
    const clients = snap.docs.map((d) => d.data());
    localStorage.setItem(KEY, JSON.stringify(clients));
    return clients;
  } catch (err) {
    console.error('Erro ao buscar clientes do Firestore', err);
    return [];
  }
}
