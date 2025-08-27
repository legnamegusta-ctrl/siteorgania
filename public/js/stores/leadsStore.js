import { db, auth } from '../config/firebase.js';
import {
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const KEY = 'agro.leads';

export function getLeads() {
  const userId = auth.currentUser?.uid;
  const leads = JSON.parse(localStorage.getItem(KEY) || '[]');
  return userId ? leads.filter((l) => l.agronomistId === userId) : leads;
}

export function addLead(lead) {
  const userId = auth.currentUser?.uid || null;
  const leads = getLeads();
  const now = new Date().toISOString();
  const newLead = {
    id: Date.now().toString(36),
    createdAt: now,
    updatedAt: now,
    agronomistId: userId,
    stage: 'Novo',
    interest: 'Na dúvida',
    lastVisitAt: null,
    nextAction: null,
    syncFlag: true,
    ...lead
  };
  leads.push(newLead);
  localStorage.setItem(KEY, JSON.stringify(leads));
  // Persistir no Firestore
  setDoc(doc(db, 'leads', newLead.id), newLead).catch((err) =>
    console.error('Erro ao salvar lead no Firestore', err)
  );
  return newLead;
}

export function updateLead(id, changes) {
  const leads = getLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx >= 0) {
    leads[idx] = { ...leads[idx], ...changes, updatedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(leads));
    setDoc(doc(db, 'leads', id), leads[idx], { merge: true }).catch((err) =>
      console.error('Erro ao atualizar lead no Firestore', err)
    );
    return leads[idx];
  }
  return null;
}

export async function syncLeadsFromFirestore() {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn('syncLeadsFromFirestore: usuário não autenticado');
      return [];
    }
    const q = query(collection(db, 'leads'), where('agronomistId', '==', userId));
    const snap = await getDocs(q);
    const leads = snap.docs.map((d) => d.data());
    localStorage.setItem(KEY, JSON.stringify(leads));
    return leads;
  } catch (err) {
    console.error('Erro ao buscar leads do Firestore', err);
    return [];
  }
}
