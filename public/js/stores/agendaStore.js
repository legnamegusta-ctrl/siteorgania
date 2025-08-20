const KEY = 'agro.agenda';

export function getAgenda() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addAgenda(item) {
  const agenda = getAgenda();
  const newItem = {
    id: Date.now().toString(36),
    ...item
  };
  agenda.push(newItem);
  localStorage.setItem(KEY, JSON.stringify(agenda));
  return newItem;
}

export function updateAgenda(id, changes) {
  const agenda = getAgenda();
  const idx = agenda.findIndex((a) => a.id === id);
  if (idx >= 0) {
    agenda[idx] = {
      ...agenda[idx],
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(agenda));
    return agenda[idx];
  }
  return null;
}
