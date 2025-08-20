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
