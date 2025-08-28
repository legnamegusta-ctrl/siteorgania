// public/js/app.js

import { messaging } from './config/firebase.js';
import { getToken, onMessage } from '/vendor/firebase/9.6.1/firebase-messaging.js';

if ('serviceWorker' in navigator) {
  // sem reload automático em controllerchange

  navigator.serviceWorker
    .register('/sw.js')
    .then(async (registration) => {
      try { await registration.update?.(); } catch {}
      // Pré-aquece módulos críticos para funcionar offline após reabrir
      try {
        const warm = [
          // Firebase ESM (vendorizados localmente para offline robusto)
          '/vendor/firebase/9.6.0/firebase-app.js',
          '/vendor/firebase/9.6.0/firebase-auth.js',
          '/vendor/firebase/9.6.0/firebase-firestore.js',
          '/vendor/firebase/9.6.1/firebase-messaging.js',
        ];
        await Promise.all(warm.map((u) => fetch(u).catch(() => {})));
      } catch {}

      if (messaging) {
        const vapidKey = window.FCM_VAPID_PUBLIC_KEY || undefined;
        try {
          await getToken(messaging, { serviceWorkerRegistration: registration, vapidKey });
        } catch (err) {
          console.error('[FCM] getToken error:', err);
        }
      } else {
        console.warn('[FCM] messaging não suportado; getToken não será chamado.');
      }
    })
    .catch((err) => {
      console.error('Falha ao registrar Service Worker', err);
    });

  // Limpeza 1x de SWs antigos que não sejam /sw.js
  navigator.serviceWorker.getRegistrations?.().then((regs) => {
    regs.forEach((r) => {
      const url = r.active?.scriptURL || '';
      if (url && !url.endsWith('/sw.js')) {
        r.unregister().catch(() => {});
      }
    });
  });

  // Diagnóstico leve para depuração
  window.__sw_debug_once__ ||
    (window.__sw_debug_once__ = (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations?.();
        console.log('[SW DEBUG] Registrations:', regs?.map((r) => r.active?.scriptURL || r.scriptURL));
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[SW DEBUG] controllerchange fired — sem reload automático.');
        });
      } catch (e) {
        console.warn('[SW DEBUG] erro:', e);
      }
    })());

  if (messaging) {
    onMessage(messaging, (payload) => {
      console.debug('[FCM] onMessage foreground:', payload);
    });
  }
}


