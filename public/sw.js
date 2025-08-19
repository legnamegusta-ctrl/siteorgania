// Não fazer takeover agressivo; update será natural/seguro.

const CACHE_NAME = 'organia-v8'; // bump de versão

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
messaging.onBackgroundMessage((payload) => {
  const n = payload?.notification || {};
  self.registration.showNotification(n.title || 'Notificação', { body: n.body || '' });
});

self.addEventListener('install', (event) => {
  // sem skipWaiting
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : undefined)))
    )
  );
  // sem clients.claim
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Não interceptar métodos não-GET
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Nunca interceptar o próprio SW ou antigos SWs
  if (url.pathname === '/sw.js' || url.pathname.endsWith('/firebase-messaging-sw.js')) return;
  // Não cachear navegação/HTML (para evitar versões presas)
  const isHTML = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html');
  if (isHTML) return;
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const resp = await fetch(req);
        if (resp && resp.status === 200 && resp.type === 'basic') {
          cache.put(req, resp.clone());
        }
        return resp;
      } catch (e) {
        const cached = await cache.match(req);
        if (cached) return cached;
        throw e;
      }
    })
  );
});
