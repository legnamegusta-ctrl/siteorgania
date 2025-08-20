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
    lastVisitAt: null,
    nextAction: null,
    syncFlag: true,
    ...lead
  };
  leads.push(newLead);
  localStorage.setItem(KEY, JSON.stringify(leads));
  return newLead;
}
