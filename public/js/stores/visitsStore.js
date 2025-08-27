import { db } from '../config/firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const KEY = 'agro.visits';

export function getVisits() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addVisit(visit) {
  const visits = getVisits();
  const newVisit = {
    id: Date.now().toString(36),
    ...visit
  };
  visits.push(newVisit);
  localStorage.setItem(KEY, JSON.stringify(visits));
  setDoc(doc(db, 'visits', newVisit.id), newVisit).catch((err) =>
    console.error('Erro ao salvar visita no Firestore', err)
  );
  return newVisit;
}
