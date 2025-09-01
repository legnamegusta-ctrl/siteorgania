// public/js/config/firebase.js
import { initializeApp } from '/vendor/firebase/9.6.0/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence } from '/vendor/firebase/9.6.0/firebase-firestore.js';
import { getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence, inMemoryPersistence } from '/vendor/firebase/9.6.0/firebase-auth.js';
import { getMessaging } from '/vendor/firebase/9.6.1/firebase-messaging.js';

// Config do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCQcgMFBU_rcm7cDjuE9WjSaCNzgFxXVOQ",
  authDomain: "organia-fertilizantes.firebaseapp.com",
  databaseURL: "https://organia-fertilizantes-default-rtdb.firebaseio.com",
  projectId: "organia-fertilizantes",
  storageBucket: "organia-fertilizantes.firebasestorage.app",
  messagingSenderId: "488614836789",
  appId: "1:488614836789:web:7d55498e0f78c158ed8f7c"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Inicializa Auth escolhendo a persistência adequada para cada ambiente
const auth = getAuth(app);
const isCapacitor =
  typeof window !== 'undefined' &&
  (window.Capacitor ||
    (location && String(location.origin).startsWith('capacitor://')));

// Configura a persistência de forma assíncrona sem bloquear a importação do módulo
(async () => {
  try {
    if (isCapacitor) {
      await setPersistence(auth, browserLocalPersistence);
      console.info('[auth] persistence=browserLocal (Capacitor)');
    } else {
      await setPersistence(auth, indexedDBLocalPersistence);
      console.info('[auth] persistence=indexedDB');
    }
  } catch (e1) {
    try {
      await setPersistence(auth, browserLocalPersistence);
      console.info(
        '[auth] persistence=browserLocal (fallback)',
        e1?.message
      );
    } catch (e2) {
      await setPersistence(auth, inMemoryPersistence);
      console.warn(
        '[auth] persistence=inMemory (last resort)',
        e2?.message
      );
    }
  }
})();

// Inicializa Messaging quando suportado
let messaging;
try {
  messaging = getMessaging(app);
} catch (err) {
  console.warn('Firebase messaging nÃ£o suportado neste ambiente.', err);
}

// Ativa persistÃªncia offline do Firestore (IndexedDB)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Persistence failed: mÃºltiplas abas ativas impedem a persistÃªncia.");
  } else if (err.code === 'unimplemented') {
    console.warn("Persistence failed: navegador nÃ£o suporta persistÃªncia.");
  } else {
    console.error("Persistence failed:", err);
  }
});

export { db, app, auth, messaging };


