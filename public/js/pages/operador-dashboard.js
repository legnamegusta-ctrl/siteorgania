// Base da sua Cloud Function “api”
const API_BASE_URL = 'https://us-central1-app-organia.cloudfunctions.net/api';

function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

const state = {
  items: [],
  currentPage: 1,
  pageSize: 8,
  chart: null
};

export async function initOperadorDashboard(userId) {
  bindUI();
  await fetchData(userId);
}

function bindUI() {
  on('logoutBtn', 'click', () => window.logout());
  on('prevPageBtn', 'click', () => changePage(-1));
  on('nextPageBtn', 'click', () => changePage(1));
}

async function fetchData(userId) {
  try {
    const [tarefasRes, ordensRes] = await Promise.all([
      fetch(`${API_BASE_URL}/tarefas?role=operador&userId=${userId}`),
      fetch(`${API_BASE_URL}/ordens?role=operador&userId=${userId}`)
    ]);
    const tarefas = await tarefasRes.json();
    const ordens  = await ordensRes.json();

    const taggedTasks  = tarefas.map(t => ({ ...t, origem: 'Tarefa', data: t.dueDate || t.data }));
    const taggedOrders = ordens .map(o => ({ ...o, origem: 'Ordem',  data: o.data    || o.dueDate }));

    state.items = [...taggedOrders, ...taggedTasks];
    renderMetrics();
    renderTasksChart();
    renderTable();
  } catch (err) {
    console.error('Erro ao buscar dados:', err);
  }
}

function renderMetrics() {
  const total = state.items.length;
  const pending = state.items.filter(i => (i.status||'pendente') === 'pendente').length;
  const completed = state.items.filter(i => (i.status||'pendente') !== 'pendente').length;

  document.getElementById('totalOrders').textContent    = total;
  document.getElementById('totalPending').textContent   = pending;
  document.getElementById('totalCompleted').textContent = completed;
}

function renderTasksChart() {
  const ctx = document.getElementById('tasksChart').getContext('2d');
  const counts = state.items.reduce((acc, { status }) => {
    const st = (status || 'pendente');
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  const labels = Object.keys(counts);
  const data   = labels.map(l => counts[l]);

  if (state.chart) {
    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = data;
    state.chart.update();
  } else {
    state.chart = new Chart(ctx, {
      type: 'pie',
      data: { labels, datasets: [{ data }] },
      options: { responsive: true }
    });
  }
}

function renderTable() {
  const tbody = document.getElementById('tasksTableBody');
  const empty = document.getElementById('emptyState');
  const start = (state.currentPage - 1) * state.pageSize;
  const pageItems = state.items.slice(start, start + state.pageSize);

  tbody.innerHTML = '';
  if (pageItems.length === 0) {
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    pageItems.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2">${item.id}</td>
        <td class="px-3 py-2">${item.talhao || '-'}</td>
        <td class="px-3 py-2">${item.origem}</td>
        <td class="px-3 py-2">${item.data?.split('T')[0] || '-'}</td>
        <td class="px-3 py-2 capitalize">${item.status || 'pendente'}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function changePage(delta) {
  const maxPage = Math.ceil(state.items.length / state.pageSize) || 1;
  state.currentPage = Math.min(Math.max(1, state.currentPage + delta), maxPage);
  renderTable();
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('operador-dashboard-marker') && window.auth) {
    window.auth.onAuthStateChanged(user => {
      if (user) initOperadorDashboard(user.uid);
      else        window.location.href = 'login.html';
    });
  }
});
