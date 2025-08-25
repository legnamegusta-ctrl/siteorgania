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

let lastFocusedElement;
let currentModal;
let focusableElements = [];

function handleKeydown(e) {
  if (!currentModal) return;
  if (e.key === 'Escape') {
    toggleModal(currentModal, false);
  } else if (e.key === 'Tab') {
    if (focusableElements.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}

export function toggleModal(el, open) {
  if (!el) return;
  if (open) {
    lastFocusedElement = document.activeElement;
    currentModal = el;
    el.classList.remove('hidden');
    focusableElements = el.querySelectorAll(
      'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements[0]?.focus();
    document.addEventListener('keydown', handleKeydown);
  } else {
    el.classList.add('hidden');
    document.removeEventListener('keydown', handleKeydown);
    currentModal = null;
    focusableElements = [];
    lastFocusedElement?.focus();
  }
}
