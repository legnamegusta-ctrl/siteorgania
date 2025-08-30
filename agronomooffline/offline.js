import { syncClientsFromFirestore } from '../public/js/stores/clientsStore.js';
import { syncLeadsFromFirestore } from '../public/js/stores/leadsStore.js';
import { syncAgendaFromFirestore } from '../public/js/stores/agendaStore.js';
import { getVisits } from '../public/js/stores/visitsStore.js';

function handleImport(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.clients) localStorage.setItem('agro.clients', JSON.stringify(data.clients));
      if (data.leads) localStorage.setItem('agro.leads', JSON.stringify(data.leads));
      if (data.agenda) localStorage.setItem('agro.agenda', JSON.stringify(data.agenda));
      if (data.visits) localStorage.setItem('agro.visits', JSON.stringify(data.visits));
      alert('Dados importados com sucesso.');
    } catch (err) {
      console.error('Falha ao importar', err);
      alert('Falha ao importar dados.');
    }
  };
  reader.readAsText(file);
}

async function exportToFirebase() {
  if (!navigator.onLine) {
    alert('Sem conexão.');
    return;
  }
  try {
    await Promise.all([
      syncClientsFromFirestore(),
      syncLeadsFromFirestore(),
      syncAgendaFromFirestore(),
      getVisits(),
    ]);
    alert('Exportado com sucesso.');
  } catch (err) {
    console.error('Erro ao exportar', err);
    alert('Falha ao exportar.');
  }
}

const importBtn = document.getElementById('importOfflineBtn');
const importInput = document.getElementById('importOfflineInput');
const exportBtn = document.getElementById('exportFirebaseBtn');

importBtn?.addEventListener('click', () => importInput?.click());
importInput?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleImport(file);
});
exportBtn?.addEventListener('click', exportToFirebase);
