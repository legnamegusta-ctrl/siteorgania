// public/js/pages/operador-ordens.js

const API_BASE = window.location.hostname === 'localhost'
  ? ''
  : 'https://us-central1-app-organia.cloudfunctions.net';

export function initOperadorOrdens(userId, userRole) {
  loadOrders();
  bindUI();
}

async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/ordens`);
    const data = await res.json();
    renderTable(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error(e);
    renderTable([]);
  }
}

function renderTable(ordens) {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  ordens.forEach(o => {
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `
      <td class="px-2 py-1">${o.id || ''}</td>
      <td class="px-2 py-1">${o.talhao || '-'}</td>
      <td class="px-2 py-1">${o.data || '-'}</td>
      <td class="px-2 py-1">${o.status || '-'}</td>`;
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
}