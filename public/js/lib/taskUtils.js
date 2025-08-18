export function classifyStatus({ dueISO, completedAtISO }, now = new Date()) {
  if (completedAtISO) return 'Concluída';
  const tz = 'America/Sao_Paulo';
  const due = dueISO ? new Date(new Date(dueISO).toLocaleString('en-US', { timeZone: tz })) : null;
  const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const y = todayParts.find(p=>p.type==='year').value;
  const m = todayParts.find(p=>p.type==='month').value;
  const d = todayParts.find(p=>p.type==='day').value;
  const today = new Date(`${y}-${m}-${d}T00:00:00`);
  if (!due) return 'Pendente';
  if (due < today) return 'Atrasada';
  return 'Pendente';
}

export function formatDateLocal(iso, tz='America/Sao_Paulo') {
  if (!iso) return '';
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: tz }));
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth()+1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function normalizeTask(t = {}) {
  const { id, title, dueISO, completedAtISO, orderId, orderCode, source } = t;
  return { id, title, dueISO, completedAtISO, orderId, orderCode, source };
}

export function sortTasks(tasks = [], now = new Date()) {
  const order = { 'Atrasada': 0, 'Pendente': 1, 'Concluída': 2 };
  return [...tasks].sort((a, b) => {
    const sa = order[classifyStatus(a, now)];
    const sb = order[classifyStatus(b, now)];
    if (sa !== sb) return sa - sb;
    const da = a.dueISO ? new Date(a.dueISO).getTime() : 0;
    const db = b.dueISO ? new Date(b.dueISO).getTime() : 0;
    return da - db;
  });
}

export function dedupeTasks(tasks = []) {
  const map = new Map();
  tasks.forEach(t => { if (t && t.id && !map.has(t.id)) map.set(t.id, t); });
  return Array.from(map.values());
}

export function antiDuplicate(fn) {
  let running = false;
  return async function(...args) {
    if (running) return;
    running = true;
    try {
      return await fn.apply(this, args);
    } finally {
      running = false;
    }
  };
}
