// public/js/pages/operador-tarefas.js

import { db } from '../config/firebase.js';
import {
  collection,
  onSnapshot,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { initTaskModal, openTaskModal as openTaskModalBase } from '../ui/task-modal.js';

const state = { farmClientId: null, allTasks: [], ordersMap: {} };
const filters = parseFiltersFromURL();

export async function initOperadorTarefas(userId, userRole) {
  await loadFarmId(userId);
  window.taskModalFarmId = state.farmClientId;
  initTaskModal();
  syncFilterControls();
  loadTasks();
}

async function loadFarmId(userId) {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    state.farmClientId = snap.data()?.farmClientId || null;
  } catch (e) {
    console.error('Erro ao obter farmClientId do operador', e);
  }
}

function parseFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  const f = { day: null, dayStr: null, status: null };
  const dia = params.get('dia');
  if (dia) {
    const [y, m, d] = dia.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      f.day = {
        start: new Date(y, m - 1, d, 0, 0, 0, 0),
        end: new Date(y, m - 1, d, 23, 59, 59, 999)
      };
      f.dayStr = dia;
    }
  }
  const status = params.get('status');
  if (status) {
    const norm = status
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (norm === 'abertas') f.status = 'abertas';
  }
  return f;
}

function syncFilterControls() {
  const dateInput = document.getElementById('filter-date');
  if (dateInput) dateInput.value = filters.dayStr || '';
  const statusSelect = document.getElementById('filter-status');
  if (statusSelect) statusSelect.value = filters.status || 'todas';
}

function loadTasks() {
  if (!state.farmClientId) {
    state.allTasks = [];
    applyFiltersAndRender();
    return;
  }
  const q = collection(db, 'clients', state.farmClientId, 'tasks');
  onSnapshot(
    q,
    snap => {
      state.allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      loadOrderCodes().then(applyFiltersAndRender);
    },
    err => {
      console.error('Erro ao carregar tarefas', err);
      state.allTasks = [];
      applyFiltersAndRender();
    }
  );
}

async function loadOrderCodes() {
  const ids = [...new Set(state.allTasks.filter(t => t.orderId).map(t => t.orderId))];
  await Promise.all(
    ids.map(async id => {
      if (state.ordersMap[id]) return;
      try {
        const snap = await getDoc(doc(db, 'clients', state.farmClientId, 'orders', id));
        state.ordersMap[id] = { codigo: snap.data()?.codigo || id };
      } catch (e) {
        console.error('Erro ao carregar ordem', e);
      }
    })
  );
}

function applyFiltersAndRender() {
  const now = new Date();
  let tasks = state.allTasks.slice();
  if (filters.status === 'abertas') {
    tasks = tasks.filter(t => {
      const st = getStatus(t, now);
      return st === 'Pendente' || st === 'Atrasada';
      });
  }
  if (filters.day) {
    tasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= filters.day.start && due <= filters.day.end;
    });
  }
  renderList(tasks);
  renderActiveFiltersChip();
}

function getStatus(t, now = new Date()) {
  if (t.isCompleted) return 'Concluída';
  if (t.dueDate) {
    const due = new Date(t.dueDate);
    if (due < now) return 'Atrasada';
  }
  return 'Pendente';
}

function renderActiveFiltersChip() {
  const container = document.getElementById('activeFilters');
  if (!container) return;
  const parts = [];
  if (filters.day) {
    parts.push(`Dia: ${filters.day.start.toLocaleDateString('pt-BR')}`);
  }
  if (filters.status === 'abertas') {
    parts.push('Status: Abertas');
  }
  if (!parts.length) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `<div class="inline-flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">${parts.join(' • ')} <button id="clearFilters" class="ml-2 underline">Limpar</button></div>`;
  container.classList.remove('hidden');
  document.getElementById('clearFilters').addEventListener('click', clearFilters);
}

function clearFilters() {
  filters.day = null;
  filters.dayStr = null;
  filters.status = null;
  const url = new URL(window.location);
  url.searchParams.delete('dia');
  url.searchParams.delete('status');
  window.history.replaceState({}, '', url.pathname + url.search);
  applyFiltersAndRender();
  syncFilterControls();
}

function renderList(tasks) {
  const tbody = document.getElementById('tasksList');
  if (!tbody) return;
  tbody.innerHTML = '';
  const now = new Date();
  tasks.forEach(t => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';

    const tdTalhao = document.createElement('td');
    tdTalhao.className = 'px-4 py-2';
    tdTalhao.textContent = t.plotName || t.talhao || '-';

    const tdTipo = document.createElement('td');
    tdTipo.className = 'px-4 py-2';
    tdTipo.textContent = t.title || t.tipo || t.id;

    const tdVenc = document.createElement('td');
    tdVenc.className = 'px-4 py-2';
    tdVenc.textContent = t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : '-';

    const tdStatus = document.createElement('td');
    tdStatus.className = 'px-4 py-2';
    tdStatus.textContent = getStatus(t, now);

    /* Chip ordem em tarefas */
    const tdOrder = document.createElement('td');
    tdOrder.className = 'px-4 py-2';
    if (t.orderId) {
      const code = state.ordersMap[t.orderId]?.codigo || '...';
      const chip = document.createElement('button');
      chip.className = 'order-chip';
      chip.textContent = `#${code}`;
      chip.title = `Ver ordem #${code}`;
      chip.addEventListener('click', () => openOrderModal(t.orderId));
      tdOrder.appendChild(chip);
    } else {
      tdOrder.textContent = '-';
    }

    const tdAction = document.createElement('td');
    tdAction.className = 'px-4 py-2';
    const btn = document.createElement('button');
    btn.className = 'details-btn px-2 py-1 text-sm text-blue-700 border border-blue-700 rounded hover:bg-blue-700 hover:text-white flex items-center gap-1';
    btn.innerHTML = '<i class="fas fa-eye"></i><span>Ver detalhes</span>';
    btn.addEventListener('click', () => openTaskModal(t.id, 'table'));
    tdAction.appendChild(btn);

    tr.appendChild(tdTalhao);
    tr.appendChild(tdTipo);
    tr.appendChild(tdVenc);
    tr.appendChild(tdStatus);
    tr.appendChild(tdOrder);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });
}

export async function openTaskModal(taskId, source = 'table') {
  if (source === 'order') {
    document.getElementById('order-modal')?.classList.add('hidden');
  }
  await openTaskModalBase(taskId, source === 'order' ? 'table' : source);
  const chip = document.getElementById('task-order-chip');
  if (!chip) return;
  chip.classList.add('hidden');
  if (!taskId) return;
  try {
    const snap = await getDoc(doc(db, 'clients', state.farmClientId, 'tasks', taskId));
    const data = snap.data();
    if (data?.orderId) {
      let code = state.ordersMap[data.orderId]?.codigo;
      if (!code) {
        const oSnap = await getDoc(doc(db, 'clients', state.farmClientId, 'orders', data.orderId));
        code = oSnap.data()?.codigo || data.orderId;
        state.ordersMap[data.orderId] = { codigo: code };
      }
      chip.textContent = `#${code}`;
      chip.title = `Ver ordem #${code}`;
      chip.onclick = () => openOrderModal(data.orderId);
      chip.classList.remove('hidden');
    }
  } catch (e) {
    console.error('Erro ao carregar tarefa', e);
  }
}

window.openTaskModal = openTaskModal;

