import { db } from '../config/firebase.js';
import {
  collectionGroup,
  collection,
  getDocs,
  addDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";

let state = {
  allTasks: [],
  filteredTasks: [],
  filter: 'todas',
  currentPage: 1,
  pageSize: 8,
  chart: null
};

export async function initOperadorDashboard() {
  bindUI();
  await fetchAndRenderTasks();
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
  // Busca todas as tarefas de todas as fazendas
  const snap = await getDocs(collectionGroup(db, 'tasks'));
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
    if (state.filter === 'pendentes') return !isCompleted;
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

  pageItems.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-3 py-2">${t.title || t.description || '(Sem título)'}</td>
      <td class="px-3 py-2">${t.talhao || t.plotId || '-'}</td>
      <td class="px-3 py-2">${formatDate(t.dueDate)}</td>
      <td class="px-3 py-2">${t.isCompleted ? '<span class="text-green-600">Concluída</span>' : '<span class="text-yellow-600">Pendente</span>'}</td>
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
  document.getElementById('totalOrders').textContent    = state.filteredTasks.length;
  document.getElementById('totalPending').textContent   = state.filteredTasks.filter(t => !t.isCompleted).length;
  document.getElementById('totalCompleted').textContent = state.filteredTasks.filter(t => t.isCompleted).length;
}

function renderChart() {
  if (!window.Chart) return;
  const ctx = document.getElementById('tasksChart').getContext('2d');
  const pendentes = state.filteredTasks.filter(t => !t.isCompleted).length;
  const concluidas = state.filteredTasks.filter(t => t.isCompleted).length;
  if (state.chart) {
    state.chart.data.labels = ['Pendentes', 'Concluídas'];
    state.chart.data.datasets[0].data = [pendentes, concluidas];
    state.chart.update();
  } else {
    state.chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Pendentes', 'Concluídas'],
        datasets: [{ data: [pendentes, concluidas] }]
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

// ====== CRIAÇÃO DE TAREFA ======
// Troque aqui o clientId para o código correto da fazenda no Firestore
const clientId = "i1fNSMl489V7bGljjTNO";

async function createTask(e) {
  e.preventDefault();
  const title   = document.getElementById('taskTitle').value;
  const talhao  = document.getElementById('taskTalhao').value;
  const dueDate = document.getElementById('taskDate').value;

  await addDoc(collection(db, 'clients', clientId, 'tasks'), {
    title,
    plotId: talhao,
    dueDate,
    isCompleted: false,
    createdAt: new Date()
  });

  showModal(false);
  await fetchAndRenderTasks();
}
