import { db } from '../config/firebase.js';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { parseDateLocal, formatDDMMYYYY, endOfLocalDay, toYYYYMMDD } from '../lib/date-utils.js';
import { openTaskModal } from './task-modal.js';

let overlay;
let modal;
let currentOrder = null;
let unsubscribeTasks = null;

export function initOrderModal() {
  if (window.__orderModalInited) return;
  overlay = document.getElementById('order-modal-overlay');
  if (!overlay) return;
  modal = overlay.querySelector('.modal');
  window.__orderModalInited = true;
  document.getElementById('btn-order-close')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.getElementById('btn-order-new-task')?.addEventListener('click', async (e) => {
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
    closeModal();
    openTaskModal(btn.dataset.taskId, { mode: 'view' });
  });
}

export async function openOrderModal(orderId) {
  initOrderModal();
  document.getElementById('task-modal-overlay')?.setAttribute('hidden','');
  const drawer = document.querySelector('.drawer.is-open');
  const overlayDrawer = document.querySelector('.drawer-overlay.is-open');
  drawer?.classList.remove('is-open');
  overlayDrawer?.classList.remove('is-open');
  if (!overlay) return;
  if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
  currentOrder = { id: orderId };
  const orderRef = doc(db, 'orders', orderId);
  const snap = await getDoc(orderRef);
  if (snap.exists()) {
    const data = snap.data();
    currentOrder = { id: orderId, ...data, codigo: data.codigo || orderId, prazo: data.prazo || '' };
    fillOrderForm(currentOrder);
  } else {
    currentOrder.codigo = orderId;
    fillOrderForm(currentOrder);
  }
  loadTasks(orderId);
  overlay.hidden = false;
  document.body.classList.add('has-modal');
}

function loadTasks(orderId) {
  const list = document.getElementById('order-tasks-list');
  if (list) list.innerHTML = '';
  const q = query(collection(db, 'tasks'), where('ordemId', '==', orderId));
  unsubscribeTasks = onSnapshot(q, snap => {
    const frag = document.createDocumentFragment();
    let total = 0, completed = 0, open = 0;
    snap.forEach(d => {
      const data = d.data();
      const status = taskStatus(data);
      total++;
      if (status === 'Concluída') completed++;
      if (status === 'Pendente' || status === 'Atrasada') open++;
      const dueRaw = data.dueDate || data.vencimento;
      const dueDate = dueRaw ? parseDateLocal(dueRaw) : null;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${data.title || d.id}</td>
        <td>${dueDate ? formatDDMMYYYY(dueDate) : '-'}</td>
        <td>${renderTaskStatus(status)}</td>
        <td class="text-right"><button type="button" class="btn-ghost text-blue-700 whitespace-nowrap" data-action="view-task" data-task-id="${d.id}">Ver detalhes</button></td>`;
      frag.appendChild(tr);
    });
    list?.replaceChildren(frag);
    const counter = document.getElementById('order-tasks-counter');
    if (counter) counter.textContent = `${open}/${total} abertas`;
    const bar = document.querySelector('#order-tasks .progress');
    const barFill = bar?.querySelector('.progress__bar');
    const percent = total ? (completed / total) * 100 : 0;
    if (barFill) barFill.style.width = `${percent}%`;
    if (bar) bar.setAttribute('aria-label', `Progresso de tarefas: ${completed} de ${total} concluídas`);
  });
}

function closeModal() {
  overlay?.setAttribute('hidden','');
  document.body.classList.remove('has-modal');
  if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
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

window.openOrderModal = openOrderModal;
