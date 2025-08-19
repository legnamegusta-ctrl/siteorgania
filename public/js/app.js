// public/js/app.js

if ('serviceWorker' in navigator) {
  // sem reload automático em controllerchange

  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.error('Falha ao registrar Service Worker', err);
  });

  // Limpeza 1x de SWs antigos que não sejam /sw.js
  navigator.serviceWorker.getRegistrations?.().then(regs => {
    regs.forEach(r => {
      const url = r.active?.scriptURL || '';
      if (url && !url.endsWith('/sw.js')) {
        r.unregister().catch(() => {});
      }
    });
  });
}
