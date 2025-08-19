// public/js/app.js

if ('serviceWorker' in navigator) {
  let refreshed = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshed) return;
    refreshed = true;
    // Estratégia suave: exiba um toast/banner “Nova versão disponível. Atualizar?”
    // Se já quiser atualizar silenciosamente, use:
    // window.location.reload();
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_READY') {
      // TODO: mostrar UI de update; se usuário aceitar:
      // window.location.reload();
    }
  });

  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.error('Falha ao registrar Service Worker', err);
  });

  navigator.serviceWorker.ready.then(reg => reg.update());
  navigator.serviceWorker.getRegistrations().then(async regs => {
    for (const r of regs) {
      if (!r.active || (r.active && !r.active.scriptURL.endsWith('/sw.js'))) {
        try { await r.unregister(); } catch {}
      }
    }
  });
}
