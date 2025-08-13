/* Ordens: filtros + tabela harmonizada */

import { db, auth } from '../config/firebase.js';
import { collection, query, where, getDocs, doc, runTransaction, setDoc, addDoc, Timestamp, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { showToast } from '../services/ui.js';
import { initTaskModal, openTaskModal } from '../ui/task-modal.js';

const state = {
  orders: [
    {
      id: 'ORD-001',
      cliente: 'Fazenda Modelo',
      propriedade: 'Sítio 1',
      talhao: 'A1',
      abertura: '2024-06-01',
      prazo: '2024-06-10',
      status: 'Aberta',
      total: 1500,
      itens: 'Item 1 - 10kg',
      obs: '',
      comments: []
    },
    {
      id: 'ORD-002',
      cliente: 'Fazenda Beta',
      propriedade: 'Área Central',
      talhao: 'B2',
      abertura: '2024-06-03',
      prazo: '2024-06-15',
      status: 'Em andamento',
      total: 820,
      itens: 'Item 2 - 5un',
      obs: '',
      comments: []
    }
  ],
  current: null,
  editing: false
};

let ordersTable, modal, form, commentList;

function init() {
  ordersTable = document.getElementById('orders-table');
  modal = document.getElementById('order-modal');
  form = document.getElementById('order-form');
  commentList = document.getElementById('order-comments-list');
  render();
  initTaskModal();
  document.getElementById('btn-new-order')?.addEventListener('click', openOrderCreateModal);
  document.getElementById('filter-status')?.addEventListener('change', render);
  document.getElementById('filter-search')?.addEventListener('input', render);
  document.getElementById('btn-order-close')?.addEventListener('click', closeModal);
  document.getElementById('btn-order-edit')?.addEventListener('click', enableEdit);
  document.getElementById('btn-order-save')?.addEventListener('click', () => {
    if (modal.dataset.mode === 'create') saveOrderCreate();
    else saveEdit();
  });
  document.getElementById('btn-order-conclude')?.addEventListener('click', () => updateStatus('Concluída'));
  document.getElementById('btn-order-cancel')?.addEventListener('click', () => {
    if (modal.dataset.mode === 'create') closeModal();
    else updateStatus('Cancelada');
  });
  document.getElementById('btn-order-add-comment')?.addEventListener('click', addComment);

  ['order-cliente','order-propriedade','order-talhao','order-prazo','order-itens','order-obs'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', () => {
      form.dataset.dirty = 'true';
      if (id === 'order-itens') calculateTotal();
    });
  });

  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}

function render() {
  if (!ordersTable) return;
  ordersTable.innerHTML = '';
  const statusFilter = document.getElementById('filter-status').value;
  const search = document.getElementById('filter-search').value.toLowerCase();

  getFilteredOrders(statusFilter, search).forEach(o => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-200 hover:bg-gray-100';

    /* Progresso de tarefas na tabela de ordens */
    tr.innerHTML = `
      <td class="px-3 py-3">${o.id}</td>
      <td class="px-3 py-3 max-w-[200px] truncate">${o.cliente}</td>
      <td class="px-3 py-3">${o.talhao}</td>
      <td class="px-3 py-3 min-w-[112px]">${o.prazo}</td>
      <td class="px-3 py-3 min-w-[120px]">${renderStatus(o.status)}</td>
      <td class="px-3 py-3 w-32"><div class="text-sm"><span class="open-count">0</span>/<span class="total-count">0</span></div><div class="task-progress" aria-label="Progresso de tarefas: 0 de 0 concluídas"><div style="width:0%"></div></div></td>
      <td class="px-3 py-3 min-w-[96px] text-right">${o.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td class="px-3 py-3">
        <div class="flex gap-2">
          <button class="btn-ghost text-gray-600" title="Ver detalhes" data-action="view" data-id="${o.id}"><i class="fas fa-eye"></i></button>
          <button class="btn-ghost text-gray-600" title="Encerrar" data-action="done" data-id="${o.id}"><i class="fas fa-flag-checkered"></i></button>
          <button class="btn-ghost text-gray-600" title="Cancelar" data-action="cancel" data-id="${o.id}"><i class="fas fa-ban"></i></button>
        </div>
      </td>`;

    ordersTable.appendChild(tr);
    const tdTarefas = tr.children[5];
    fetchTasksStats(o.id).then(stats => updateTasksCell(tdTarefas, stats));
  });

  ordersTable.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', handleRowAction);
  });
}

async function fetchTasksStats(orderId) {
  const q = query(collection(db, 'tasks'), where('orderId', '==', orderId));
  const snap = await getDocs(q);
  let total = 0, completed = 0, open = 0;
  snap.forEach(d => {
    total++;
    const st = taskStatus(d.data());
    if (st === 'Concluída') completed++;
    if (st === 'Pendente' || st === 'Atrasada') open++;
  });
  return { total, completed, open };
}

function taskStatus(t) {
  if (t.isCompleted || t.status === 'Concluída') return 'Concluída';
  if (t.dueDate && new Date(t.dueDate) < new Date()) return 'Atrasada';
  return 'Pendente';
}

function updateTasksCell(td, stats) {
  td.querySelector('.open-count').textContent = stats.open;
  td.querySelector('.total-count').textContent = stats.total;
  const percent = stats.total ? (stats.completed / stats.total) * 100 : 0;
  td.querySelector('.task-progress div').style.width = `${percent}%`;
  td.querySelector('.task-progress').setAttribute('aria-label', `Progresso de tarefas: ${stats.completed} de ${stats.total} concluídas`);
}

async function generateOrderCode() {
  const counterRef = doc(db, 'meta', 'ordens');
  try {
    const seq = await runTransaction(db, async tx => {
      const snap = await tx.get(counterRef);
      let current = 0;
      if (!snap.exists()) {
        tx.set(counterRef, { seq: 1 });
        current = 1;
      } else {
        current = (snap.data().seq || 0) + 1;
        tx.update(counterRef, { seq: current });
      }
      return current;
    });
    return `ORD-${String(seq).padStart(4, '0')}`;
  } catch (e) {
    console.warn('Counter unavailable, using fallback', e);
    return `ORD-${Date.now()}`;
  }
}

async function openOrderCreateModal() {
  const codigo = await generateOrderCode();
  const now = Timestamp.now();
  const blank = {
    id: codigo,
    codigo,
    cliente: '',
    propriedade: '',
    talhao: '',
    abertura: formatDate(now.toDate()),
    prazo: '',
    itens: '',
    obs: '',
    status: 'Aberta',
    total: 0,
    comments: []
  };
  openModal(blank, 'create');
  calculateTotal();
}

function parseItems(text) {
  return text.split('\n').map(l => {
    const [descricao, qtd, un, custo] = l.split(',').map(p => p?.trim());
    return { descricao, qtd: Number(qtd) || 0, un: un || '', custo: Number(custo) || 0 };
  }).filter(i => i.descricao);
}

function calculateTotal() {
  const items = parseItems(document.getElementById('order-itens').value || '');
  const total = items.reduce((sum, i) => sum + (i.qtd * i.custo), 0);
  document.getElementById('order-total').value = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return total;
}

async function newTaskFromOrder(orderId) {
  const btn = document.getElementById('btn-order-new-task');
  if (!btn) return;
  btn.disabled = true;
  try {
    if (!document.getElementById('task-modal')) {
      console.error('Task modal not found');
      showToast('Não foi possível abrir o formulário de nova tarefa', 'error');
      return;
    }
    const ordemCodigo = document.getElementById('order-codigo').value || orderId;
    const prazo = document.getElementById('order-prazo').value || '';
    modal.classList.add('hidden');
    await openTaskModal(null, { source: 'order', mode: 'create', ordemId: orderId, ordemCodigo, prefill: { vencimento: prazo } });
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('task-updated', e => {
  const orderId = e.detail?.orderId || state.current?.id;
  if (!orderId) return;
  if (state.current && state.current.id === orderId) {
    loadTasksForModal(orderId);
  }
  if (ordersTable) {
    const row = [...ordersTable.querySelectorAll('button[data-id]')].find(b => b.dataset.id === orderId)?.closest('tr');
    if (row) fetchTasksStats(orderId).then(stats => updateTasksCell(row.children[5], stats));
  }
});

function getFilteredOrders(status, term) {
  return state.orders.filter(o => {
    const matchesStatus = status === 'todas' || normalize(o.status) === status;
    const matchesTerm = !term ||
      o.id.toLowerCase().includes(term) ||
      (o.cliente + o.propriedade).toLowerCase().includes(term);
    return matchesStatus && matchesTerm;
  });
}

function handleRowAction(e) {
  const id = e.currentTarget.dataset.id;
  const action = e.currentTarget.dataset.action;
  const order = state.orders.find(o => o.id === id);
  if (!order) return;
  if (action === 'view') {
    openModal(order);
  } else if (action === 'done') {
    state.current = order;
    updateStatus('Concluída');
  } else if (action === 'cancel') {
    state.current = order;
    updateStatus('Cancelada');
  }
}

function renderStatus(status) {
  const cls = {
    'aberta': 'aberta',
    'em andamento': 'em-andamento',
    'concluída': 'concluida',
    'cancelada': 'cancelada'
  }[normalize(status)] || 'default';
  return `<span class="status-pill ${cls}">${status}</span>`;
}

function openModal(order, mode = 'view') {
  state.current = order;
  fillForm(order);
  renderComments();
  modal.dataset.mode = mode;
  form.dataset.dirty = 'false';
  if (mode === 'create') {
    form.classList.remove('modal-read');
    toggleFormFields(false);
    document.getElementById('btn-order-save').classList.remove('hidden');
    document.getElementById('btn-order-conclude').classList.add('hidden');
    document.getElementById('btn-order-cancel').classList.add('hidden');
    document.getElementById('btn-order-edit').classList.add('hidden');
    document.getElementById('order-modal-title').textContent = 'Nova Ordem';
    document.getElementById('order-tasks').classList.add('hidden');
    document.getElementById('order-cliente').focus();
  } else {
    form.classList.add('modal-read');
    toggleFormFields(true);
    document.getElementById('btn-order-save').classList.add('hidden');
    document.getElementById('btn-order-conclude').classList.remove('hidden');
     document.getElementById('btn-order-cancel').classList.remove('hidden');
    document.getElementById('btn-order-edit').classList.remove('hidden');
    document.getElementById('order-modal-title').textContent = 'Detalhes da Ordem';
    document.getElementById('order-tasks').classList.remove('hidden');
    loadTasksForModal(order.id);
    document.getElementById('order-codigo').focus();
  }
  const newTaskBtn = document.getElementById('btn-order-new-task');
  if (newTaskBtn) newTaskBtn.onclick = () => newTaskFromOrder(order.id);
  state.editing = (mode === 'edit');
  modal.classList.remove('hidden');
}

function closeModal(force = false) {
  if (!force && (modal.dataset.mode === 'create' || modal.dataset.mode === 'edit') && form.dataset.dirty === 'true') {
    if (!confirm('Descartar alterações?')) return;
  }
  modal.classList.add('hidden');
  modal.dataset.mode = 'view';
}

function enableEdit() {
  if (!state.current) return;
  state.editing = true;
  modal.dataset.mode = 'edit';
  form.classList.remove('modal-read');
  toggleFormFields(false);
  document.getElementById('btn-order-save').classList.remove('hidden');
}

function saveEdit() {
  if (!state.current) return;
  const o = state.current;
  const diffs = [];
  const map = {
    'order-cliente': 'cliente',
    'order-propriedade': 'propriedade',
    'order-talhao': 'talhao',
    'order-prazo': 'prazo',
    'order-itens': 'itens',
    'order-obs': 'obs'
  };
  for (const id in map) {
    const field = map[id];
    const el = document.getElementById(id);
    if (el && o[field] !== el.value) {
      diffs.push(`${field}: ${o[field] || ''} → ${el.value}`);
      o[field] = el.value;
    }
  }
  if (diffs.length) {
    o.comments.unshift({
      author: 'Usuário',
      text: '✏️ ' + diffs.join(', '),
      date: new Date()
    });
    renderComments();
    render();
  }
  state.editing = false;
  modal.dataset.mode = 'view';
  form.classList.add('modal-read');
  toggleFormFields(true);
  document.getElementById('btn-order-save').classList.add('hidden');
  form.dataset.dirty = 'false';
}

async function saveOrderCreate() {
  const required = ['order-cliente','order-propriedade','order-talhao','order-prazo'];
  let valid = true;
  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.setAttribute('aria-invalid','true');
      valid = false;
    } else {
      el.removeAttribute('aria-invalid');
    }
  });
  if (!valid) {
    showToast('Preencha os campos obrigatórios', 'error');
    return;
  }
  const saveBtn = document.getElementById('btn-order-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';
  try {
    const codigo = document.getElementById('order-codigo').value;
    const cliente = document.getElementById('order-cliente').value.trim();
    const propriedade = document.getElementById('order-propriedade').value.trim();
    const talhao = document.getElementById('order-talhao').value.trim();
    const prazo = document.getElementById('order-prazo').value;
    const itensText = document.getElementById('order-itens').value;
    const itens = parseItems(itensText);
    const total = calculateTotal();
    const obs = document.getElementById('order-obs').value.trim();
    const orderData = {
      codigo,
      cliente,
      propriedade,
      talhao,
      abertura: serverTimestamp(),
      prazo,
      status: 'Aberta',
      itens,
      total,
      observacoes: obs
    };
    const orderRef = doc(db, 'ordens', codigo);
    await setDoc(orderRef, orderData);
    const user = auth.currentUser;
    const autor = user?.displayName || user?.email || user?.uid || 'Anônimo';
    const resumo = `🆕 Ordem criada por ${autor} — #${codigo}`;
    await addDoc(collection(orderRef, 'comentarios'), { tipo: 'criacao', resumo, criadoEm: Timestamp.now() });
    state.orders.unshift({
      id: codigo,
      cliente,
      propriedade,
      talhao,
      abertura: new Date().toISOString().split('T')[0],
      prazo,
      status: 'Aberta',
      total,
      itens: itensText,
      obs,
      comments: []
    });
    render();
    const firstRow = ordersTable.querySelector('tr');
    firstRow?.classList.add('highlight');
    setTimeout(() => firstRow?.classList.remove('highlight'), 2000);
    showToast('Ordem criada com sucesso', 'success');
    closeModal(true);
  } catch (e) {
    console.error(e);
    showToast('Erro ao salvar ordem', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar';
  }
}

function updateStatus(newStatus) {
  if (!state.current) return;
  state.current.status = newStatus;
  state.current.comments.unshift({
    author: 'Usuário',
    text: `${newStatus === 'Concluída' ? '✅ Concluída' : '⛔ Cancelada'} por Usuário`,
    date: new Date()
  });
  renderComments();
  render();
}

function addComment() {
  if (!state.current) return;
  const input = document.getElementById('order-comment-input');
  const txt = input.value.trim();
  if (!txt) return;
  state.current.comments.unshift({ author: 'Usuário', text: txt, date: new Date() });
  input.value = '';
  renderComments();
}

/* Lista de tarefas no modal de ordem */
async function loadTasksForModal(orderId) {
  const list = document.getElementById('order-tasks-list');
  if (!list) return;
  list.innerHTML = '';
  const q = query(collection(db, 'tasks'), where('orderId', '==', orderId));
  const snap = await getDocs(q);
  let total = 0, completed = 0, open = 0;
  snap.forEach(d => {
    const data = d.data();
    const status = taskStatus(data);
    total++;
    if (status === 'Concluída') completed++;
    if (status === 'Pendente' || status === 'Atrasada') open++;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-2 py-2">${data.title || d.id}</td>
      <td class="px-2 py-2">${data.dueDate ? new Date(data.dueDate).toLocaleDateString('pt-BR') : '-'}</td>
      <td class="px-2 py-2">${renderTaskStatus(status)}</td>
      <td class="px-2 py-2"><button class="text-blue-700 underline text-sm" data-task="${d.id}">Ver detalhes</button></td>`;
    list.appendChild(tr);
  });
  list.querySelectorAll('button[data-task]').forEach(btn => {
    btn.addEventListener('click', e => openTaskModal(e.currentTarget.dataset.task, 'order'));
  });
  const counter = document.getElementById('order-tasks-counter');
  if (counter) counter.textContent = `${open}/${total} abertas`;
  const progress = document.querySelector('#order-tasks .task-progress div');
  const wrapper = document.querySelector('#order-tasks .task-progress');
  const percent = total ? (completed / total) * 100 : 0;
  if (progress) progress.style.width = `${percent}%`;
  wrapper?.setAttribute('aria-label', `Progresso de tarefas: ${completed} de ${total} concluídas`);
}

function renderTaskStatus(st) {
  const cls = st === 'Concluída'
    ? 'bg-green-100 text-green-800'
    : st === 'Atrasada'
    ? 'bg-red-100 text-red-800'
    : 'bg-yellow-100 text-yellow-800';
  return `<span class="px-2 py-1 rounded-full text-xs font-semibold ${cls}">${st}</span>`;
}

export function openOrderModal(orderId) {
  document.getElementById('task-modal')?.classList.add('hidden');
  const order = state.orders.find(o => o.id === orderId);
  if (order) openModal(order);
}

window.openOrderModal = openOrderModal;

function renderComments() {
  if (!state.current) return;
  commentList.innerHTML = '';
  state.current.comments.forEach(c => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML = `
      <div class="comment-avatar">${c.author.charAt(0).toUpperCase()}</div>
      <div class="comment-content">
        <p class="text-sm">${c.text}</p>
        <span class="comment-meta">${c.author} • ${formatDate(c.date)}</span>
      </div>`;
    commentList.appendChild(item);
  });
}

function fillForm(o) {
  document.getElementById('order-codigo').value = o.id || '';
  document.getElementById('order-cliente').value = o.cliente || '';
  document.getElementById('order-propriedade').value = o.propriedade || '';
  document.getElementById('order-talhao').value = o.talhao || '';
  document.getElementById('order-abertura').value = o.abertura || '';
  document.getElementById('order-prazo').value = o.prazo || '';
  document.getElementById('order-itens').value = o.itens || '';
  document.getElementById('order-total').value = (o.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  document.getElementById('order-obs').value = o.obs || '';
  document.getElementById('order-total').disabled = true;
  toggleFormFields(true);
  document.getElementById('btn-order-save').classList.add('hidden');
}

function toggleFormFields(disabled) {
  ['order-cliente','order-propriedade','order-talhao','order-prazo','order-itens','order-obs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
}

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function closeOnEsc(e) {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
}

window.addEventListener('keydown', closeOnEsc);

init();

