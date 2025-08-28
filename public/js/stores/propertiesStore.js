import { db } from '../config/firebase.js';
import { doc, setDoc } from '/vendor/firebase/9.6.0/firebase-firestore.js';

const KEY = 'agro.properties';

export function getProperties() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addProperty(property) {
  const props = getProperties();
  const now = new Date().toISOString();
  const newProp = {
    id: Date.now().toString(36),
    createdAt: now,
    updatedAt: now,
    ...property
  };
  props.push(newProp);
  localStorage.setItem(KEY, JSON.stringify(props));
  setDoc(doc(db, 'properties', newProp.id), newProp).catch((err) =>
    console.error('Erro ao salvar propriedade no Firestore', err)
  );
  return newProp;
}
