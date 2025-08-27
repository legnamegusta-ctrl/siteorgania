// public/js/config/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
// REMOVIDO 'enablePersistence' desta importação, pois não é exportado por este bundle CDN
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { getMessaging } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging.js';

// Seu objeto de configuração do Firebase (substitua com suas chaves reais!)
const firebaseConfig = {
  apiKey: "AIzaSyAQI_FXk-1xySGiZVhiLimKSDoOwBM73Mw",
  authDomain: "app-organia.firebaseapp.com",
  projectId: "app-organia",
  storageBucket: "app-organia.firebasestorage.app",
  messagingSenderId: "92173277950",
  appId: "1:92173277950:web:43448042c19f29ec5363af"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // Inicializa o Auth aqui

// Garante que a autenticação persista entre sessões do navegador
setPersistence(auth, browserLocalPersistence)
  .catch(err => console.error('Erro ao configurar persistência:', err));

let messaging;
try {
  // Evita erro "Service messaging is not available" em ambientes sem suporte
  messaging = getMessaging(app);
} catch (err) {
  console.warn('Firebase messaging não suportado neste ambiente.', err);
}

// Ativa persistência offline do Firestore para permitir uso sem conexão
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Persistence failed: Can't enable persistence because multiple tabs are open or another instance is active.");
    } else if (err.code === 'unimplemented') {
      console.warn("Persistence failed: Current browser does not support persistence.");
    } else {
      console.error("Persistence failed for unknown reason:", err);
    }
  });

export { db, app, auth, messaging }; // Exportar 'db', 'app', 'auth' e utilitários de messaging
