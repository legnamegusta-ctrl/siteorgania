// public/js/pages/operador-tarefas.js

import { db } from '../config/firebase.js';
import {
  collection,
  onSnapshot,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { initTaskModal, openTaskModal } from '../ui/task-modal.js';

const state = { farmClientId: null };

export async function initOperadorTarefas(userId, userRole) {
  await loadFarmId(userId);
  window.taskModalFarmId = state.farmClientId;
  initTaskModal();
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

function loadTasks() {
  if (!state.farmClientId) {
    renderList([]);
    return;
  }
  const q = collection(db, 'clients', state.farmClientId, 'tasks');
  onSnapshot(
    q,
    snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderList(data);
    },
    err => {
      console.error('Erro ao carregar tarefas', err);
      renderList([]);
    }
  );
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
    let statusText = 'Pendente';
    if (t.isCompleted) statusText = 'Concluída';
    else if (t.dueDate && new Date(t.dueDate) < now) statusText = 'Atrasada';
    tdStatus.textContent = statusText;

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
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });
}

