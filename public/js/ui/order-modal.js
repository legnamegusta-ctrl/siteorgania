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
        <td><button type="button" class="btn-ghost text-blue-700" data-action="view-task" data-task-id="${d.id}">Ver detalhes</button></td>`;
      frag.appendChild(tr);
    });
    list?.replaceChildren(frag);
    const counter = document.getElementById('order-tasks-counter');
    if (counter) counter.textContent = `${open}/${total} abertas`;
    const bar = document.querySelector('#order-tasks .progress__bar');
    const percent = total ? (completed / total) * 100 : 0;
    if (bar) bar.style.width = `${percent}%`;
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
  document.getElementById('order-codigo').value = order.codigo || '';
  document.getElementById('order-cliente').value = order.cliente || '';
  document.getElementById('order-propriedade').value = order.propriedade || '';
  document.getElementById('order-talhao').value = order.talhao || '';
  const ab = document.getElementById('order-abertura');
  ab.value = order.abertura ? toYYYYMMDD(parseDateLocal(order.abertura)) : '';
  const prazo = document.getElementById('order-prazo');
  prazo.value = order.prazo ? toYYYYMMDD(parseDateLocal(order.prazo)) : '';
  document.getElementById('order-itens').value = order.itens || '';
  document.getElementById('order-total').value = order.total || '';
  document.getElementById('order-obs').value = order.obs || '';
}

window.openOrderModal = openOrderModal;
