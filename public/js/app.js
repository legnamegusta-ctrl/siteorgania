// public/js/app.js

if ('serviceWorker' in navigator) {
  let didReloadOnce = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (didReloadOnce) return;
    didReloadOnce = true;
    location.reload();
  });

  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.error('Falha ao registrar Service Worker', err);
  });
}
