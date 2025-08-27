// public/js/config/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
// REMOVIDO 'enablePersistence' desta importação, pois não é exportado por este bundle CDN
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { getMessaging } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging.js';

// Seu objeto de configuração do Firebase (substitua com suas chaves reais!)
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

// O BLOCO ABAIXO FOI COMENTADO PARA RESOLVER O ERRO DE IMPORTAÇÃO
// Se a persistência offline for crucial, você precisará investigar a forma correta
// de importá-la para a versão 9.6.0 via CDN, ou usar um bundler (webpack/rollup).
/*
enablePersistence(db)
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          console.warn("Persistence failed: Can't enable persistence because multiple tabs are open or another instance is active.");
      } else if (err.code == 'unimplemented') {
          console.warn("Persistence failed: Current browser does not support persistence.");
      } else {
          console.error("Persistence failed for unknown reason:", err);
      }
  });
*/

export { db, app, auth, messaging }; // Exportar 'db', 'app', 'auth' e utilitários de messaging
