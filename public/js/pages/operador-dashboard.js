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
  chart: null
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
      <td class="px-3 py-3 h-12 max-w-[160px] truncate">${t.plotName || t.talhao || t.plotId || '-'}</td>
      <td class="px-3 py-3 h-12">${formatDate(t.dueDate)}</td>
      <td class="px-3 py-3 h-12">${statusHtml}</td>
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
      state.chart.update();
    } else {
      state.chart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Pendentes', 'Concluídas', 'Atrasadas'],
          datasets: [{
            data: [pendentes, concluidas, atrasadas],
            backgroundColor: colors
          }]
        },
        options: { responsive: true }
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