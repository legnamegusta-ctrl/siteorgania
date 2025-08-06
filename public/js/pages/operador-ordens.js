// public/js/pages/operador-perfil.js
import { auth } from '../config/firebase.js';

export function initOperadorPerfil(userId, userRole) {
  bindUI();
  renderProfile();
}

function renderProfile() {
  const user = auth.currentUser;
  document.getElementById('profileName').textContent = user?.displayName || 'Operador';
  document.getElementById('profileEmail').textContent = user?.email || '';
  document.getElementById('profileRole').textContent = 'operador';
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