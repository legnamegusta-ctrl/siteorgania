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
  currentDate: new Date(),
  currentTask: null,
  chart: null,
  currentFilter: 'todas',
  agendaView: 'mes'
};

// Carrega dados salvos ou cria valores de exemplo
function loadLocalData() {
  try {
    const saved = JSON.parse(localStorage.getItem('operadorDashboard'));
    if (saved) {
      state.tasks = saved.tasks || [];
      state.orders = saved.orders || [];
      state.agenda = saved.agenda || {};
    } else {
      // dados iniciais de demonstração
      const today = new Date().toISOString().slice(0,10);
      state.orders = [{ id: 1, status: 'pendente' }];
      state.tasks = [{ id: 1, talhao: 'Talhão 1', origem: 'agronomo', data: today, status: 'pendente' }];
      state.agenda = { [today]: [{ titulo: 'Tarefa inicial', id: 1 }] };
    }
  } catch {
    state.tasks = [];
    state.orders = [];
    state.agenda = {};
  }
}

function saveLocalData() {
  localStorage.setItem('operadorDashboard', JSON.stringify({
    tasks: state.tasks,
    orders: state.orders,
    agenda: state.agenda
  }));
}

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

// Carrega dados locais e atualiza a interface
async function fetchData() {
  loadLocalData();
  updateCards();
  renderTable();
  renderChart();
  await loadAgenda();
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
function getFilteredTasks() {
  const today = new Date().toISOString().split('T')[0];
  if (state.currentFilter === 'atrasadas') {
    return state.tasks.filter(t => t.status !== 'concluida' && (t.data || t.dueDate) < today);
  }
  if (state.currentFilter === 'pendentes') {
    return state.tasks.filter(t => t.status !== 'concluida' && (t.data || t.dueDate) >= today);
  }
  if (state.currentFilter === 'concluidas') {
    return state.tasks.filter(t => t.status === 'concluida');
  }
  return state.tasks;
}

// Renderiza a tabela de tarefas
function renderTable() {
  const tbody = document.getElementById('tasksTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const tasks = getFilteredTasks();
  const start = (state.currentPage - 1) * state.pageSize;
  tasks.slice(start, start + state.pageSize).forEach(t => {
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
  renderAgenda();
}

function renderAgenda() {
  if (state.agendaView === 'mes') return renderCalendar();
  if (state.agendaView === 'semana') return renderAgendaWeek();
  return renderAgendaDay();
}

function renderAgendaDay() {
  const container = document.getElementById('agendaContent');
  if (!container) return;
  container.innerHTML = '';
  const ds = state.currentDate.toISOString().split('T')[0];
  const ul = document.createElement('ul');
  ul.className = 'list-disc pl-4';
  (state.agenda[ds] || []).forEach(t => {
    const li = document.createElement('li');
    li.textContent = t.titulo || t.id;
    ul.appendChild(li);
  });
  if (!ul.childElementCount) {
    const li = document.createElement('li');
    li.textContent = 'Sem tarefas';
    ul.appendChild(li);
  }
  container.appendChild(ul);
  const label = document.getElementById('agendaLabel');
  if (label) label.textContent = state.currentDate.toLocaleDateString('pt-BR', { dateStyle: 'full' });
}

function renderAgendaWeek() {
  const container = document.getElementById('agendaContent');
  if (!container) return;
  container.innerHTML = '';
  const start = new Date(state.currentDate);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const ul = document.createElement('ul');
  ul.className = 'list-disc pl-4';
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const tasks = state.agenda[ds] || [];
    const li = document.createElement('li');
    li.innerHTML = `<strong>${d.toLocaleDateString('pt-BR',{ weekday:'short', day:'2-digit' })}</strong>: ${tasks.map(t => t.titulo || t.id).join(', ') || 'Sem tarefas'}`;
    ul.appendChild(li);
  }
  container.appendChild(ul);
  const label = document.getElementById('agendaLabel');
  if (label) {
    label.textContent = `${start.toLocaleDateString('pt-BR')} - ${end.toLocaleDateString('pt-BR')}`;
  }

} 

// Renderiza calendário
function renderCalendar() {
 const container = document.getElementById('agendaContent');
  if (!container) return;
  container.innerHTML = '<table id="calendarTable" class="w-full text-center text-sm"></table>';
  const table = container.querySelector('#calendarTable');
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

  const label = document.getElementById('agendaLabel');
  if (label) {
    label.textContent = state.currentMonth.toLocaleDateString('pt-BR', {
      month: 'long', year: 'numeric'
    });
  }
}

function openDailyAgenda(date) {
  const m = document.getElementById('dailyAgendaModal');
  const title = document.getElementById('dailyAgendaTitle');
  const list = document.getElementById('dailyAgendaList');
  if (!m || !title || !list) return;
  title.textContent = new Date(date).toLocaleDateString('pt-BR', { dateStyle: 'full' });
  list.innerHTML = '';
  (state.agenda[date] || []).forEach(t => {
    const li = document.createElement('li');
    li.textContent = t.titulo || t.id;
    list.appendChild(li);
  });
  m.classList.remove('hidden');
  m.classList.add('flex');
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
  on('taskStatusFilter',   'change', e => {
    state.currentFilter = e.target.value;
    state.currentPage = 1;
    renderTable();
  });
  on('prevPageBtn',        'click',   () => {
    if (state.currentPage > 1) { state.currentPage--; renderTable(); }
  });
  on('nextPageBtn',        'click',   () => {
    const total = Math.ceil(getFilteredTasks().length / state.pageSize);
    if (state.currentPage < total) { state.currentPage++; renderTable(); }
  });
  document.getElementById('tasksTableBody')?.addEventListener('click', e => {
    const idComplete = e.target.dataset.complete;
    if (idComplete) {
      state.currentTask = state.tasks.find(t => String(t.id) === String(idComplete));
      openModal(document.getElementById('completeTaskModal'));
    }
  });
document.getElementById('agendaContent')?.addEventListener('click', e => {
      const cell = e.target.closest('td[data-date]');
    if (cell) openDailyAgenda(cell.dataset.date);
  });
 on('agendaView','change', e => {
    state.agendaView = e.target.value;
    loadAgenda();
  });
  on('prevRange','click', () => {
    if (state.agendaView === 'mes') state.currentMonth.setMonth(state.currentMonth.getMonth()-1);
    else if (state.agendaView === 'semana') state.currentDate.setDate(state.currentDate.getDate()-7);
    else state.currentDate.setDate(state.currentDate.getDate()-1);
    loadAgenda();
  });
  on('nextRange','click', () => {
    if (state.agendaView === 'mes') state.currentMonth.setMonth(state.currentMonth.getMonth()+1);
    else if (state.agendaView === 'semana') state.currentDate.setDate(state.currentDate.getDate()+7);
    else state.currentDate.setDate(state.currentDate.getDate()+1);
    loadAgenda();
  });
    window.addEventListener('online',  updateConnection);
  window.addEventListener('offline', updateConnection);
}

// Envia nova tarefa
async function submitNewTask(e) {
  e.preventDefault();
const talhao = document.getElementById('newTaskPlot')?.value;
  const tipo = document.getElementById('newTaskType')?.value;
  const prazo = document.getElementById('newTaskDeadline')?.value;
  const task = {
    id: Date.now(),
    talhao,
    origem: 'manual',
    data: prazo,
    status: 'pendente'
  };
  state.tasks.push(task);
  if (prazo) {
    state.agenda[prazo] = state.agenda[prazo] || [];
    state.agenda[prazo].push({ titulo: tipo || 'Tarefa', id: task.id });
  }
  saveLocalData();
    closeModal(document.getElementById('newTaskModal'));
  fetchData();
}

// Envia conclusão de tarefa
async function submitCompleteTask(e) {
  e.preventDefault();
  if (!state.currentTask) return;
  state.currentTask.status = 'concluida';
  state.currentTask.observacoes = document.getElementById('completeTaskObs')?.value || '';
  saveLocalData();
    closeModal(document.getElementById('completeTaskModal'));
  fetchData();
}
