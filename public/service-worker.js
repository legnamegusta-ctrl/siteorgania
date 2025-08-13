// service-worker.js

const CACHE_NAME = 'organia-cache-v7';
const APP_VERSION = '1.0.1';
const urlsToCache = [
  // Arquivos principais
  '/',
  '/index.html',
  '/style.css',

  // Imagens e Ícones
  '/logo.png',
  '/favicon.png',
  '/background.jpg',
  '/icon-192.png',
  '/icon-512.png',

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

// Evento de Instalação: Salva os arquivos essenciais no cache.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto e arquivos locais sendo salvos');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de Fetch: LÓGICA CORRIGIDA E SIMPLIFICADA
self.addEventListener('fetch', event => {
  event.respondWith(
    // Tenta encontrar uma correspondência no cache.
    // A opção { ignoreSearch: true } faz com que URLs como '/page.html?id=123'
    // correspondam a '/page.html' que está no cache.
    caches.match(event.request, { ignoreSearch: true }).then(response => {
      // Se encontrar no cache, retorna a resposta do cache.
      // Se não encontrar, busca na rede. Isso funcionará online
      // e falhará graciosamente offline para recursos não cacheados.
      return response || fetch(event.request);
    })
  );
});


// Evento de Ativação: Limpa caches antigos.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Limpando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      self.skipWaiting();
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});