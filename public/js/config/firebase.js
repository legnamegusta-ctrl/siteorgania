// public/js/config/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
// REMOVIDO 'enablePersistence' desta importação, pois não é exportado por este bundle CDN
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';

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

export { db, app, auth }; // Exportar 'db', 'app' e 'auth'