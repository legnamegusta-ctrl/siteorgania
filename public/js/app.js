// public/js/app.js

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
  registerSW();
});
