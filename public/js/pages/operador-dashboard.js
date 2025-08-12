import { db } from '../config/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";

let state = {
  farmClientId: null,
  plots: [],
  allTasks: [],
  filteredTasks: [],
  filter: 'todas',
  currentPage: 1,
  pageSize: 8,
  chart: null,
  sevenChart: null
};

export async function initOperadorDashboard(userId) {
  await loadFarmId(userId);
  bindUI();
  await loadPlots();
  await fetchAndRenderTasks();
}

async function loadFarmId(userId) {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    state.farmClientId = snap.data()?.farmClientId || null;
  } catch (e) {
    console.error('Erro ao obter farmClientId do operador', e);
  }
}

async function loadPlots() {
  if (!state.farmClientId) return;
  state.plots = [];
 const propsSnap = await getDocs(collection(db, 'clients', state.farmClientId, 'properties'));
    for (const prop of propsSnap.docs) {
      const plotsSnap = await getDocs(collection(db, `clients/${state.farmClientId}/properties/${prop.id}/plots`));
      plotsSnap.forEach(p => {
        state.plots.push({
          path: p.ref.path,
          name: p.data().name,
          propertyId: prop.id,
          plotId: p.id
        });
      });
    }
    const select = document.getElementById('taskTalhao');
    if (select) {
      select.innerHTML = state.plots
        .map(pl => `<option value="${pl.path}" data-property-id="${pl.propertyId}" data-plot-id="${pl.plotId}">${pl.name}</option>`)
        .join('');
    }
  }

function bindUI() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => window.logout());
  document.getElementById('filterSelect')?.addEventListener('change', e => {
    state.filter = e.target.value;
    state.currentPage = 1;
    filterAndRender();
  });
  document.getElementById('prevPageBtn')?.addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderTable();
    }
  });
  document.getElementById('nextPageBtn')?.addEventListener('click', () => {
    const maxPage = Math.ceil(state.filteredTasks.length / state.pageSize) || 1;
    if (state.currentPage < maxPage) {
      state.currentPage++;
      renderTable();
    }
  });
  document.getElementById('createTaskBtn')?.addEventListener('click', () => showModal(true));
  document.getElementById('cancelTaskBtn')?.addEventListener('click', () => showModal(false));
  document.getElementById('taskForm')?.addEventListener('submit', createTask);
}

async function fetchAndRenderTasks() {
  if (!state.farmClientId) return;
  const snap = await getDocs(collection(db, 'clients', state.farmClientId, 'tasks'));
  state.allTasks = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    _ref: d.ref
  }));
  filterAndRender();
}

  function filterAndRender() {
    const now = new Date();
    state.filteredTasks = state.allTasks.filter(t => {
      const isCompleted = !!t.isCompleted;
      const due = new Date(t.dueDate);
      if (state.filter === 'pendentes') return !isCompleted && due >= now;
      if (state.filter === 'concluidas') return isCompleted;
      if (state.filter === 'atrasadas') return !isCompleted && due < now;
      return true;
    });
    state.currentPage = 1;
    renderTable();
    renderMetrics();
    renderChart();
    render7DaysChart();
  }

function renderTable() {
  const tbody = document.getElementById('tasksTableBody');
  const empty = document.getElementById('emptyState');
  const { filteredTasks, pageSize, currentPage } = state;
  const start = (currentPage - 1) * pageSize;
  const pageItems = filteredTasks.slice(start, start + pageSize);

  tbody.innerHTML = '';
  if (!pageItems.length) {
  empty?.classList.remove('hidden');
    return;
  } else {
    empty?.classList.add('hidden');
    }

  const now = new Date();
  pageItems.forEach(t => {
    const due = new Date(t.dueDate);
    const status = t.isCompleted ? 'Concluída' : (due < now ? 'Atrasada' : 'Pendente');
    const statusHtml = createStatusPill(status);
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-200 hover:bg-gray-100';
    tr.innerHTML = `
      <td class="px-3 py-3 h-12 max-w-[160px] truncate">${t.title || t.description || '(Sem título)'}</td>
      <td class="px-3 py-3 h-12 max-w-[160px] truncate min-w-[72px]">${t.plotName || t.talhao || t.plotId || '-'}</td>
      <td class="px-3 py-3 h-12 min-w-[112px]">${formatDate(t.dueDate)}</td>
      <td class="px-3 py-3 h-12 min-w-[120px]">${statusHtml}</td>
      <td class="px-3 py-3 h-12">${!t.isCompleted ? `<button class="concluir-btn px-2 py-1 text-sm text-green-700 border border-green-700 rounded hover:bg-green-700 hover:text-white" data-id="${t.id}">Concluir</button>` : ''}</td>
    `;
    tbody.appendChild(tr);
  });

  // Botões de concluir tarefa
  tbody.querySelectorAll('.concluir-btn').forEach(btn => {
    btn.onclick = async e => {
      const id = e.target.getAttribute('data-id');
      const task = state.filteredTasks.find(t => t.id === id);
      if (task && task._ref) {
        await updateDoc(task._ref, { isCompleted: true, completedAt: new Date() });
        await fetchAndRenderTasks();
      }
    };
  });
}

function renderMetrics() {
    const now = new Date();
    const pending = state.allTasks.filter(t => !t.isCompleted && new Date(t.dueDate) >= now).length;
    const delayed = state.allTasks.filter(t => !t.isCompleted && new Date(t.dueDate) < now).length;
    const completed = state.allTasks.filter(t => t.isCompleted).length;

    const sameMonth = d => {
      if (!d) return false;
      const date = d.toDate ? d.toDate() : new Date(d);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    };

    const monthCompleted = state.allTasks.filter(t => t.isCompleted && sameMonth(t.completedAt)).length;
    const monthNew = state.allTasks.filter(t => sameMonth(t.createdAt)).length;

    const totalPendingEl = document.getElementById('totalPending');
    const totalDelayedEl = document.getElementById('totalDelayed');
    const totalCompletedEl = document.getElementById('totalCompleted');
    const monthCompletedEl = document.getElementById('monthCompleted');
    const monthNewEl = document.getElementById('monthNew');

    const setValue = (el, value) => {
      if (!el) return;
      el.textContent = value;
      el.classList.remove('skeleton');
    };

    setValue(totalPendingEl, pending);
    setValue(totalDelayedEl, delayed);
    setValue(totalCompletedEl, completed);
    setValue(monthCompletedEl, monthCompleted);
    setValue(monthNewEl, monthNew);
  }

  function renderChart() {
  if (!window.Chart) return;
  const ctx = document.getElementById('tasksChart').getContext('2d');
    const now = new Date();
    const pendentes = state.allTasks.filter(t => !t.isCompleted && new Date(t.dueDate) >= now).length;
    const concluidas = state.allTasks.filter(t => t.isCompleted).length;
    const atrasadas = state.allTasks.filter(t => !t.isCompleted && new Date(t.dueDate) < now).length;
    const colors = ['#FEF08A', '#86EFAC', '#FCA5A5'];
    if (state.chart) {
      state.chart.data.labels = ['Pendentes', 'Concluídas', 'Atrasadas'];
      state.chart.data.datasets[0].data = [pendentes, concluidas, atrasadas];
      state.chart.data.datasets[0].backgroundColor = colors;
      state.chart.data.datasets[0].borderColor = '#ffffff';
      state.chart.data.datasets[0].borderWidth = 2;
      state.chart.update();
    } else {
      state.chart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Pendentes', 'Concluídas', 'Atrasadas'],
          datasets: [{
            data: [pendentes, concluidas, atrasadas],
            backgroundColor: colors,
            borderColor: '#ffffff',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: { size: 12 },
                color: '#6B7280',
                padding: 8
              }
            }
          }
        }
      });
  }
}

function render7DaysChart() {
  if (!window.Chart) return;
  const loadingEl = document.getElementById('card-7dias-loading');
  const emptyEl = document.getElementById('card-7dias-empty');
  const chartWrap = document.getElementById('card-7dias-chart');
  const canvas = document.getElementById('chart-7dias');
  if (!loadingEl || !emptyEl || !canvas || !chartWrap) return;

  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  chartWrap.classList.add('hidden');
  canvas.classList.add('hidden');

  const now = new Date();
  const start = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const labels = ['Hoje', 'Amanhã', 'D+2', 'D+3', 'D+4', 'D+5', 'D+6'];
  const counts = Array(7).fill(0);

  state.allTasks.forEach(t => {
    if (t.isCompleted) return;
    const status = normalizeStatus(t.status || (new Date(t.dueDate) < now ? 'Atrasada' : 'Pendente'));
    if (status !== 'pendente' && status !== 'atrasada') return;
    const raw = parseDate(t.vencimento || t.dueDate);
    if (!raw) return;
    const due = new Date(raw.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    if (due < start || due > end) return;
    const diff = Math.floor((due - start) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff < 7) counts[diff]++;
  });

  loadingEl.classList.add('hidden');
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) {
    emptyEl.classList.remove('hidden');
    if (state.sevenChart) {
      state.sevenChart.destroy();
      state.sevenChart = null;
    }
    return;
  }

  chartWrap.classList.remove('hidden');
  canvas.classList.remove('hidden');
  const ctx = canvas.getContext('2d');
  if (state.sevenChart) {
    state.sevenChart.data.datasets[0].data = counts;
    state.sevenChart.options.plugins.tooltip.callbacks.title = ctx => {
      const idx = ctx[0].dataIndex;
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };
    state.sevenChart.options.plugins.tooltip.callbacks.label = ctx => `${ctx.parsed.y} tarefa${ctx.parsed.y === 1 ? '' : 's'}`;
    state.sevenChart.update();
  } else {
    state.sevenChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: '#93C5FD',
          borderColor: '#60A5FA',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { precision: 0 }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => {
                const idx = ctx[0].dataIndex;
                const d = new Date(start);
                d.setDate(start.getDate() + idx);
                return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              },
              label: ctx => `${ctx.parsed.y} tarefa${ctx.parsed.y === 1 ? '' : 's'}`
            }
          }
        }
      }
    });
  }
}

function parseDate(value) {
  if (!value) return null;
  return typeof value === 'string' ? new Date(value) : value.toDate?.() || new Date(value);
}

function normalizeStatus(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function createStatusPill(status) {
  const normalized = normalizeStatus(status);
  if (normalized === 'concluida') {
    return '<span class="status-pill completed">Concluída</span>';
  }
  if (normalized === 'atrasada') {
    return '<span class="status-pill delayed">Atrasada</span>';
  }
  if (normalized === 'pendente') {
    return '<span class="status-pill pending">Pendente</span>';
  }
  return `<span class="status-pill default">${status}</span>`;
}

function formatDate(date) {
  if (!date) return '-';
  let d = typeof date === 'string' ? new Date(date) : date.toDate?.() || date;
  return d.toLocaleDateString('pt-BR');
}

function showModal(show) {
  document.getElementById('taskModal').classList.toggle('hidden', !show);
}

async function createTask(e) {
  e.preventDefault();
  const title  = document.getElementById('taskTitle').value;
  const plotSelect = document.getElementById('taskTalhao');
  const selectedOption = plotSelect.options[plotSelect.selectedIndex];
  const plotPath = plotSelect.value;
  const plotName = selectedOption?.text || '';
  const propertyId = selectedOption?.dataset.propertyId || null;
  const plotId = selectedOption?.dataset.plotId || null;
  const description = document.getElementById('taskDescription').value;
  const dueDate = document.getElementById('taskDate').value;

  await addDoc(collection(db, 'clients', state.farmClientId, 'tasks'), {
    title,
    description,
    plotPath,
    plotName,
     propertyId,
    plotId,
    dueDate,
    isCompleted: false,
    createdAt: new Date()
  });

  showModal(false);
  await fetchAndRenderTasks();
}