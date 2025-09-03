import { db, auth } from '../config/firebase.js';
import { nowBrasiliaISO } from '../lib/date-utils.js';
import {
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
} from '/vendor/firebase/9.6.0/firebase-firestore.js';

const KEY = 'agro.clients';

function readLocal() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

function saveLocal(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getClients() {
  const userId = (window.getCurrentUid && window.getCurrentUid()) || auth.currentUser?.uid;
  const clients = readLocal();
  return userId ? clients.filter((c) => c.agronomistId === userId) : clients;
}

export function addClient(client) {
  const userId = (window.getCurrentUid && window.getCurrentUid()) || auth.currentUser?.uid || null;
  const all = readLocal();
  const now = nowBrasiliaISO();
  const newClient = {
    id: `local-${Date.now().toString(36)}`,
    createdAt: now,
    updatedAt: now,
    ...client,
    agronomistId: userId,
    synced: navigator.onLine,
  };
  all.push(newClient);
  saveLocal(all);

  if (navigator.onLine) {
    setDoc(doc(db, 'clients', newClient.id), newClient)
      .then(() => {
        const list = readLocal();
        const idx = list.findIndex((c) => c.id === newClient.id);
        if (idx >= 0) {
          list[idx].synced = true;
          saveLocal(list);
        }
      })
      .catch((err) => console.error('Erro ao salvar cliente no Firestore', err));
  }
  return newClient;
}

export async function syncClientsFromFirestore() {
  const userId = (window.getCurrentUid && window.getCurrentUid()) || auth.currentUser?.uid;
  if (!userId) {
    console.warn('syncClientsFromFirestore: usuário não autenticado');
    return [];
  }

  // Envia locais pendentes
  if (navigator.onLine) {
    const localAll = readLocal();
    for (const c of localAll.filter((x) => x.agronomistId === userId && !x.synced)) {
      try {
        if (!c.id) {
          console.warn('syncClientsFromFirestore: cliente sem id ignorado', c);
          continue;
        }
        await setDoc(doc(db, 'clients', c.id), c, { merge: true });
        c.synced = true;
      } catch (err) {
        console.error('Erro ao sincronizar cliente', err);
      }
    }
    saveLocal(localAll);
  }

  // Baixa remotos do agrônomo
  try {
    const snap = await getDocs(query(collection(db, 'clients'), where('agronomistId', '==', userId)));
    const remote = snap.docs.map((d) => ({ id: d.id, synced: true, ...d.data() }));
    // Mescla com locais
    const map = new Map(remote.map((c) => [c.id, c]));
    for (const c of readLocal()) {
      if (!map.has(c.id)) map.set(c.id, c);
    }
    const merged = Array.from(map.values());
    saveLocal(merged);
    return merged.filter((c) => c.agronomistId === userId);
  } catch (err) {
    console.error('Erro ao buscar clientes do Firestore', err);
    return getClients();
  }
}

