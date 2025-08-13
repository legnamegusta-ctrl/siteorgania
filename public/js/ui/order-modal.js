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
import { openTaskModal } from './task-modal.js';

let modal;
let currentOrder = null;
let unsubscribeTasks = null;

export function initOrderModal() {
  if (window.__orderModalInited) return;
  modal = document.getElementById('order-modal');
  if (!modal) return;
  window.__orderModalInited = true;
  document.getElementById('btn-order-close')?.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.getElementById('btn-order-new-task')?.addEventListener('click', () => {
    if (!currentOrder) return;
    openTaskModal(null, {
      mode: 'create',
      ordemId: currentOrder.id,
      ordemCodigo: currentOrder.codigo,
      prefill: { vencimento: currentOrder.prazo }
    });
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
  document.getElementById('task-modal')?.classList.add('hidden');
  if (!modal) return;
  if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
  currentOrder = { id: orderId };
  const orderRef = doc(db, 'orders', orderId);
  const snap = await getDoc(orderRef);
  if (snap.exists()) {
    const data = snap.data();
    currentOrder.codigo = data.codigo || orderId;
    currentOrder.prazo = data.prazo || '';
    document.getElementById('order-codigo').value = currentOrder.codigo;
    document.getElementById('order-cliente').value = data.cliente || '';
    document.getElementById('order-propriedade').value = data.propriedade || '';
    document.getElementById('order-talhao').value = data.talhao || '';
    document.getElementById('order-abertura').value = data.abertura || '';
    document.getElementById('order-prazo').value = data.prazo || '';
    document.getElementById('order-itens').value = data.itens || '';
    document.getElementById('order-obs').value = data.obs || '';
  }
  loadTasks(orderId);
  modal.classList.remove('hidden');
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
  modal?.classList.add('hidden');
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

function parseDateLocal(v) {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === 'string') {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(v);
}

function formatDDMMYYYY(d) {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function nowLocal() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function endOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

window.openOrderModal = openOrderModal;
