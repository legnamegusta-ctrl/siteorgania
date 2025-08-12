// public/js/ui/sidebar.js
// Sidebar: toggle, active state and Firestore counters
import { db } from '../config/firebase.js';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const API_BASE = window.location.hostname === 'localhost'
  ? ''
  : 'https://us-central1-app-organia.cloudfunctions.net';

document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const backdrop = document.getElementById('sidebarBackdrop');

  const open = () => {
    sidebar?.classList.add('open');
    backdrop?.classList.add('show');
    toggle?.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('show');
    toggle?.setAttribute('aria-expanded', 'false');
  };

  toggle?.addEventListener('click', () => {
    sidebar?.classList.contains('open') ? close() : open();
  });

  backdrop?.addEventListener('click', close);

  // Active link
  const current = window.location.pathname.split('/').pop();
  document.querySelectorAll('#sidebar a').forEach(link => {
    if (link.getAttribute('href') === current) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });

  // Badges: tarefas pending+running
  const tasksBadge = document.getElementById('tasksBadge');
  if (tasksBadge) {
    const q = query(collection(db, 'tarefas'), where('status', 'in', ['pending', 'running']));
    onSnapshot(q, snap => {
      const count = snap.size;
      tasksBadge.textContent = count;
      tasksBadge.classList.toggle('show', count > 0);
    });
  }

  // Lista de tarefas na sidebar
  const sidebarTasks = document.getElementById('sidebarTasks');
  if (sidebarTasks) {
    fetch(`${API_BASE}/api/tarefas`)
      .then(res => res.json())
      .then(tasks => {
        sidebarTasks.innerHTML = tasks.map(t => `<a href="operador-tarefas.html#${t.id || ''}" class="sidebar-sublink">${t.talhao || t.tipo || t.id}</a>`).join('');
        sidebarTasks.classList.toggle('show', tasks.length > 0);
      })
      .catch(() => sidebarTasks.classList.remove('show'));
  }

  // Badges: ordens abertas
  const ordersBadge = document.getElementById('ordersBadge');
  if (ordersBadge) {
    const q = query(collection(db, 'ordens'), where('status', '==', 'aberta'));
    onSnapshot(q, snap => {
      const count = snap.size;
      ordersBadge.textContent = count;
      ordersBadge.classList.toggle('show', count > 0);
    });
  }

  // Agenda indicator
  const agendaIndicator = document.getElementById('agendaIndicator');
  if (agendaIndicator) {
    const tz = 'America/Sao_Paulo';
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    today.setHours(0, 0, 0, 0);
    const start = Timestamp.fromDate(today);
    const end = Timestamp.fromDate(new Date(today.getTime() + 86400000 - 1));
    const todayStr = today.toISOString().slice(0, 10);

    let tasksToday = false;
    let ordersToday = false;

    const updateIndicator = () => {
      agendaIndicator.classList.toggle('show', tasksToday || ordersToday);
    };

    const tarefasCol = collection(db, 'tarefas');
    onSnapshot(query(tarefasCol, where('vencimento', '>=', start), where('vencimento', '<=', end)), snap => {
      tasksToday = snap.size > 0;
      updateIndicator();
    });
    onSnapshot(query(tarefasCol, where('vencimento', '==', todayStr)), snap => {
      tasksToday = tasksToday || snap.size > 0;
      updateIndicator();
    });

    const ordensCol = collection(db, 'ordens');
    onSnapshot(query(ordensCol, where('prazo', '>=', start), where('prazo', '<=', end)), snap => {
      ordersToday = snap.size > 0;
      updateIndicator();
    });
    onSnapshot(query(ordensCol, where('prazo', '==', todayStr)), snap => {
      ordersToday = ordersToday || snap.size > 0;
      updateIndicator();
    });
  }
});

