import { db, auth } from '../config/firebase.js';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  collectionGroup
} from '/vendor/firebase/9.6.0/firebase-firestore.js';

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
  const userId = (window.getCurrentUid && window.getCurrentUid()) || auth.currentUser?.uid;
  // Consider local visits for the logged user
  const local = readLocal().filter((v) => !userId || v.authorId === userId);

  // Normalize different visit schemas into a common shape
  const normalize = (docSnap) => {
    const data = docSnap.data ? docSnap.data() : docSnap;
    // Prefer full ref path when available for uniqueness
    const stableId = docSnap.ref?.path || docSnap.path || docSnap.id || data.id;

    // Author: accept authorId or agronomistId
    const authorId = data.authorId || data.agronomistId || null;

    // Timestamp (ISO string)
    let at = data.at || null;
    if (!at && data.date?.toDate) at = data.date.toDate().toISOString();
    else if (!at && data.checkInTime?.toDate) at = data.checkInTime.toDate().toISOString();
    else if (!at && data.createdAt?.toDate) at = data.createdAt.toDate().toISOString();

    // Type and reference
    let type = data.type || data.relatedType || null;
    let refId = data.refId || data.relatedId || data.clientId || data.leadId || null;
    if (!type) {
      if (data.clientId) type = 'cliente';
      else if (data.leadId) type = 'lead';
    }

    return removeUndefinedFields({
      id: stableId,
      // Keep a short id for compatibility with find by id
      shortId: docSnap.id || data.id || stableId,
      at,
      authorId,
      type,
      refId,
      notes: data.notes || data.summary || data.outcome || '',
      clientName: data.clientName,
      leadName: data.leadName,
      lat: data.lat,
      lng: data.lng,
      synced: true,
    });
  };

  if (navigator.onLine) {
    // 1) Try to sync local pending items
    for (const v of local.filter((x) => !x.synced)) {
      const { synced, ...data } = v;
      try {
        const cleaned = removeUndefinedFields(data);
        if (isTempId(v.id)) {
          const ref = await addDoc(collection(db, 'visits'), cleaned);
          v.id = ref.id;
        } else {
          await updateDoc(doc(db, 'visits', v.id), cleaned);
        }
        if (v.refId && v.type) {
          const parts = v.type === 'lead' ? ['leads', v.refId, 'visits'] : ['clients', v.refId, 'visits'];
          try {
            await addDoc(collection(db, ...parts), { ...cleaned, visitId: v.id });
          } catch (subErr) {
            console.warn('[visitsStore] Falha ao replicar visita para subcoleção', subErr);
          }
        }
        v.synced = true;
      } catch (err) {
        console.error('Erro ao sincronizar visita', err);
      }
    }
    saveLocal(local);

    // 2) Robust remote fetch (covers different schemas)
    try {
      const queries = [];
      if (userId) {
        // top-level 'visits' by authorId or agronomistId
        queries.push(getDocs(query(collection(db, 'visits'), where('authorId', '==', userId))));
        queries.push(getDocs(query(collection(db, 'visits'), where('agronomistId', '==', userId))));
        // subcollections 'visits' (e.g., leads/{id}/visits) by authorId
        queries.push(
          getDocs(query(collectionGroup(db, 'visits'), where('authorId', '==', userId)))
        );
      } else {
        queries.push(getDocs(collection(db, 'visits')));
      }

      let snaps = [];
      try {
        snaps = await Promise.all(queries);
      } catch (err) {
        // If collectionGroup is not indexed/permitted, proceed with top-level only
        console.warn('[visitsStore] collectionGroup(visits) failed; continuing with top-level only.', err);
        snaps = [];
        if (userId) {
          snaps.push(await getDocs(query(collection(db, 'visits'), where('authorId', '==', userId))));
          snaps.push(await getDocs(query(collection(db, 'visits'), where('agronomistId', '==', userId))));
        } else {
          snaps.push(await getDocs(collection(db, 'visits')));
        }
      }

      // 3) Normalize, dedupe, and merge with any unsynced local
      const map = new Map();
      for (const snap of snaps) {
        snap.forEach((docSnap) => {
          const norm = normalize(docSnap);
          if (!userId || norm.authorId === userId) {
            const key = norm.id;
            if (!map.has(key)) map.set(key, norm);
          }
        });
      }

      local
        .filter((x) => !x.synced)
        .forEach((x) => {
          const key = x.id || `${x.refId || ''}:${x.at || ''}:${x.notes || ''}`;
          if (!map.has(key)) map.set(key, { ...x });
        });

      const remote = Array.from(map.values());
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
  const userId = (window.getCurrentUid && window.getCurrentUid()) || auth.currentUser?.uid || null;
  const newVisit = {
    id: `local-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    authorId: userId,
    agronomistId: userId,
    ...visit,
    // Mark as unsynced by default to ensure proper retry on failure or unreliable network detection
    synced: false
  };
  visits.push(newVisit);
  saveLocal(visits);

  if (navigator.onLine) {
    try {
      const { synced, id, ...data } = newVisit;
      const cleaned = removeUndefinedFields(data);
      const ref = await addDoc(collection(db, 'visits'), cleaned);
      if (newVisit.refId && newVisit.type) {
        const parts = newVisit.type === 'lead'
          ? ['leads', newVisit.refId, 'visits']
          : ['clients', newVisit.refId, 'visits'];
        try {
          await addDoc(collection(db, ...parts), { ...cleaned, visitId: ref.id });
        } catch (subErr) {
          console.warn('[visitsStore] Falha ao salvar visita em subcoleção', subErr);
        }
      }
      const idx = visits.findIndex((v) => v.id === id);
      if (idx >= 0) {
        visits[idx] = { id: ref.id, ...data, synced: true };
        saveLocal(visits);
        return visits[idx];
      }
      return { id: ref.id, ...data, synced: true };
    } catch (err) {
      console.error('Erro ao adicionar visita no Firestore', err);
      // Ensure local entry is marked as pending when the remote save fails
      const idx = visits.findIndex((v) => v.id === newVisit.id);
      if (idx >= 0) {
        visits[idx].synced = false;
        saveLocal(visits);
      }
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
      // Assume unsynced until remote update succeeds
      synced: false
    };
    saveLocal(visits);
  }

  if (navigator.onLine) {
    try {
      // Accept either top-level doc id or full path (e.g., 'leads/ABC/visits/DEF')
      const ref = id.includes('/') ? doc(db, ...id.split('/')) : doc(db, 'visits', id);
      await updateDoc(ref, removeUndefinedFields(changes));
      if (idx >= 0) {
        visits[idx].synced = true;
        saveLocal(visits);
      }
    } catch (err) {
      console.error('Erro ao atualizar visita no Firestore', err);
      if (idx >= 0) {
        visits[idx].synced = false;
        saveLocal(visits);
      }
    }
  }
  return idx >= 0 ? visits[idx] : null;
}

