import { db, auth } from '../config/firebase.js';
import {
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
} from '/vendor/firebase/9.6.0/firebase-firestore.js';

const KEY = 'agro.leads';

function readLocal() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

function saveLocal(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getLeads() {
  const userId = auth.currentUser?.uid;
  const leads = readLocal();
  return userId ? leads.filter((l) => l.agronomistId === userId) : leads;
}

export function addLead(lead) {
  const userId = auth.currentUser?.uid || null;
  const all = readLocal();
  const now = new Date().toISOString();
  const newLead = {
    id: `local-${Date.now().toString(36)}`,
    createdAt: now,
    updatedAt: now,
    stage: 'Novo',
    interest: 'Na dúvida',
    lastVisitAt: null,
    nextAction: null,
    ...lead,
    agronomistId: userId,
    synced: navigator.onLine,
  };
  all.push(newLead);
  saveLocal(all);

  if (navigator.onLine) {
    setDoc(doc(db, 'leads', newLead.id), newLead)
      .then(() => {
        const list = readLocal();
        const idx = list.findIndex((l) => l.id === newLead.id);
        if (idx >= 0) {
          list[idx].synced = true;
          saveLocal(list);
        }
      })
      .catch((err) => console.error('Erro ao salvar lead no Firestore', err));
  }
  return newLead;
}

export function updateLead(id, changes) {
  const all = readLocal();
  const idx = all.findIndex((l) => l.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...changes, updatedAt: new Date().toISOString(), synced: navigator.onLine ? true : false };
    saveLocal(all);
  }
  if (navigator.onLine) {
    setDoc(doc(db, 'leads', id), all[idx], { merge: true }).catch((err) =>
      console.error('Erro ao atualizar lead no Firestore', err)
    );
  }
  return idx >= 0 ? all[idx] : null;
}

export async function syncLeadsFromFirestore() {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    console.warn('syncLeadsFromFirestore: usuário não autenticado');
    return [];
  }
  // Envia locais pendentes
  if (navigator.onLine) {
    const localAll = readLocal();
    for (const l of localAll.filter((x) => x.agronomistId === userId && !x.synced)) {
      try {
        await setDoc(doc(db, 'leads', l.id), l, { merge: true });
        l.synced = true;
      } catch (err) {
        console.error('Erro ao sincronizar lead', err);
      }
    }
    saveLocal(localAll);
  }
  // Baixa remotos do agrônomo
  try {
    const snap = await getDocs(query(collection(db, 'leads'), where('agronomistId', '==', userId)));
    const remote = snap.docs.map((d) => d.data());
    const map = new Map(remote.map((l) => [l.id, l]));
    for (const l of readLocal()) {
      if (!map.has(l.id)) map.set(l.id, l);
    }
    const merged = Array.from(map.values());
    saveLocal(merged);
    return merged.filter((l) => l.agronomistId === userId);
  } catch (err) {
    console.error('Erro ao buscar leads do Firestore', err);
    return getLeads();
  }
}

