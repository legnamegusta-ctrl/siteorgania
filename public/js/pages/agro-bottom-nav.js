export function initBottomNav() {
  const buttons = document.querySelectorAll('#bottomBar button');

  function setActive(hash) {
    const target = hash || '#home';
    buttons.forEach((b) => {
      if (b.dataset.nav === target) {
        b.classList.add('active');
        b.setAttribute('aria-current', 'page');
      } else {
        b.classList.remove('active');
        b.removeAttribute('aria-current');
      }
    });
  }

  buttons.forEach((b) => {
    if (b.dataset.nav) {
      b.addEventListener('click', () => {
        location.hash = b.dataset.nav;
      });
    }
  });

  window.addEventListener('hashchange', () => setActive(location.hash));
  if (!location.hash) location.hash = '#home';
  setActive(location.hash);
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
