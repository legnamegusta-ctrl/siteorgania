// public/js/ui/sidebar.js
// Sidebar: off-canvas mobile + counters realtime
import { db } from '../config/firebase.js';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp
} from '/vendor/firebase/9.6.0/firebase-firestore.js';

export function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('btn-sidebar-toggle');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (!sidebar || !toggle || !backdrop) return;

  let focusable = [];
  let firstFocusable;
  let lastFocusable;

  const setFocusables = () => {
    focusable = sidebar.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable = focusable[0];
    lastFocusable = focusable[focusable.length - 1];
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Tab') {
      if (focusable.length === 0) return;
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  };

  const open = () => {
    sidebar.classList.add('is-open');
    backdrop.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    setFocusables();
    firstFocusable && firstFocusable.focus();
    document.addEventListener('keydown', handleKeydown);
  };

  const close = () => {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', handleKeydown);
    toggle.focus();
  };

  toggle.addEventListener('click', () => {
    sidebar.classList.contains('is-open') ? close() : open();
  });

  backdrop.addEventListener('click', close);

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      close();
    }
  });

  // Active link
  const current = window.location.pathname.split('/').pop();
  sidebar.querySelectorAll('a.sidebar-link').forEach((link) => {
    if (link.getAttribute('href') === current) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });

  // Sidebar: counters realtime
  const tasksBadge = document.querySelector('[data-badge="tarefas"]');
  if (tasksBadge) {
    const statuses = ['Pendente', 'pendente', 'PENDENTE', 'Atrasada', 'atrasada', 'ATRASADA'];
    const q = query(collection(db, 'tarefas'), where('status', 'in', statuses));
    onSnapshot(q, (snap) => {
      const count = snap.size;
      tasksBadge.textContent = count;
      tasksBadge.classList.toggle('show', count > 0);
    });
  }

  const ordersBadge = document.querySelector('[data-badge="ordens"]');
  if (ordersBadge) {
    const statuses = ['Aberta', 'aberta', 'ABERTA'];
    const q = query(collection(db, 'ordens'), where('status', 'in', statuses));
    onSnapshot(q, (snap) => {
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
    onSnapshot(
      query(tarefasCol, where('vencimento', '>=', start), where('vencimento', '<=', end)),
      (snap) => {
        tasksToday = snap.size > 0;
        updateIndicator();
      }
    );
    onSnapshot(query(tarefasCol, where('vencimento', '==', todayStr)), (snap) => {
      tasksToday = tasksToday || snap.size > 0;
      updateIndicator();
    });

    const ordensCol = collection(db, 'ordens');
    onSnapshot(
      query(ordensCol, where('prazo', '>=', start), where('prazo', '<=', end)),
      (snap) => {
        ordersToday = snap.size > 0;
        updateIndicator();
      }
    );
    onSnapshot(query(ordensCol, where('prazo', '==', todayStr)), (snap) => {
      ordersToday = ordersToday || snap.size > 0;
      updateIndicator();
    });
  }
}

document.addEventListener('DOMContentLoaded', initSidebar);

