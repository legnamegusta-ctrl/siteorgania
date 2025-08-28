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

// Persist�ncia de sess�o de Auth
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error('Erro ao configurar persist�ncia de auth:', err);
});

// Inicializa Messaging quando suportado
let messaging;
try {
  messaging = getMessaging(app);
} catch (err) {
  console.warn('Firebase messaging n�o suportado neste ambiente.', err);
}

// Ativa persist�ncia offline do Firestore (IndexedDB)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Persistence failed: m�ltiplas abas ativas impedem a persist�ncia.");
  } else if (err.code === 'unimplemented') {
    console.warn("Persistence failed: navegador n�o suporta persist�ncia.");
  } else {
    console.error("Persistence failed:", err);
  }
});

export { db, app, auth, messaging };



