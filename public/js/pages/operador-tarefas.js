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
  const ul = document.getElementById('tasksList');
  if (!ul) return;
  ul.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'py-2 flex justify-between';
    li.innerHTML = `<span>${t.talhao || ''} - ${t.tipo || t.id}</span><span>${t.status || ''}</span>`;
    ul.appendChild(li);
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
}