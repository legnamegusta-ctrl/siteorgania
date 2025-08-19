const CACHE_NAME = 'organia-v7';

// Firebase Messaging (compat) no Service Worker
self.importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
self.importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAQI_FXk-1xySGiZVhiLimKSDoOwBM73Mw",
  authDomain: "app-organia.firebaseapp.com",
  projectId: "app-organia",
  storageBucket: "app-organia.firebasestorage.app",
  messagingSenderId: "92173277950",
  appId: "1:92173277950:web:43448042c19f29ec5363af"
});

const messaging = firebase.messaging();

// Notificação em segundo plano (customize conforme necessário)
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Notificação';
  const options = {
    body: (payload.notification && payload.notification.body) || '',
    icon: '/icons/icon-192.png'
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('install', () => {
  // self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : undefined)));
    // clients.claim();
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsArr) {
      client.postMessage({ type: 'SW_READY' });
    }
  })());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      fetch(event.request)
        .then(response => {
          cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cache.match(event.request))
    )
  );
});
