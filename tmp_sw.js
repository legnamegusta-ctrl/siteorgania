// Forçar takeover imediato e garantir modo offline.

const CACHE_NAME = 'organia-v13'; // bump de versão
const OFFLINE_URL = '/index.html';
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/404.html',
  '/activity-details.html',
  '/agenda.html',
  '/agronomo-farm.html',
  '/client-details.html',
  '/client-list.html',
  '/dashboard-admin.html',
  '/dashboard-agronomo.html',
  '/dashboard-cliente.html',
  '/formulas-admin.html',
  '/lead-details.html',
  '/mapa-agronomo.html',
  '/mapa-geral.html',
  '/operador-agenda.html',
  '/operador-dashboard.html',
  '/operador-ordens.html',
  '/operador-perfil.html',
  '/operador-tarefas.html',
  '/ordens-producao.html',
  '/order-details.html',
  '/plot-details.html',
  '/property-details.html',
  '/property-employees.html',
  '/relatorio-talhao.html',
  '/task-viewer.html',
  '/css/base.css',
  '/css/components.css',
  '/css/theme.css',
  '/css/tokens.css',
  '/style.css',
  '/js/app.js',
  '/js/config/Livefirebase.js',
  '/js/config/firebase.js',
  '/js/lib/dashboardUtils.js',
  '/js/lib/date-utils.js',
  '/js/lib/orderUtils.js',
  '/js/lib/router.js',
  '/js/lib/taskUtils.js',
  '/js/lib/uiGuards.js',
  '/js/pages/activity-details.js',
  '/js/pages/agenda.js',
  '/js/pages/agro-bottom-nav.js',
  '/js/pages/agro-map.js',
  '/js/pages/agronomo-farm.js',
  '/js/pages/client-details.js',
  '/js/pages/client-list.js',
  '/js/pages/dashboard-admin.js',
  '/js/pages/dashboard-agronomo.js',
  '/js/pages/dashboard-cliente.js',
  '/js/pages/formulas-admin.js',
  '/js/pages/lead-details.js',
  '/js/pages/mapa-agronomo.js',
  '/js/pages/mapa-geral.js',
  '/js/pages/operador-agenda.js',
  '/js/pages/operador-dashboard.js',
  '/js/pages/operador-ordens.js',
  '/js/pages/operador-perfil.js',
  '/js/pages/operador-tarefas.js',
  '/js/pages/ordens-producao.js',
  '/js/pages/order-details.js',
  '/js/pages/plot-details.js',
  '/js/pages/plot-report.js',
  '/js/pages/property-details.js',
  '/js/pages/property-employees.js',
  '/js/pages/task-viewer.js',
  '/js/services/auth.js',
  '/js/services/notifications.js',
  '/js/services/ui.js',
  '/js/stores/agendaStore.js',
  '/js/stores/clientsStore.js',
  '/js/stores/leadsStore.js',
  '/js/stores/propertiesStore.js',
  '/js/stores/salesStore.js',
  '/js/stores/visitsStore.js',
  '/js/ui/components.js',
  '/js/ui/order-modal.js',
  '/js/ui/sidebar.js',
  '/js/ui/task-detail.js',
  '/js/ui/task-modal.js',
  '/js/utils/geo.js',
  '/js/utils/metrics.js',
  // Vendored Firebase ESM (offline robust)
  '/vendor/firebase/9.6.0/firebase-app.js',
  '/vendor/firebase/9.6.0/firebase-auth.js',
  '/vendor/firebase/9.6.0/firebase-firestore.js',
  '/vendor/firebase/9.6.1/firebase-messaging.js',
  '/logo.png',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/background.jpg',
  '/manifest.json'
];

// Recursos opcionais (disponíveis apenas quando hospedado no Firebase Hosting)
const OPTIONAL_URLS = [
  '/__/firebase/9.6.1/firebase-app-compat.js',
  '/__/firebase/9.6.1/firebase-auth-compat.js',
  '/__/firebase/9.6.1/firebase-firestore-compat.js',
  '/__/firebase/9.6.1/firebase-messaging-compat.js',
  '/__/firebase/init.js'
].map((u) => new Request(u, { mode: 'no-cors' }));

const THIRD_PARTY_URLS = [
  // Tailwind (clássico <script>, não requer CORS)
  new Request('https://cdn.tailwindcss.com', { mode: 'no-cors' }),

  // Firebase ESM (precisam de CORS válido para funcionar como módulos offline)
  new Request('https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js', { mode: 'cors' }),
  new Request('https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js', { mode: 'cors' }),
  new Request('https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js', { mode: 'cors' }),
  new Request('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging.js', { mode: 'cors' }),

  // Compat (usado dentro do próprio SW para FCM background)
  new Request('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js', { mode: 'no-cors' }),
  new Request('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js', { mode: 'no-cors' }),

  // Bibliotecas de UI opcionais usadas em diversas páginas
  new Request('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css', { mode: 'no-cors' }),
  new Request('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', { mode: 'no-cors' }),
  new Request('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', { mode: 'no-cors' }),
  new Request('https://cdn.jsdelivr.net/npm/chart.js', { mode: 'no-cors' })
];

// Firebase Messaging (compat) no Service Worker
let messaging;
try {
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

  messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const n = payload?.notification || {};
    self.registration.showNotification(n.title || 'Notificação', { body: n.body || '' });
  });
} catch (e) {
  console.warn('[SW] Firebase Messaging indisponível', e);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const all = [
        ...PRECACHE_URLS.map((u) => (typeof u === 'string' ? new Request(u) : u)),
        ...THIRD_PARTY_URLS,
        ...OPTIONAL_URLS,
      ];
      await Promise.all(
        all.map((req) => cache.add(req).catch(() => {/* ignora falhas opcionais */}))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : undefined)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Não interceptar métodos não-GET
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Nunca interceptar o próprio SW
  if (url.pathname === '/sw.js') return;
  // Estratégia de network-first para navegação/HTML
  const isHTML = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html');
  if (isHTML) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const resp = await fetch(req);
          if (resp && resp.status === 200) {
            cache.put(req, resp.clone());
          }
          return resp;
        } catch (e) {
          const cached = await cache.match(req);
          return cached || cache.match(OFFLINE_URL);
        }
      })
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const resp = await fetch(req);
        if (resp && (resp.status === 200 || resp.type === 'opaque')) {
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


