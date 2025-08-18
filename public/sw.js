// sw.js - Service Worker
const CACHE_NAME = 'organia-cache-v8';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/logo.png',
  '/favicon.png',
  '/background.jpg',
  '/icon-192.png',
  '/icon-512.png',

  '/agronomo-dashboard.html',
  '/js/pages/agronomo-dashboard.js',
  '/js/data/crm-store.js',

  '/dashboard-admin.html',
  '/dashboard-agronomo.html',
  '/dashboard-cliente.html',
  '/client-details.html',
  '/property-details.html',
  '/plot-details.html',
  '/relatorio-talhao.html',
  '/ordens-producao.html',
  '/formulas-admin.html',
  '/mapa-geral.html',
  '/task-viewer.html',

  '/js/config/firebase.js',
  '/js/services/auth.js',
  '/js/services/ui.js',
  '/js/services/notifications.js',
  '/js/ui/sidebar.js',

  '/js/pages/dashboard-admin.js',
  '/js/pages/dashboard-agronomo.js',
  '/js/pages/dashboard-cliente.js',
  '/js/pages/client-details.js',
  '/js/pages/property-details.js',
  '/js/pages/plot-details.js',
  '/js/pages/plot-report.js',
  '/js/pages/formulas-admin.js',
  '/js/pages/ordens-producao.js',
  '/js/pages/task-viewer.js',
  '/js/pages/mapa-geral.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  const accept = req.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return resp;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
  } else {
    event.respondWith(
      caches.match(req).then((cached) => {
        return (
          cached ||
          fetch(req).then((resp) => {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return resp;
          })
        );
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
