// public/js/config/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { getMessaging } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging.js';

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
const auth = getAuth(app);

// Persistência de sessão de Auth
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error('Erro ao configurar persistência de auth:', err);
});

// Inicializa Messaging quando suportado
let messaging;
try {
  messaging = getMessaging(app);
} catch (err) {
  console.warn('Firebase messaging não suportado neste ambiente.', err);
}

// Ativa persistência offline do Firestore (IndexedDB)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Persistence failed: múltiplas abas ativas impedem a persistência.");
  } else if (err.code === 'unimplemented') {
    console.warn("Persistence failed: navegador não suporta persistência.");
  } else {
    console.error("Persistence failed:", err);
  }
});

export { db, app, auth, messaging };



