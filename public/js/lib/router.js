// Simple hash router used by a few views inside single pages.
// It now includes a recursion guard to avoid accidental
// `hashchange` loops when `location.hash` is updated from
// inside the handler.

let currentHash = '';
let isNavigating = false;

if (!window.__pageScripts) {
  window.__pageScripts = new Set();
}

export function handleHashChange(hash = window.location.hash, doc = document) {
  if (isNavigating) return;
  if (hash === currentHash) return;

  isNavigating = true;
  try {
    currentHash = hash;
    const dash = doc.getElementById('dashboard');
    const order = doc.getElementById('order-view');
    const task = doc.getElementById('task-view');
    [dash, order, task].forEach(el => el && el.classList.add('hidden'));

    if (hash.startsWith('#order/')) {
      if (order) order.classList.remove('hidden');
    } else if (hash.startsWith('#task/')) {
      if (task) task.classList.remove('hidden');
    } else {
      if (dash) dash.classList.remove('hidden');
    }
  } finally {
    isNavigating = false;
  }
}

// Dynamically injects a script only once per page.
export function loadScriptOnce(src, doc = document) {
  if (!src) return;
  if (window.__pageScripts.has(src)) return;
  window.__pageScripts.add(src);
  const s = doc.createElement('script');
  s.src = src;
  s.type = 'module';
  doc.head.appendChild(s);
}
