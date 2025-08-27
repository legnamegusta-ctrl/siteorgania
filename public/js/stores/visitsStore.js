import { db } from '../config/firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const KEY = 'agro.visits';

function removeUndefinedFields(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

export function getVisits() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addVisit(visit) {
  const visits = getVisits();
  const newVisit = removeUndefinedFields({
    id: Date.now().toString(36),
    ...visit
  });
  visits.push(newVisit);
  localStorage.setItem(KEY, JSON.stringify(visits));
  setDoc(doc(db, 'visits', newVisit.id), newVisit).catch((err) =>
    console.error('Erro ao salvar visita no Firestore', err)
  );
  return newVisit;
}

export function updateVisit(id, changes) {
  const visits = getVisits();
  const idx = visits.findIndex((v) => v.id === id);
  if (idx >= 0) {
    visits[idx] = removeUndefinedFields({ ...visits[idx], ...changes });
    localStorage.setItem(KEY, JSON.stringify(visits));
    setDoc(doc(db, 'visits', id), visits[idx], { merge: true }).catch((err) =>
      console.error('Erro ao atualizar visita no Firestore', err)
    );
    return visits[idx];
  }
  return null;
}
