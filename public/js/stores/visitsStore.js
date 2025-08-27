import { db } from '../config/firebase.js';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const KEY = 'agro.visits';

function readLocal() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

function saveLocal(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function removeUndefinedFields(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function isTempId(id) {
  return id.startsWith('local-');
}

export async function getVisits() {
  const local = readLocal();
  if (navigator.onLine) {
    for (const v of local.filter((v) => !v.synced)) {
      const { synced, ...data } = v;
      try {
        if (isTempId(v.id)) {
          const ref = await addDoc(collection(db, 'visits'), removeUndefinedFields(data));
          v.id = ref.id;
        } else {
          await updateDoc(doc(db, 'visits', v.id), removeUndefinedFields(data));
        }
        v.synced = true;
      } catch (err) {
        console.error('Erro ao sincronizar visita', err);
      }
    }
    saveLocal(local);
    try {
      const snap = await getDocs(collection(db, 'visits'));
      const remote = snap.docs.map((d) => ({ id: d.id, ...d.data(), synced: true }));
      saveLocal(remote);
      return remote;
    } catch (err) {
      console.error('Erro ao buscar visitas do Firestore', err);
      return local;
    }
  }
  return local;
}

export async function addVisit(visit) {
  const visits = readLocal();
  const newVisit = {
    id: `local-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    ...visit,
    synced: navigator.onLine
  };
  visits.push(newVisit);
  saveLocal(visits);

  if (navigator.onLine) {
    try {
      const { synced, id, ...data } = newVisit;
      const ref = await addDoc(collection(db, 'visits'), removeUndefinedFields(data));
      const idx = visits.findIndex((v) => v.id === id);
      if (idx >= 0) {
        visits[idx] = { id: ref.id, ...data, synced: true };
        saveLocal(visits);
        return visits[idx];
      }
      return { id: ref.id, ...data, synced: true };
    } catch (err) {
      console.error('Erro ao adicionar visita no Firestore', err);
    }
  }
  return newVisit;
}

export async function updateVisit(id, changes) {
  const visits = readLocal();
  const idx = visits.findIndex((v) => v.id === id);
  if (idx >= 0) {
    visits[idx] = {
      ...visits[idx],
      ...changes,
      synced: navigator.onLine ? true : false
    };
    saveLocal(visits);
  }

  if (navigator.onLine) {
    try {
      await updateDoc(doc(db, 'visits', id), removeUndefinedFields(changes));
      if (idx >= 0) {
        visits[idx].synced = true;
        saveLocal(visits);
      }
    } catch (err) {
      console.error('Erro ao atualizar visita no Firestore', err);
    }
  }
  return idx >= 0 ? visits[idx] : null;
}
