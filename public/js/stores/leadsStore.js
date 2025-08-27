import { db } from '../config/firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const KEY = 'agro.leads';

export function getLeads() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addLead(lead) {
  const leads = getLeads();
  const now = new Date().toISOString();
  const newLead = {
    id: Date.now().toString(36),
    createdAt: now,
    updatedAt: now,
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
