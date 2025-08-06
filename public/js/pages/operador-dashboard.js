// public/js/pages/operador-dashboard.js

// Helper para anexar listeners apenas se o elemento existir
function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

// Export de inicialização (usado por auth.js)
export function initOperadorDashboard(userId, userRole) {
  updateConnection();
  bindUI();
  fetchData();
}

// Estado global da tela
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

// Base da API: sempre same-origin para usar o rewrite do Firebase Hosting
const API_BASE = '';  // chama /api/** na mesma origem

// Abre modal
function openModal(el) {
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('flex');
}

// Fecha modal
function closeModal(el) {
  if (!el) return;
  el.classList.add('hidden');
  el.classList.remove('flex');
}

// Atualiza status de conexão
function updateConnection() {
  const el = document.getElementById('cardConexao');
  if (el) el.textContent = navigator.onLine ? 'Online' : 'Offline';
}

// Busca ordens e tarefas, e depois agenda
async function fetchData() {
  try {
    const [ordens, tarefas] = await Promise.all([
      fetch(`${API_BASE}/api/ordens`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/tarefas`).then(r => r.ok ? r.json() : [])
    ]);
    state.orders = Array.isArray(ordens) ? ordens : [];
    state.tasks  = Array.isArray(tarefas) ? tarefas : [];

    updateCards();
    renderTable();
    renderChart();
    await loadAgenda();
  } catch (e) {
    console.error('Erro ao buscar dados:', e);
  }
}

// Atualiza os cards de estatísticas
function updateCards() {
  const pendentesEl = document.getElementById('cardPendentes');
  if (pendentesEl) {
    pendentesEl.textContent = state.orders.filter(o => o.status === 'pendente').length;
  }

  const tarefasEl = document.getElementById('cardTarefas');
  if (tarefasEl) {
    tarefasEl.textContent = state.tasks.length;
  }

  const agronomoEl = document.getElementById('cardAgronomo');
  if (agronomoEl) {
    agronomoEl.textContent = state.tasks.filter(t => t.origem === 'agronomo').length;
  }
}

// Renderiza a tabela de tarefas
function renderTable() {
  const tbody = document.getElementById('tasksTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const start = (state.currentPage - 1) * state.pageSize;
  state.tasks.slice(start, start + state.pageSize).forEach(t => {
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="px-2 py-1">${t.id||''}</td>
      <td class="px-2 py-1">${t.talhao||'-'}</td>
      <td class="px-2 py-1">${t.origem||'-'}</td>
      <td class="px-2 py-1">${t.data||t.dueDate||'-'}</td>
      <td class="px-2 py-1">${t.status||'-'}</td>
      <td class="px-2 py-1 space-x-2">
        <button class="text-blue-600 hover:underline" data-edit="${t.id}">Editar</button>
        <button class="text-green-600 hover:underline" data-complete="${t.id}">Concluir</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// Renderiza gráfico de tarefas com Chart.js
function renderChart() {
  const ctxEl = document.getElementById('tasksChart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  const today = new Date();
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 6 + i);
    return d;
  });
  const labels = days.map(d => d.toLocaleDateString('pt-BR', { weekday: 'short' }));
  const completed = days.map(d => {
    const ds = d.toISOString().split('T')[0];
    return state.tasks.filter(t =>
      t.status === 'concluida' && (t.data === ds || t.dueDate === ds)
    ).length;
  });
  const pending = days.map(d => {
    const ds = d.toISOString().split('T')[0];
    return state.tasks.filter(t =>
      t.status !== 'concluida' && (t.data === ds || t.dueDate === ds)
    ).length;
  });
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Concluídas', data: completed },
      { label: 'Pendentes',  data: pending }
    ]},
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// Busca agenda mensal e renderiza
async function loadAgenda() {
  const m = state.currentMonth;
  const mes = `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`;
  try {
    const res = await fetch(`${API_BASE}/api/agenda?mes=${mes}`);
    state.agenda = res.ok ? await res.json() : {};
  } catch {
    state.agenda = {};
  }
  renderCalendar();
}

// Renderiza calendário
function renderCalendar() {
  const table = document.getElementById('calendarTable');
  if (!table) return;
  table.innerHTML = '';
  const y = state.currentMonth.getFullYear();
  const m = state.currentMonth.getMonth();
  const first = new Date(y, m, 1), fw = first.getDay();
  const dim = new Date(y, m+1, 0).getDate();

  const header = document.createElement('tr');
  ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(d => {
    const th = document.createElement('th');
    th.className = 'p-1 text-xs';
    th.textContent = d;
    header.appendChild(th);
  });
  table.appendChild(header);

  let row = document.createElement('tr');
  for (let i = 0; i < fw; i++) row.appendChild(document.createElement('td'));
  for (let day = 1; day <= dim; day++) {
    if ((fw + day - 1) % 7 === 0) {
      table.appendChild(row);
      row = document.createElement('tr');
    }
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const count = state.agenda[ds]?.length || 0;
    const td = document.createElement('td');
    td.className = 'p-1 border cursor-pointer hover:bg-green-100';
    td.dataset.date = ds;
    td.innerHTML = `
      <div class="text-xs">${day}</div>
      ${count ? `<div class="text-xs text-green-600">${count}</div>` : ''}
    `;
    row.appendChild(td);
  }
  table.appendChild(row);

  const monthLabelEl = document.getElementById('monthLabel');
  if (monthLabelEl) {
    monthLabelEl.textContent = state.currentMonth.toLocaleDateString('pt-BR', {
      month: 'long', year: 'numeric'
    });
  }
}

// Função para preview das fotos na modal de conclusão
function previewPhotos() {
  const preview = document.getElementById('photoPreview');
  if (!preview) return;
  preview.innerHTML = '';
  const files = document.getElementById('completeTaskPhotos').files || [];
  Array.from(files).slice(0,3).forEach(f => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    img.className = 'h-16 w-16 object-cover rounded';
    preview.appendChild(img);
  });
}

// Liga todos os listeners de UI
function bindUI() {
  on('openNewTaskBtn',     'click',   () => openModal(document.getElementById('newTaskModal')));
  on('cancelNewTask',      'click',   () => closeModal(document.getElementById('newTaskModal')));
  on('newTaskForm',        'submit',  submitNewTask);
  on('cancelCompleteTask', 'click',   () => closeModal(document.getElementById('completeTaskModal')));
  on('completeTaskForm',   'submit',  submitCompleteTask);
  on('completeTaskPhotos', 'change',  previewPhotos);
  on('closeDailyAgenda',   'click',   () => closeModal(document.getElementById('dailyAgendaModal')));
  on('prevPageBtn',        'click',   () => {
    if (state.currentPage > 1) { state.currentPage--; renderTable(); }
  });
  on('nextPageBtn',        'click',   () => {
    const total = Math.ceil(state.tasks.length / state.pageSize);
    if (state.currentPage < total) { state.currentPage++; renderTable(); }
  });
  document.getElementById('tasksTableBody')?.addEventListener('click', e => {
    const idComplete = e.target.dataset.complete;
    if (idComplete) {
      state.currentTask = state.tasks.find(t => String(t.id) === String(idComplete));
      openModal(document.getElementById('completeTaskModal'));
    }
  });
  document.getElementById('calendarTable')?.addEventListener('click', e => {
    const cell = e.target.closest('td[data-date]');
    if (cell) openDailyAgenda(cell.dataset.date);
  });
  on('prevMonth','click', () => { state.currentMonth.setMonth(state.currentMonth.getMonth()-1); loadAgenda(); });
  on('nextMonth','click', () => { state.currentMonth.setMonth(state.currentMonth.getMonth()+1); loadAgenda(); });
  window.addEventListener('online',  updateConnection);
  window.addEventListener('offline', updateConnection);
}

// Envia nova tarefa
async function submitNewTask(e) {
  e.preventDefault();
  const body = {
    talhao:      document.getElementById('newTaskPlot')?.value,
    tipo:        document.getElementById('newTaskType')?.value,
    responsavel: document.getElementById('newTaskResp')?.value,
    prazo:       document.getElementById('newTaskDeadline')?.value,
    prioridade:  document.getElementById('newTaskPriority')?.value
  };
  await fetch(`${API_BASE}/api/tarefas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  closeModal(document.getElementById('newTaskModal'));
  fetchData();
}

// Envia conclusão de tarefa
async function submitCompleteTask(e) {
  e.preventDefault();
  if (!state.currentTask) return;
  const form = new FormData();
  form.append('observacoes', document.getElementById('completeTaskObs')?.value || '');
  Array.from(document.getElementById('completeTaskPhotos').files || [])
    .slice(0,3)
    .forEach(f => form.append('fotos', f));
  await fetch(`${API_BASE}/api/tarefas/${state.currentTask.id}/concluir`, {
    method: 'PATCH',
    body: form
  });
  closeModal(document.getElementById('completeTaskModal'));
  fetchData();
}
