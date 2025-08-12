// public/js/pages/operador-tarefas.js

import { db } from '../config/firebase.js';
import {
  collection,
  onSnapshot,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const state = { farmClientId: null };

export async function initOperadorTarefas(userId, userRole) {
  await loadFarmId(userId);
  loadTasks();
  bindUI();
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
    tdAction.className = 'px-4 py-2 text-right';
    const btn = document.createElement('button');
    btn.className = 'bg-green-600 text-white text-sm px-3 py-1 rounded hover:bg-green-700 transition';
    btn.textContent = 'Detalhes';
    btn.addEventListener('click', () => openTaskModal({ ...t, status: statusText }));
    tdAction.appendChild(btn);

    tr.appendChild(tdTalhao);
    tr.appendChild(tdTipo);
    tr.appendChild(tdVenc);
    tr.appendChild(tdStatus);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });
}

function bindUI() {
  const modal = document.getElementById('taskModal');
  const closeModal = document.getElementById('closeTaskModal');
  closeModal?.addEventListener('click', hideTaskModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) hideTaskModal();
  });
}

function openTaskModal(task) {
  const modal = document.getElementById('taskModal');
  const content = document.getElementById('taskModalContent');
  if (!modal || !content) return;
  const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : '-';
  content.innerHTML = `
    <p><strong>Título:</strong> ${task.title || '-'}</p>
    <p><strong>Talhão:</strong> ${task.plotName || '-'}</p>
    <p><strong>Vencimento:</strong> ${due}</p>
    <p><strong>Status:</strong> ${task.status || '-'}</p>
    <p><strong>Descrição:</strong> ${task.description || 'Sem descrição'}</p>
  `;
  modal.classList.remove('hidden');
}

function hideTaskModal() {
  const modal = document.getElementById('taskModal');
  modal?.classList.add('hidden');
}
