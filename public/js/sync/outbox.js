import { get, put, list, del } from '../lib/db/indexeddb.js';
import { db } from '../config/firebase.js';
import { doc, setDoc, updateDoc } from '/vendor/firebase/9.6.0/firebase-firestore.js';

export function enqueue(type, payload) {
  return put('outbox', { type, payload });
}

export async function processOutbox() {
  if (!navigator.onLine) return;
  const items = await list('outbox');
  for (const item of items) {
    try {
      if (item.type === 'visit:add') {
        const { id, synced: _synced, ...data } = item.payload;
        await setDoc(doc(db, 'visits', id), data);
        if (data.refId && data.type) {
          const parts =
            data.type === 'lead'
              ? ['leads', data.refId, 'visits', id]
              : ['clients', data.refId, 'visits', id];
          await setDoc(doc(db, ...parts), { ...data, visitId: id });
        }
        const visit = await get('visits', id);
        if (visit) await put('visits', { ...visit, synced: true });
      } else if (item.type === 'visit:update') {
        const { id, changes, refId, type } = item.payload;
        const visitId = id.includes('/') ? id.split('/').pop() : id;
        const ref = id.includes('/') ? doc(db, ...id.split('/')) : doc(db, 'visits', visitId);
        await updateDoc(ref, changes);

        let mirrorRefId = refId;
        let mirrorType = type;
        let visit;
        if (!mirrorRefId || !mirrorType) {
          visit = await get('visits', visitId);
          mirrorRefId = mirrorRefId || visit?.refId;
          mirrorType = mirrorType || visit?.type;
        }
        if (mirrorRefId && mirrorType) {
          const parts =
            mirrorType === 'lead'
              ? ['leads', mirrorRefId, 'visits', visitId]
              : ['clients', mirrorRefId, 'visits', visitId];
          await setDoc(doc(db, ...parts), changes, { merge: true });
        }
        if (!visit) visit = await get('visits', visitId);
        if (visit) await put('visits', { ...visit, synced: true });
      }
      await del('outbox', item.id);
    } catch (err) {
      console.warn('[outbox] Failed to process item', item, err);
    }
  }
}

window.addEventListener('online', processOutbox);
