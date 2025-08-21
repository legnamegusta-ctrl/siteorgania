const KEY = 'agro.leads';

export function getLeads() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addLead(lead) {
  const leads = getLeads();
  const now = new Date().toISOString();
  const newLead = {
    id: Date.now().toString(36),
    createdAt: now,
    updatedAt: now,
    stage: 'Novo',
    interest: 'Na dúvida',
    lastVisitAt: null,
    nextAction: null,
    syncFlag: true,
    ...lead
  };
  leads.push(newLead);
  localStorage.setItem(KEY, JSON.stringify(leads));
  return newLead;
}

export function updateLead(id, changes) {
  const leads = getLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx >= 0) {
    leads[idx] = { ...leads[idx], ...changes, updatedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(leads));
    return leads[idx];
  }
  return null;
}
