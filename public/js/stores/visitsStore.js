import { db, auth } from '../config/firebase.js';
import { collection, doc, setDoc, updateDoc } from '/vendor/firebase/9.6.0/firebase-firestore.js';
import { list, get, put } from '../lib/db/indexeddb.js';
import { enqueue } from '../sync/outbox.js';

function removeUndefinedFields(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export function listVisits() {
  return list('visits');
}

export const getVisits = listVisits;

export async function addVisit(visit) {
  const userId = (window.getCurrentUid && window.getCurrentUid()) || auth.currentUser?.uid || null;
  const id = doc(collection(db, 'visits')).id;
  const newVisit = {
    id,
    at: new Date().toISOString(),
    authorId: userId,
    agronomistId: userId,
    ...visit,
  };
  await put('visits', newVisit);

  const send = async () => {
    const cleaned = removeUndefinedFields({ ...newVisit });
    await setDoc(doc(db, 'visits', id), cleaned);
    if (newVisit.refId && newVisit.type) {
      const parts =
        newVisit.type === 'lead'
          ? ['leads', newVisit.refId, 'visits', id]
          : ['clients', newVisit.refId, 'visits', id];
      try {
        await setDoc(doc(db, ...parts), { ...cleaned, visitId: id });
      } catch (subErr) {
        console.warn('[visitsStore] Falha ao salvar visita em subcoleção', subErr);
      }
    }
  };

  if (navigator.onLine) {
    try {
      await send();
    } catch (err) {
      await enqueue('visit:add', newVisit);
    }
  } else {
    await enqueue('visit:add', newVisit);
  }
  return newVisit;
}

export async function updateVisit(id, changes) {
  const current = (await get('visits', id)) || { id };
  const updated = { ...current, ...changes, id };
  await put('visits', updated);

  const send = async () => {
    const ref = id.includes('/') ? doc(db, ...id.split('/')) : doc(db, 'visits', id);
    await updateDoc(ref, removeUndefinedFields(changes));
  };

  if (navigator.onLine) {
    try {
      await send();
    } catch (err) {
      await enqueue('visit:update', { id, changes });
    }
  } else {
    await enqueue('visit:update', { id, changes });
  }
  return updated;
}
