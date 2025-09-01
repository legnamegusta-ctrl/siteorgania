import { db, auth } from '../config/firebase.js';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  collectionGroup,
} from '/vendor/firebase/9.6.0/firebase-firestore.js';
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
    synced: navigator.onLine ? true : false,
    ...visit,
    updatedAt: visit?.updatedAt ?? Date.now(),
  };
  await put('visits', newVisit);

  const send = async () => {
    const { synced, ...cleaned } = removeUndefinedFields({ ...newVisit });
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
      newVisit.synced = false;
      await put('visits', newVisit);
      await enqueue('visit:add', newVisit);
    }
  } else {
    await enqueue('visit:add', newVisit);
  }
  return newVisit;
}

export async function updateVisit(id, changes) {
  const current = (await get('visits', id)) || { id };
  const updated = {
    ...current,
    ...changes,
    id,
    synced: navigator.onLine ? true : false,
    updatedAt: changes?.updatedAt ?? Date.now(),
  };
  await put('visits', updated);

  const send = async () => {
    const ref = id.includes('/') ? doc(db, ...id.split('/')) : doc(db, 'visits', id);
    await updateDoc(ref, removeUndefinedFields(changes));
  };

  if (navigator.onLine) {
    try {
      await send();
    } catch (err) {
      updated.synced = false;
      await put('visits', updated);
      await enqueue('visit:update', { id, changes });
    }
  } else {
    await enqueue('visit:update', { id, changes });
  }
  return updated;
}

// Synchronize visit documents from Firestore into IndexedDB.
export async function syncVisitsFromFirestore() {
  if (!navigator.onLine) return 0;
  const userId =
    (window.getCurrentUid && window.getCurrentUid()) || auth.currentUser?.uid || null;
  if (!userId) return 0;

  const allDocs = new Map();

  const top = collection(db, 'visits');
  const queries = [
    query(top, where('authorId', '==', userId)),
    query(top, where('agronomistId', '==', userId)),
  ];
  for (const q of queries) {
    try {
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const norm = normalizeDoc(d);
        if (norm) allDocs.set(norm.id, norm);
      });
    } catch (err) {
      console.warn('[visitsStore] erro ao buscar visitas', err);
    }
  }

  try {
    const snap = await getDocs(
      query(collectionGroup(db, 'visits'), where('authorId', '==', userId))
    );
    snap.forEach((d) => {
      const norm = normalizeDoc(d);
      if (norm && !allDocs.has(norm.id)) allDocs.set(norm.id, norm);
    });
  } catch (err) {
    console.warn('[visitsStore] erro ao buscar subcoleções de visitas', err);
  }

  let upserted = 0;
  for (const item of allDocs.values()) {
    const local = await get('visits', item.id);
    if (local && local.synced === false) {
      if (!item.updatedAt) continue;
      if (local.updatedAt && local.updatedAt > item.updatedAt) continue;
    }
    await put('visits', { ...local, ...item, synced: true });
    upserted++;
  }
  return upserted;
}

function normalizeDoc(docSnap) {
  const data = docSnap.data() || {};
  const id = data.visitId || data.id || docSnap.id;
  let at;
  if (typeof data.at === 'string') at = data.at;
  else if (data.at?.toDate) at = data.at.toDate().toISOString();
  else if (data.date?.toDate) at = data.date.toDate().toISOString();
  else if (data.checkInTime?.toDate) at = data.checkInTime.toDate().toISOString();
  else if (data.createdAt?.toDate) at = data.createdAt.toDate().toISOString();

  let updatedAt;
  if (typeof data.updatedAt === 'number') updatedAt = data.updatedAt;
  else if (data.updatedAt?.toMillis) updatedAt = data.updatedAt.toMillis();

  let type = data.type || data.relatedType;
  if (!type) {
    if (data.clientId || data.refId) type = 'cliente';
    else if (data.leadId) type = 'lead';
  }

  const refId =
    data.refId || data.relatedId || data.clientId || data.leadId || undefined;

  let lat = data.lat;
  let lng = data.lng;
  if (data.location && typeof data.location.latitude === 'number') {
    lat = lat ?? data.location.latitude;
    lng = lng ?? data.location.longitude;
  }

  return removeUndefinedFields({
    id,
    at,
    authorId: data.authorId,
    type,
    refId,
    notes: data.notes,
    clientName: data.clientName,
    leadName: data.leadName,
    lat,
    lng,
    updatedAt,
  });
}
