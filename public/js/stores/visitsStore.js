import { db } from '../config/firebase.js';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

function removeUndefinedFields(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

export async function getVisits() {
  const snap = await getDocs(collection(db, 'visits'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addVisit(visit) {
  const clean = removeUndefinedFields({
    ...visit
  });
  const ref = await addDoc(collection(db, 'visits'), clean);
  return { id: ref.id, ...clean };
}

export async function updateVisit(id, changes) {
  const clean = removeUndefinedFields(changes);
  await updateDoc(doc(db, 'visits', id), clean);
  return { id, ...clean };
}
