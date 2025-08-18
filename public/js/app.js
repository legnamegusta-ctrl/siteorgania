// public/js/app.js

function generateIcon(size, key) {
  let dataUrl = localStorage.getItem(key);
  if (!dataUrl) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2.2, 0, Math.PI * 2);
    ctx.fill();
    dataUrl = canvas.toDataURL('image/png');
    localStorage.setItem(key, dataUrl);
  }
  return dataUrl;
}

export function ensureDynamicManifest() {
  const manifestLink = document.getElementById('dynamic-manifest');
  const faviconLink = document.getElementById('dynamic-favicon');
  if (!manifestLink || !faviconLink) return;

  const icon192 = generateIcon(192, 'organia_icon_192');
  const icon512 = generateIcon(512, 'organia_icon_512');

  const manifest = {
    name: 'Orgânia',
    short_name: 'Orgânia',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#166534',
    icons: [
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  };

  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  const url = URL.createObjectURL(blob);
  manifestLink.href = url;
  faviconLink.href = icon192;

  window.addEventListener('beforeunload', () => {
    URL.revokeObjectURL(url);
  });
}

export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!window.__didReloadOnce) {
            window.__didReloadOnce = true;
            window.location.reload();
          }
        });
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      } catch (err) {
        console.error('Falha ao registrar Service Worker', err);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  ensureDynamicManifest();
  registerSW();
});

