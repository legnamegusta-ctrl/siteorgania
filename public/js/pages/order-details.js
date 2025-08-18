import { db } from '../config/firebase.js';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { parseDateLocal, formatDDMMYYYY, endOfLocalDay } from '../lib/date-utils.js';
import { initTaskModal, openTaskModal } from '../ui/task-modal.js';

let currentOrder = null;
let tasks = [];
let unsubscribeTasks = null;
let currentFilter = 'all';

function init() {
  initTaskModal();
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') history.back();
  });

  document.getElementById('btn-order-back')?.addEventListener('click', () => history.back());
  document.getElementById('btn-order-new-task')?.addEventListener('click', async e => {
    if (!currentOrder) return;
    const btn = e.currentTarget;
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      await openTaskModal(null, {
        mode: 'create',
        ordemId: currentOrder.id,
        ordemCodigo: currentOrder.codigo,
        prefill: { vencimento: currentOrder.prazo }
      });
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('order-tasks-list')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="view-task"]');
    if (!btn) return;
    openTaskModal(btn.dataset.taskId, { mode: 'view' });
  });

  document.getElementById('order-tasks-filters')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('#order-tasks-filters .chip')
      .forEach(ch => ch.classList.remove('filter-active'));
    btn.classList.add('filter-active');
    renderTaskList();
  });

  document.getElementById('btn-order-empty-create')?.addEventListener('click', () => {
    document.getElementById('btn-order-new-task')?.click();
  });

  window.addEventListener('hashchange', () => {
    const hashId = location.hash.split('/')[1];
    if (hashId) openOrder(hashId);
  });

  let id = new URLSearchParams(window.location.search).get('id');
  if (!id && location.hash.startsWith('#order/')) {
    id = location.hash.split('/')[1];
  }
  if (id) openOrder(id);
}

if (document.readyState !== 'loading') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}

async function openOrder(orderId) {
  if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
  currentOrder = { id: orderId };
  const snap = await getDoc(doc(db, 'ordens', orderId));
  if (snap.exists()) {
    const data = snap.data();
    currentOrder = { id: orderId, ...data, codigo: data.codigo || orderId, prazo: data.prazo || '' };
  } else {
    currentOrder.codigo = orderId;
  }
  fillOrderForm(currentOrder);
  currentFilter = 'all';
  document.querySelectorAll('#order-tasks-filters .chip')
    .forEach(ch => ch.classList.remove('filter-active'));
  document.querySelector('#order-tasks-filters [data-filter="all"]')?.classList.add('filter-active');
  loadTasks(orderId);
  document.getElementById('order-modal-title')?.focus();
}

function loadTasks(orderId) {
  tasks = [];
  const list = document.getElementById('order-tasks-list');
  if (list) list.innerHTML = '';
  const q = query(collection(db, 'tasks'), where('ordemId', '==', orderId));
  unsubscribeTasks = onSnapshot(q, snap => {
    tasks = [];
    snap.forEach(d => {
      const data = d.data();
      const status = taskStatus(data);
      const dueRaw = data.dueDate || data.vencimento;
      const dueDate = dueRaw ? parseDateLocal(dueRaw) : null;
      tasks.push({ id: d.id, title: data.title || d.id, status, dueDate });
    });
    sortTasks();
    updateTaskStats();
    renderTaskList();
  });
}

function sortTasks() {
  const order = { 'Atrasada': 0, 'Pendente': 1, 'Concluída': 2 };
  tasks.sort((a, b) => {
    const pa = order[a.status] - order[b.status];
    if (pa !== 0) return pa;
    const da = a.dueDate ? a.dueDate.getTime() : Infinity;
    const db = b.dueDate ? b.dueDate.getTime() : Infinity;
    if (da !== db) return da - db;
    return a.title.localeCompare(b.title);
  });
}

function updateTaskStats() {
  const total = tasks.length;
  const late = tasks.filter(t => t.status === 'Atrasada').length;
  const pending = tasks.filter(t => t.status === 'Pendente').length;
  const completed = tasks.filter(t => t.status === 'Concluída').length;
  const open = late + pending;
  const counter = document.getElementById('order-tasks-counter');
  if (counter) counter.textContent = `${open}/${total} abertas`;
  const bar = document.querySelector('#order-tasks .progress');
  const barFill = bar?.querySelector('.progress__bar');
  const percent = total ? (completed / total) * 100 : 0;
  if (barFill) barFill.style.width = `${percent}%`;
  if (bar) {
    bar.setAttribute('aria-label', `Progresso de tarefas: ${completed} de ${total} concluídas`);
    bar.setAttribute('aria-valuenow', percent.toFixed(0));
  }
  const filters = document.getElementById('order-tasks-filters');
  if (filters) {
    filters.querySelector('[data-filter="all"] .count').textContent = total;
    filters.querySelector('[data-filter="Pendente"] .count').textContent = pending;
    filters.querySelector('[data-filter="Atrasada"] .count').textContent = late;
    filters.querySelector('[data-filter="Concluída"] .count').textContent = completed;
  }
}

function renderTaskList() {
  const list = document.getElementById('order-tasks-list');
  const table = document.getElementById('order-tasks-table');
  const empty = document.getElementById('order-tasks-empty');
  if (!list) return;
  const frag = document.createDocumentFragment();
  tasks.filter(t => currentFilter === 'all' || t.status === currentFilter).forEach(t => {
    const tr = document.createElement('tr');
    tr.className = 'h-11';
    const dueText = t.dueDate ? formatDDMMYYYY(t.dueDate) : '-';
    tr.innerHTML = `
      <td class="px-2 py-2 align-middle min-w-[280px]">${t.title}</td>
      <td class="px-2 py-2 text-center align-middle min-w-[120px] whitespace-nowrap">${dueText}</td>
      <td class="px-2 py-2 text-center align-middle min-w-[140px]">${renderTaskStatus(t.status)}</td>
      <td class="px-2 py-2 text-right align-middle min-w-[160px]"><button type="button" class="btn btn-ghost text-blue-700 whitespace-nowrap" data-action="view-task" data-task-id="${t.id}">Ver detalhes</button></td>`;
    frag.appendChild(tr);
  });
  list.replaceChildren(frag);
  const hasTasks = tasks.length > 0;
  table?.classList.toggle('hidden', !hasTasks);
  empty?.classList.toggle('hidden', hasTasks);
}

function taskStatus(t) {
  if (t.status === 'Concluída') return 'Concluída';
  const due = t.dueDate || t.vencimento;
  if (due) {
    const d = parseDateLocal(due);
    if (endOfLocalDay(d) < nowLocal()) return 'Atrasada';
  }
  return 'Pendente';
}

function renderTaskStatus(st) {
  const cls = st === 'Concluída'
    ? 'pill pill--success'
    : st === 'Atrasada'
    ? 'pill pill--danger'
    : 'pill pill--warn';
  return `<span class="${cls}">${st}</span>`;
}

function nowLocal() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function fillOrderForm(order) {
  const codeEl = document.getElementById('order-code-chip');
  if (codeEl) {
    codeEl.textContent = order.codigo || order.id || '';
    codeEl.classList.toggle('hidden', !(order.codigo || order.id));
  }
  const statusEl = document.getElementById('order-status-chip');
  if (statusEl) {
    const st = order.status || '';
    statusEl.textContent = st || '—';
    const cls = st
      ? st === 'Concluída'
        ? 'pill pill--success'
        : st === 'Cancelada'
          ? 'pill pill--danger'
          : st === 'Em andamento'
            ? 'pill pill--warn'
            : 'pill pill--info'
      : 'pill';
    statusEl.className = cls;
  }
  document.getElementById('order-codigo').value = order.codigo || order.id || '—';
  document.getElementById('order-cliente').value = order.cliente || '—';
  document.getElementById('order-propriedade').value = order.propriedade || '—';
  document.getElementById('order-talhao').value = order.talhao || '—';
  const ab = document.getElementById('order-abertura');
  ab.type = 'text';
  ab.value = order.abertura ? formatDDMMYYYY(parseDateLocal(order.abertura)) : '—';
  const prazo = document.getElementById('order-prazo');
  prazo.type = 'text';
  prazo.value = order.prazo ? formatDDMMYYYY(parseDateLocal(order.prazo)) : '—';
  document.getElementById('order-itens').value = order.itens || '—';
  document.getElementById('order-total').value = typeof order.total === 'number'
    ? order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
  document.getElementById('order-obs').value = order.obs || '—';
}

