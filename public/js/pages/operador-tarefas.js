// public/js/pages/operador-tarefas.js

const API_BASE = window.location.hostname === 'localhost'
  ? ''
  : 'https://us-central1-app-organia.cloudfunctions.net';

export function initOperadorTarefas(userId, userRole) {
  loadTasks();
  bindUI();
}

async function loadTasks() {
  try {
    const res = await fetch(`${API_BASE}/api/tarefas`);
    const data = await res.json();
    renderList(Array.isArray(data) ? data : []);
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
    btn.className = 'text-green-600 hover:underline';
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
  const openBtn = document.getElementById('openSidebarBtn');
  const mobileSidebar = document.getElementById('mobileSidebar');
  const closeBtn = document.getElementById('closeSidebarBtn');
  const closeMenu = document.getElementById('closeMobileMenu');
  openBtn?.addEventListener('click', () => mobileSidebar?.classList.remove('hidden'));
  closeBtn?.addEventListener('click', () => mobileSidebar?.classList.add('hidden'));
  closeMenu?.addEventListener('click', () => mobileSidebar?.classList.add('hidden'));

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