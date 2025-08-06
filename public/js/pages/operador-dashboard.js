function initOperadorDashboard(userId, userRole) {
  updateConnection();
  bindUI();
  fetchData();
}

export { initOperadorDashboard };
const state = {
  tasks: [],
  orders: [],
  agenda: {},
  currentPage: 1,
  pageSize: 8,
  currentMonth: new Date(),
  currentTask: null,
  chart: null
};

// Define API base path. When running in Firebase hosting the backend lives
// on the Cloud Functions domain, otherwise use relative paths for local dev.
const API_BASE =
  window.location.hostname === 'localhost'
    ? ''
    : 'https://us-central1-app-organia.cloudfunctions.net';

function openModal(el) {
  el.classList.remove('hidden');
  el.classList.add('flex');
}

function closeModal(el) {
  el.classList.add('hidden');
  el.classList.remove('flex');
}

function updateConnection() {
  const el = document.getElementById('cardConexao');
  if (el) el.textContent = navigator.onLine ? 'Online' : 'Offline';
}

async function fetchData() {
  try {
    const [ordens, tarefas] = await Promise.all([
      fetch(`${API_BASE}/api/ordens`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/tarefas`).then(r => r.json()).catch(() => [])
    ]);
    state.orders = Array.isArray(ordens) ? ordens : [];
    state.tasks = Array.isArray(tarefas) ? tarefas : [];

    updateCards();
    renderTable();
    renderChart();
    await loadAgenda();
  } catch (e) {
    console.error(e);
  }
}

function updateCards() {
  const pendentes = state.orders.filter(o => o.status === 'pendente').length;
  const agronomo = state.tasks.filter(t => t.origem === 'agronomo').length;
  document.getElementById('cardPendentes').textContent = pendentes;
  document.getElementById('cardTarefas').textContent = state.tasks.length;
  document.getElementById('cardAgronomo').textContent = agronomo;
}

function renderTable() {
  const tbody = document.getElementById('tasksTableBody');
  tbody.innerHTML = '';
  const start = (state.currentPage - 1) * state.pageSize;
  const items = state.tasks.slice(start, start + state.pageSize);
  items.forEach(t => {
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="px-2 py-1">${t.id || ''}</td>
      <td class="px-2 py-1">${t.talhao || '-'}</td>
      <td class="px-2 py-1">${t.origem || '-'}</td>
      <td class="px-2 py-1">${t.data || t.dueDate || '-'}</td>
      <td class="px-2 py-1">${t.status || '-'}</td>
      <td class="px-2 py-1 space-x-2">
        <button class="text-blue-600 hover:underline" data-edit="${t.id}">Editar</button>
        <button class="text-green-600 hover:underline" data-complete="${t.id}">Concluir</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderChart() {
  const ctx = document.getElementById('tasksChart').getContext('2d');
  const today = new Date();
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 6 + i);
    return d;
  });
  const labels = days.map(d => d.toLocaleDateString('pt-BR', { weekday: 'short' }));
  const completed = days.map(d => {
    const dateStr = d.toISOString().split('T')[0];
    return state.tasks.filter(t => t.status === 'concluida' && (t.data === dateStr || t.dueDate === dateStr)).length;
  });
  const pending = days.map(d => {
    const dateStr = d.toISOString().split('T')[0];
    return state.tasks.filter(t => t.status !== 'concluida' && (t.data === dateStr || t.dueDate === dateStr)).length;
  });
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Concluídas', data: completed, backgroundColor: '#16a34a' },
        { label: 'Pendentes', data: pending, backgroundColor: '#dc2626' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

async function loadAgenda() {
  const mes = `${state.currentMonth.getFullYear()}-${String(state.currentMonth.getMonth() + 1).padStart(2, '0')}`;
  try {
    const res = await fetch(`${API_BASE}/api/agenda?mes=${mes}`);
    state.agenda = await res.json();
  } catch {
    state.agenda = {};
  }
  renderCalendar();
}

function renderCalendar() {
  const table = document.getElementById('calendarTable');
  table.innerHTML = '';
  const month = state.currentMonth.getMonth();
  const year = state.currentMonth.getFullYear();
  const first = new Date(year, month, 1);
  const firstWeekDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const header = document.createElement('tr');
  ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(d => {
    const th = document.createElement('th');
    th.className = 'p-1 text-xs';
    th.textContent = d;
    header.appendChild(th);
  });
  table.appendChild(header);
  let row = document.createElement('tr');
  for (let i = 0; i < firstWeekDay; i++) {
    row.appendChild(document.createElement('td'));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    if ((firstWeekDay + day - 1) % 7 === 0) {
      table.appendChild(row);
      row = document.createElement('tr');
    }
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const count = state.agenda[dateStr] ? state.agenda[dateStr].length : 0;
    const td = document.createElement('td');
    td.className = 'p-1 border cursor-pointer hover:bg-green-100';
    td.dataset.date = dateStr;
    td.innerHTML = `<div class="text-xs">${day}</div>${count ? `<div class="text-xs text-green-600">${count}</div>` : ''}`;
    row.appendChild(td);
  }
  table.appendChild(row);
  document.getElementById('monthLabel').textContent = state.currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function openDailyAgenda(date) {
  const list = state.agenda[date] || [];
  document.getElementById('dailyAgendaTitle').textContent = new Date(date).toLocaleDateString('pt-BR', { dateStyle: 'full' });
  const ul = document.getElementById('dailyAgendaList');
  ul.innerHTML = '';
  list.forEach(t => {
    const li = document.createElement('li');
    li.className = 'flex justify-between';
    li.innerHTML = `<span>${t.titulo || t.id}</span>
      <span class="space-x-2">
        <button class="text-blue-600 hover:underline" data-view="${t.id}">Ver</button>
        <button class="text-green-600 hover:underline" data-complete="${t.id}">Concluir</button>
        <button class="text-yellow-600 hover:underline" data-edit="${t.id}">Editar</button>
      </span>`;
    ul.appendChild(li);
  });
  openModal(document.getElementById('dailyAgendaModal'));
}

function previewPhotos() {
  const preview = document.getElementById('photoPreview');
  preview.innerHTML = '';
  Array.from(document.getElementById('completeTaskPhotos').files).slice(0, 3).forEach(file => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.className = 'h-16 w-16 object-cover rounded';
    preview.appendChild(img);
  });
}

async function submitNewTask(e) {
  e.preventDefault();
  const body = {
    talhao: document.getElementById('newTaskPlot').value,
    tipo: document.getElementById('newTaskType').value,
    responsavel: document.getElementById('newTaskResp').value,
    prazo: document.getElementById('newTaskDeadline').value,
    prioridade: document.getElementById('newTaskPriority').value
  };
  await fetch(`${API_BASE}/api/tarefas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  closeModal(document.getElementById('newTaskModal'));
  fetchData();
}

async function submitCompleteTask(e) {
  e.preventDefault();
  if (!state.currentTask) return;
  const form = new FormData();
  form.append('observacoes', document.getElementById('completeTaskObs').value);
  Array.from(document.getElementById('completeTaskPhotos').files).slice(0, 3).forEach(f => form.append('fotos', f));
  await fetch(`${API_BASE}/api/tarefas/${state.currentTask.id}/concluir`, {
    method: 'PATCH',
    body: form
  });
  closeModal(document.getElementById('completeTaskModal'));
  fetchData();
}

function bindUI() {
  document.getElementById('openNewTaskBtn').addEventListener('click', () => openModal(document.getElementById('newTaskModal')));
  document.getElementById('cancelNewTask').addEventListener('click', () => closeModal(document.getElementById('newTaskModal')));
  document.getElementById('newTaskForm').addEventListener('submit', submitNewTask);

  document.getElementById('cancelCompleteTask').addEventListener('click', () => closeModal(document.getElementById('completeTaskModal')));
  document.getElementById('completeTaskForm').addEventListener('submit', submitCompleteTask);
  document.getElementById('completeTaskPhotos').addEventListener('change', previewPhotos);

  document.getElementById('closeDailyAgenda').addEventListener('click', () => closeModal(document.getElementById('dailyAgendaModal')));

  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderTable();
    }
  });
  document.getElementById('nextPageBtn').addEventListener('click', () => {
    const total = Math.ceil(state.tasks.length / state.pageSize);
    if (state.currentPage < total) {
      state.currentPage++;
      renderTable();
    }
  });

  document.getElementById('tasksTableBody').addEventListener('click', e => {
    if (e.target.dataset.complete) {
      const id = e.target.dataset.complete;
      state.currentTask = state.tasks.find(t => String(t.id) === String(id));
      document.getElementById('completeTaskInfo').textContent = `${state.currentTask.id} - ${state.currentTask.talhao || ''}`;
      openModal(document.getElementById('completeTaskModal'));
    }
  });

  document.getElementById('calendarTable').addEventListener('click', e => {
    const cell = e.target.closest('td[data-date]');
    if (cell) openDailyAgenda(cell.dataset.date);
  });

  document.getElementById('prevMonth').addEventListener('click', () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
    loadAgenda();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
    loadAgenda();
  });

  document.getElementById('openSidebarBtn').addEventListener('click', () => {
    openModal(document.getElementById('mobileSidebar'));
  });
  document.getElementById('closeMobileMenu').addEventListener('click', () => {
    closeModal(document.getElementById('mobileSidebar'));
  });
  document.getElementById('closeSidebarBtn').addEventListener('click', () => {
    closeModal(document.getElementById('mobileSidebar'));
  });

  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
}

document.addEventListener('DOMContentLoaded', () => {
  updateConnection();
  bindUI();
  fetchData();
});
