// public/js/app.js

export function unregisterSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => {
        for (const registration of registrations) {
          registration.unregister();
        }
      })
      .catch(err => {
        console.error('Falha ao desregistrar Service Worker', err);
      });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  unregisterSW();
});
