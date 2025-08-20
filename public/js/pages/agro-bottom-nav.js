export function initBottomNav() {
  const views = document.querySelectorAll('#agroMain [data-view]');
  const buttons = document.querySelectorAll('#bottomBar button');

  function show(hash) {
    const target = hash || '#home';
    views.forEach((v) => v.classList.add('hidden'));
    const id = `view-${target.replace('#','')}`;
    document.getElementById(id)?.classList.remove('hidden');
    buttons.forEach((b) => {
      if (b.dataset.nav === target) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  buttons.forEach((b) => {
    if (b.dataset.nav) {
      b.addEventListener('click', () => {
        location.hash = b.dataset.nav;
      });
    }
  });

  window.addEventListener('hashchange', () => show(location.hash));
  if (!location.hash) location.hash = '#home';
  show(location.hash);
}

export function bindPlus(handler) {
  const btn = document.getElementById('navPlus');
  btn?.addEventListener('click', handler);
}

export function toggleModal(el, open) {
  if (!el) return;
  el.classList.toggle('hidden', !open);
}
