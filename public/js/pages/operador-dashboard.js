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
    empty.classList.remove('hidden');
    return;
  } else {
    empty.classList.add('hidden');
  }

   const now = new Date();
    pageItems.forEach(t => {
      const due = new Date(t.dueDate);
      const statusHtml = t.isCompleted
        ? '<span class="text-green-600">Concluída</span>'
        : (due < now
            ? '<span class="text-red-600">Atrasada</span>'
            : '<span class="text-yellow-600">Pendente</span>');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2">${t.title || t.description || '(Sem título)'}</td>
        <td class="px-3 py-2">${t.plotName || t.talhao || t.plotId || '-'}</td>
        <td class="px-3 py-2">${formatDate(t.dueDate)}</td>
        <td class="px-3 py-2">${statusHtml}</td>
        <td class="px-3 py-2">${!t.isCompleted ? `<button class="concluir-btn px-2 py-1 bg-green-500 text-white rounded" data-id="${t.id}">Concluir</button>` : ''}</td>
      `;
      tbody.appendChild(tr);
    });

  // Botões de concluir tarefa
  tbody.querySelectorAll('.concluir-btn').forEach(btn => {
    btn.onclick = async e => {
      const id = e.target.getAttribute('data-id');
      const task = state.filteredTasks.find(t => t.id === id);
      if (task && task._ref) {
        await updateDoc(task._ref, { isCompleted: true });
        await fetchAndRenderTasks();
      }
    };
  });
}

function renderMetrics() {
    const now = new Date();
    const pending   = state.allTasks.filter(t => !t.isCompleted && new Date(t.dueDate) >= now).length;
    const completed = state.allTasks.filter(t => t.isCompleted).length;
    const delayed   = state.allTasks.filter(t => !t.isCompleted && new Date(t.dueDate) < now).length;

    const totalTasksEl     = document.getElementById('totalTasks');
    const totalPendingEl   = document.getElementById('totalPending');
    const totalCompletedEl = document.getElementById('totalCompleted');
    const totalDelayedEl   = document.getElementById('totalDelayed');

    if (totalTasksEl)     totalTasksEl.textContent     = state.allTasks.length;
    if (totalPendingEl)   totalPendingEl.textContent   = pending;
    if (totalCompletedEl) totalCompletedEl.textContent = completed;
    if (totalDelayedEl)   totalDelayedEl.textContent   = delayed;
  }

  function renderChart() {
    if (!window.Chart) return;
    const ctx = document.getElementById('tasksChart').getContext('2d');
    const now = new Date();
    const pendentes = state.allTasks.filter(t => !t.isCompleted && new Date(t.dueDate) >= now).length;
    const concluidas = state.allTasks.filter(t => t.isCompleted).length;
    const atrasadas = state.allTasks.filter(t => !t.isCompleted && new Date(t.dueDate) < now).length;
    if (state.chart) {
      state.chart.data.labels = ['Pendentes', 'Concluídas', 'Atrasadas'];
      state.chart.data.datasets[0].data = [pendentes, concluidas, atrasadas];
      state.chart.update();
    } else {
      state.chart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Pendentes', 'Concluídas', 'Atrasadas'],
          datasets: [{ data: [pendentes, concluidas, atrasadas] }]
        },
        options: { responsive: true }
      });
    }
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
  const dueDate = document.getElementById('taskDate').value;

  await addDoc(collection(db, 'clients', state.farmClientId, 'tasks'), {
    title,
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