const KEY = 'agro.visits';

export function getVisits() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addVisit(visit) {
  const visits = getVisits();
  const newVisit = {
    id: Date.now().toString(36),
    ...visit
  };
  visits.push(newVisit);
  localStorage.setItem(KEY, JSON.stringify(visits));
  return newVisit;
}
