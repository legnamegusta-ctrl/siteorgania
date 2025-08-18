// service-worker.js

const CACHE_NAME = 'organia-v6';
const APP_VERSION = '1.0.1';
const urlsToCache = [
  // Arquivos principais
  '/',
  '/index.html',
  '/style.css',

  // Imagens e Ícones
  '/logo.png',
  '/background.jpg',

  // Páginas HTML
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

  // Scripts Essenciais (Config e Services)
  '/js/config/firebase.js',
  '/js/services/auth.js',
  '/js/services/ui.js',
  '/js/services/notifications.js',

  // Scripts das Páginas
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

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Cache aberto e arquivos locais sendo salvos');
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(response => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Limpando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return clients.claim();
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
