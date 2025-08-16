import { db, auth } from '../config/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";
import { initTaskDetail, openTaskDetail, hideTaskDetail } from '../ui/task-detail.js';

let state = {
  farmClientId: null,
  plots: [],
  allTasks: [],
  filteredTasks: [],
  filter: 'todas',
  currentPage: 1,
  pageSize: 8,
  chart: null,
  sevenChart: null,
  currentTaskId: null
};

const barValuePlugin = {
  id: 'barValuePlugin',
  afterDatasetsDraw(chart) {
    if (chart.config.type !== 'bar') return;
    const { ctx } = chart;
    ctx.save();
    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    meta.data.forEach((bar, index) => {
      const value = dataset.data[index];
      if (value > 0) {
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillStyle = '#1F2937';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(value, bar.x, bar.y - 6);
      }
    });
  }
};

if (window.Chart) {
  Chart.register(barValuePlugin);
}

document.addEventListener('DOMContentLoaded', () => {
  initTaskDetail();
  const tbl = document.getElementById('dashboard-tasks-table');
  if (tbl && !tbl.__bound) {
    tbl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="view-task"], .js-view-task');
      if (!btn) return;
      e.preventDefault();
      const taskId = btn.dataset.taskId || btn.dataset.id;
      if (!taskId) return;
      document.body.classList.remove('drawer-open');
      window.taskOriginHash = window.location.hash.slice(1);
      window.location.hash = `task/${taskId}`;
    });
    tbl.__bound = true;
  }
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
});

export async function initOperadorDashboard(userId) {
  await loadFarmId(userId);
  window.taskModalFarmId = state.farmClientId;
  bindUI();
  await loadPlots();
  await fetchAndRenderTasks();
  document.addEventListener('task-updated', () => fetchAndRenderTasks());
}

function handleHashChange() {
  const hash = window.location.hash.slice(1);
  const wrapper = document.querySelector('.page-container');
  if (hash.startsWith('task/')) {
    const id = hash.split('/')[1];
    wrapper?.classList.add('hidden');
    openTaskDetail(id === 'new' ? null : id);
    document.getElementById('task-view').hidden = false;
    return;
  }
  hideTaskDetail();
  document.getElementById('task-view').hidden = true;
  wrapper?.classList.remove('hidden');
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
  document.getElementById('createTaskBtn')?.addEventListener('click', () => {
    window.taskOriginHash = window.location.hash.slice(1);
    openTaskDetail(null, { mode: 'create' });
    window.location.hash = 'task/new';
  });
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
      <td class="px-3 py-3 h-12">
        <button type="button" class="details-btn px-2 py-1 text-sm text-blue-700 border border-blue-700 rounded hover:bg-blue-700 hover:text-white flex items-center gap-1 js-view-task" data-action="view-task" data-task-id="${t.id}">
          <i class="fas fa-eye"></i><span>Ver detalhes</span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
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

    const totalPendingEl = document.getElementById('kpi-pendentes');
    const totalDelayedEl = document.getElementById('kpi-atrasadas');
    const totalCompletedEl = document.getElementById('kpi-concluidas');
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
          maintainAspectRatio: false,
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

// Helpers de data em fuso local (America/Sao_Paulo)
function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseVencimentoLocal(v) {
  if (!v) return null;
  if (typeof v === 'object' && typeof v.toDate === 'function') {
    return v.toDate();
  }
  if (typeof v === 'string') {
    const [datePart, timePart] = v.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    if (timePart) {
      const [hh, mm] = timePart.split(':').map(Number);
      return new Date(y, m - 1, d, hh || 0, mm || 0);
    }
    return new Date(y, m - 1, d);
  }
  return new Date(v);
}

function formatDDMM(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function weekdayPt(d) {
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()];
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
  const hoje0 = startOfLocalDay(now);
  const fimJanela = new Date(hoje0);
  fimJanela.setDate(fimJanela.getDate() + 7);
  fimJanela.setMilliseconds(fimJanela.getMilliseconds() - 1);

  const labels = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoje0);
    d.setDate(hoje0.getDate() + i);
    const ddmm = formatDDMM(d);
    if (i === 0) labels.push(`Hoje ${ddmm}`);
    else if (i === 1) labels.push(`Amanhã ${ddmm}`);
    else labels.push(`D+${i} ${ddmm}`);
  }

  const totais = Array(7).fill(0);
  const pendentes = Array(7).fill(0);
  const atrasadas = Array(7).fill(0);

  state.allTasks.forEach(t => {
    const status = normalizeStatus(
      t.status || (t.isCompleted ? 'Concluída' : (new Date(t.dueDate) < now ? 'Atrasada' : 'Pendente'))
    );
    if (status !== 'pendente' && status !== 'atrasada') return;
    const dv = parseVencimentoLocal(t.vencimento || t.dueDate);
    if (!dv) return;
    const dv0 = startOfLocalDay(dv);
    const idx = Math.floor((dv0 - hoje0) / 86_400_000);
    if (idx < 0 || idx > 6) return;
    totais[idx]++;
    if (status === 'pendente') pendentes[idx]++; else atrasadas[idx]++;
  });

  loadingEl.classList.add('hidden');
  const total = totais.reduce((a, b) => a + b, 0);
  if (!total) {
    emptyEl.classList.remove('hidden');
    if (state.sevenChart) {
      state.sevenChart.destroy();
      state.sevenChart = null;
    }
    return;
  }

  const bgColors = labels.map((_, i) => {
    if (i === 0) return '#EF4444';
    if (i === 1) return '#F59E0B';
    if (i === 2) return '#FACC15';
    return '#93C5FD';
  });
  const borderColors = labels.map((_, i) => {
    if (i === 0) return '#DC2626';
    if (i === 1) return '#D97706';
    if (i === 2) return '#EAB308';
    return '#60A5FA';
  });

  chartWrap.classList.remove('hidden');
  canvas.classList.remove('hidden');
  const ctx = canvas.getContext('2d');
  const maxVal = Math.max(...totais);

  const tooltipLabel = ctx => {
    const idx = ctx.dataIndex;
    const base = new Date(hoje0);
    base.setDate(hoje0.getDate() + idx);
    const ddmm = formatDDMM(base);
    const wday = weekdayPt(base);
    return `${ddmm} (${wday}): Total ${totais[idx]} · Pendentes ${pendentes[idx]} · Atrasadas ${atrasadas[idx]}`;
  };

  const onClickBar = (evt, elements) => {
    if (elements.length) {
      const idx = elements[0].index;
      const d = new Date(hoje0);
      d.setDate(hoje0.getDate() + idx);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      window.location.href = `operador-tarefas.html?dia=${y}-${m}-${day}&status=abertas`;
    }
  };

  if (state.sevenChart) {
    state.sevenChart.data.labels = labels;
    state.sevenChart.data.datasets[0].data = totais;
    state.sevenChart.data.datasets[0].backgroundColor = bgColors;
    state.sevenChart.data.datasets[0].borderColor = borderColors;
    state.sevenChart.options.scales.y.suggestedMax = maxVal + 1;
    state.sevenChart.options.plugins.tooltip.callbacks.label = tooltipLabel;
    state.sevenChart.options.plugins.tooltip.callbacks.title = () => '';
    state.sevenChart.options.onClick = onClickBar;
    state.sevenChart.update();
  } else {
    state.sevenChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: totais,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: onClickBar,
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: maxVal + 1,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { precision: 0 }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: tooltipLabel,
              title: () => ''
            }
          }
        }
      }
    });
  }
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

function formatDateTime(ts) {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/*
Testes rápidos (America/Sao_Paulo):
- "2025-08-12" (hoje) -> bucket 0.
- "2025-08-13" (amanhã) -> bucket 1.
- Timestamp hoje às 23:59 -> bucket 0.
- Timestamp amanhã às 00:01 -> bucket 1.
- "2025-08-19" -> bucket 7 → ignorado.
*/
