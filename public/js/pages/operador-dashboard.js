const API_BASE_URL = 'https://us-central1-app-organia.cloudfunctions.net/api';

function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

const state = {
  items: [],
  filter: 'todas',
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
  on('filterSelect', 'change', e => {
    state.filter = e.target.value;
    state.currentPage = 1;
    renderAll();
  });
  on('prevPageBtn', 'click', () => changePage(-1));
  on('nextPageBtn', 'click', () => changePage(1));
  on('createTaskBtn', 'click', () => showModal(true));
  on('cancelTaskBtn', 'click', () => showModal(false));
  on('taskForm', 'submit', createTask);
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
    renderAll();
  } catch (err) {
    console.error('Erro ao buscar dados:', err);
  }
}

function renderAll() {
  renderMetrics();
  renderTasksChart();
  renderTable();
}

function renderMetrics() {
  const filtered = applyFilter(state.items);
  const total = filtered.length;
  const pending = filtered.filter(i => (i.status || 'pendente') === 'pendente').length;
  const completed = filtered.filter(i => (i.status || 'pendente') !== 'pendente').length;

  document.getElementById('totalOrders').textContent    = total;
  document.getElementById('totalPending').textContent   = pending;
  document.getElementById('totalCompleted').textContent = completed;
}

function applyFilter(items) {
  const now = new Date();
  return items.filter(i => {
    const status = (i.status || 'pendente').toLowerCase();
    const date   = new Date(i.data);
    const overdue = date < now && status !== 'concluída';

    switch (state.filter) {
      case 'pendentes':  return status === 'pendente';
      case 'concluidas': return status === 'concluída';
      case 'atrasadas':  return overdue;
      default:           return true;
    }
  });
}

function renderTasksChart() {
  const counts = applyFilter(state.items).reduce((acc, { status }) => {
    const st = (status || 'pendente');
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});
  const labels = Object.keys(counts);
  const data   = labels.map(l => counts[l]);

  const ctx = document.getElementById('tasksChart').getContext('2d');
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
  const filtered = applyFilter(state.items);
  const start = (state.currentPage - 1) * state.pageSize;
  const pageItems = filtered.slice(start, start + state.pageSize);

  tbody.innerHTML = '';
  if (!pageItems.length) {
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
  const filtered = applyFilter(state.items);
  const maxPage = Math.ceil(filtered.length / state.pageSize) || 1;
  state.currentPage = Math.min(Math.max(1, state.currentPage + delta), maxPage);
  renderTable();
}

function showModal(show) {
  document.getElementById('taskModal').classList.toggle('hidden', !show);
}

async function createTask(e) {
  e.preventDefault();
  const desc   = document.getElementById('taskDesc').value;
  const talhao = document.getElementById('taskTalhao').value;
  const date   = document.getElementById('taskDate').value;
  try {
    await fetch(`${API_BASE_URL}/tarefas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descricao: desc, talhao, dueDate: date })
    });
    showModal(false);
    await fetchData(window.auth.currentUser.uid);
  } catch (err) {
    console.error('Erro ao criar tarefa:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.auth && document.getElementById('operador-dashboard-marker')) {
    window.auth.onAuthStateChanged(user => {
      if (user) initOperadorDashboard(user.uid);
      else       window.location.href = 'login.html';
    });
  }
});
