import { db } from '../config/firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const KEY = 'agro.agenda';

export function getAgenda() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addAgenda(item) {
  const agenda = getAgenda();
  const newItem = {
    id: Date.now().toString(36),
    ...item
  };
  agenda.push(newItem);
  localStorage.setItem(KEY, JSON.stringify(agenda));
  setDoc(doc(db, 'agenda', newItem.id), newItem).catch((err) =>
    console.error('Erro ao salvar item da agenda no Firestore', err)
  );
  return newItem;
}

export function updateAgenda(id, changes) {
  const agenda = getAgenda();
  const idx = agenda.findIndex((a) => a.id === id);
  if (idx >= 0) {
    agenda[idx] = {
      ...agenda[idx],
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(agenda));
    setDoc(doc(db, 'agenda', id), agenda[idx], { merge: true }).catch((err) =>
      console.error('Erro ao atualizar item da agenda no Firestore', err)
    );
    return agenda[idx];
  }
  return null;
}
