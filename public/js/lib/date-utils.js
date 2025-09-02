export function toYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDDMMYYYY(date) {
  return date.toLocaleDateString('pt-BR');
}

export function parseDateLocal(v) {
  if (!v) return null;
  if (typeof v === 'object' && typeof v.toDate === 'function') {
    return v.toDate();
  }
  if (typeof v === 'string') {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(v);
}

export function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function nowBrasiliaISO() {
  const tz = 'America/Sao_Paulo';
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const offsetMatch = now
    .toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' })
    .match(/GMT([+-]\d{1,2})/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;
  const sign = offsetHours >= 0 ? '+' : '-';
  const offset = `${sign}${String(Math.abs(offsetHours)).padStart(2, '0')}:00`;
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}${offset}`;
}

export function nowBrasiliaLocal() {
  const tz = 'America/Sao_Paulo';
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

