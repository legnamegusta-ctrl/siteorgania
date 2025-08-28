import { db, auth } from '../config/firebase.js';
import { doc, setDoc, collection, getDocs, query, where } from '/vendor/firebase/9.6.0/firebase-firestore.js';

const KEY = 'agro.agenda';

function readLocal() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

function saveLocal(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getAgenda() {
  const userId = auth.currentUser?.uid;
  const all = readLocal();
  return userId ? all.filter((a) => a.agronomistId === userId) : all;
}

export function addAgenda(item) {
  const agenda = readLocal();
  const userId = auth.currentUser?.uid || null;
  const newItem = {
    id: `local-${Date.now().toString(36)}`,
    ...item,
    agronomistId: userId,
    synced: navigator.onLine,
  };
  agenda.push(newItem);
  saveLocal(agenda);
  if (navigator.onLine) {
    setDoc(doc(db, 'agenda', newItem.id), newItem)
      .then(() => {
        const list = readLocal();
        const idx = list.findIndex((a) => a.id === newItem.id);
        if (idx >= 0) {
          list[idx].synced = true;
          saveLocal(list);
        }
      })
      .catch((err) => console.error('Erro ao salvar item da agenda no Firestore', err));
  }
  return newItem;
}

export function updateAgenda(id, changes) {
  const agenda = readLocal();
  const idx = agenda.findIndex((a) => a.id === id);
  if (idx >= 0) {
    agenda[idx] = {
      ...agenda[idx],
      ...changes,
      updatedAt: new Date().toISOString(),
      synced: navigator.onLine ? true : false,
    };
    saveLocal(agenda);
  }
  if (navigator.onLine) {
    setDoc(doc(db, 'agenda', id), agenda[idx], { merge: true }).catch((err) =>
      console.error('Erro ao atualizar item da agenda no Firestore', err)
    );
  }
  return idx >= 0 ? agenda[idx] : null;
}

export async function syncAgendaFromFirestore() {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    console.warn('syncAgendaFromFirestore: usuário não autenticado');
    return [];
  }
  if (navigator.onLine) {
    const localAll = readLocal();
    for (const a of localAll.filter((x) => x.agronomistId === userId && !x.synced)) {
      try {
        await setDoc(doc(db, 'agenda', a.id), a, { merge: true });
        a.synced = true;
      } catch (err) {
        console.error('Erro ao sincronizar agenda', err);
      }
    }
    saveLocal(localAll);
  }
  try {
    const snap = await getDocs(query(collection(db, 'agenda'), where('agronomistId', '==', userId)));
    const remote = snap.docs.map((d) => d.data());
    const map = new Map(remote.map((a) => [a.id, a]));
    for (const a of readLocal()) {
      if (!map.has(a.id)) map.set(a.id, a);
    }
    const merged = Array.from(map.values());
    saveLocal(merged);
    return merged.filter((a) => a.agronomistId === userId);
  } catch (err) {
    console.error('Erro ao buscar agenda no Firestore', err);
    return getAgenda();
  }
}
