// firebase-messaging-sw.js
// Este arquivo precisa estar na raiz da sua pasta `public/public`

// Importe e configure o SDK do Firebase para o Service Worker
// Use a versão compatível com Service Workers
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

// Configuração do Firebase (as mesmas credenciais do seu app.js)
// ATENÇÃO: SUBSTITUA PELAS SUAS CREDENCIAIS REAIS DO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyAQI_FXk-1xySGiZVhiLimKSDoOwBM73Mw",
    authDomain: "app-organia.firebaseapp.com",
    projectId: "app-organia",
    storageBucket: "app-organia.firebasestorage.app",
    messagingSenderId: "92173277950",
    appId: "1:92173277950:web:43448042c19f29ec5363af"
};

// Inicialize o Firebase no Service Worker
firebase.initializeApp(firebaseConfig);

// Obtenha uma referência para o serviço de Messaging
const messaging = firebase.messaging();

// Lógica para lidar com mensagens em segundo plano
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/images/logo.png' // Opcional: Caminho para um ícone para a notificação
        // Você pode adicionar mais opções aqui, como imagem, dados personalizados, etc.
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Opcional: Listener para quando o Service Worker é ativado
self.addEventListener('activate', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker ativado.');
});

// Opcional: Listener para quando o Service Worker é instalado
self.addEventListener('install', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker instalado.');
    self.skipWaiting(); // Força a ativação imediata do Service Worker
});
