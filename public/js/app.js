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

  // Diagnóstico leve para depuração
  window.__sw_debug_once__ || (window.__sw_debug_once__ = (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations?.();
      console.log('[SW DEBUG] Registrations:', regs?.map(r => r.active?.scriptURL || r.scriptURL));
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW DEBUG] controllerchange fired — sem reload automático.');
      });
    } catch (e) {
      console.warn('[SW DEBUG] erro:', e);
    }
  })());
}
