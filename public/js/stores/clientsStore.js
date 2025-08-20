const KEY = 'agro.clients';

export function getClients() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addClient(client) {
  const clients = getClients();
  const now = new Date().toISOString();
  const newClient = {
    id: Date.now().toString(36),
    createdAt: now,
    updatedAt: now,
    ...client
  };
  clients.push(newClient);
  localStorage.setItem(KEY, JSON.stringify(clients));
  return newClient;
}
