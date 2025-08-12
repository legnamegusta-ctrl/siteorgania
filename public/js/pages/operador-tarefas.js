// public/js/pages/operador-tarefas.js

import { db } from '../config/firebase.js';
import {
  collection,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

export function initOperadorTarefas(userId, userRole) {
  loadTasks();
  bindUI();
}

function loadTasks() {
  try {
    const q = collection(db, 'tarefas');
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
  } catch (e) {
    console.error(e);
    renderList([]);
  }
}

function renderList(tasks) {
  const tbody = document.getElementById('tasksList');
  if (!tbody) return;
  tbody.innerHTML = '';
  tasks.forEach(t => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';

    const tdTalhao = document.createElement('td');
    tdTalhao.className = 'px-4 py-2';
    tdTalhao.textContent = t.talhao || '-';

    const tdTipo = document.createElement('td');
    tdTipo.className = 'px-4 py-2';
    tdTipo.textContent = t.tipo || t.id;

    const tdStatus = document.createElement('td');
    tdStatus.className = 'px-4 py-2';
    tdStatus.textContent = t.status || '';

    const tdAction = document.createElement('td');
    tdAction.className = 'px-4 py-2 text-right';
    const btn = document.createElement('button');
    btn.className = 'bg-green-600 text-white text-sm px-3 py-1 rounded hover:bg-green-700 transition';
    btn.textContent = 'Detalhes';
    btn.addEventListener('click', () => openTaskModal(t));
    tdAction.appendChild(btn);

    tr.appendChild(tdTalhao);
    tr.appendChild(tdTipo);
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
  content.innerHTML = `
    <p><strong>Talhão:</strong> ${task.talhao || '-'}</p>
    <p><strong>Tipo:</strong> ${task.tipo || '-'}</p>
    <p><strong>Status:</strong> ${task.status || '-'}</p>
    <p><strong>Descrição:</strong> ${task.descricao || task.description || 'Sem descrição'}</p>
  `;
  modal.classList.remove('hidden');
}

function hideTaskModal() {
  const modal = document.getElementById('taskModal');
  modal?.classList.add('hidden');
}