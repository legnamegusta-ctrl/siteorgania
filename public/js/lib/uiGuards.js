export function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function throttle(fn, wait) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    }
  };
}

export function antiDuplicate(fn) {
  let running = false;
  return async function(...args) {
    if (running) return;
    running = true;
    try { return await fn.apply(this, args); }
    finally { running = false; }
  };
}
