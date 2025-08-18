/* Ordens: filtros + tabela harmonizada */

import { db, auth } from '../config/firebase.js';
import { collection, query, where, getDocs, doc, runTransaction, setDoc, addDoc, Timestamp, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { showToast } from '../services/ui.js';
import { initTaskDetail, openTaskDetail, hideTaskDetail } from '../ui/task-detail.js';
import { parseDateLocal, endOfLocalDay } from '../lib/date-utils.js';

/* QA rápido:
   - Criar tarefa com vencimento amanhã → aparece como Pendente
   - Editar para ontem → visualmente Atrasada sem alterar no banco
   - Concluir tarefa → vira Concluída e progresso atualiza
   - Reabrir modal da ordem repetidas vezes → lista não duplica
   - "Ver detalhes" abre sempre a tarefa correta
*/
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
  modal = document.getElementById('order-view');
  form = document.getElementById('order-form');
  commentList = document.getElementById('order-comments-list');
  if (ordersTable && !ordersTable.__bound) {
    ordersTable.addEventListener('click', handleRowAction);
    ordersTable.__bound = true;
  }
  render();
  initTaskDetail();
  document.getElementById('btn-new-order')?.addEventListener('click', openOrderCreateModal);
  document.getElementById('filter-status')?.addEventListener('change', render);
  document.getElementById('filter-search')?.addEventListener('input', render);
  document.getElementById('btn-order-edit')?.addEventListener('click', enableEdit);
  document.getElementById('btn-order-duplicate')?.addEventListener('click', () => {
    if (state.current) duplicateOrder(state.current.id);
  });
  document.getElementById('btn-order-save')?.addEventListener('click', () => {
    if (modal.dataset.mode === 'create') saveOrderCreate();
    else saveEdit();
  });
  document.getElementById('btn-order-conclude')?.addEventListener('click', () => updateStatus('Concluída'));
  document.getElementById('btn-order-cancel')?.addEventListener('click', () => {
    if (modal.dataset.mode === 'create') history.back();
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

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
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
      <td class="px-3 py-3 w-32"><div class="text-sm"><span class="open-count">0</span>/<span class="total-count">0</span></div><div class="progress" aria-label="Progresso de tarefas: 0 de 0 concluídas"><div class="progress__bar" style="width:0%"></div></div></td>
      <td class="px-3 py-3 min-w-[96px] text-right">${o.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td class="px-3 py-3">
        <div class="flex gap-2">
          <button type="button" class="btn-ghost text-gray-600" title="Ver detalhes" data-action="view-order" data-id="${o.id}"><i class="fas fa-eye"></i></button>
          <button type="button" class="btn-ghost text-gray-600" title="Duplicar" data-action="duplicate" data-id="${o.id}"><i class="fas fa-copy"></i></button>
          <button type="button" class="btn-ghost text-gray-600" title="Encerrar" data-action="done" data-id="${o.id}"><i class="fas fa-flag-checkered"></i></button>
          <button type="button" class="btn-ghost text-gray-600" title="Cancelar" data-action="cancel" data-id="${o.id}"><i class="fas fa-ban"></i></button>
        </div>
      </td>`;

    ordersTable.appendChild(tr);
    const tdTarefas = tr.children[5];
    fetchTasksStats(o.id).then(stats => updateTasksCell(tdTarefas, stats));
  });

}

async function fetchTasksStats(orderId) {
  const q = query(collection(db, 'tasks'), where('ordemId', '==', orderId));
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
  const s = normalize(t.status || '');
  if (s === 'concluida' || t.isCompleted) return 'Concluída';
  if (s === 'atrasada') return 'Atrasada';
  const due = t.dueDate || t.vencimento;
  if (due) {
    const d = parseDateLocal(due);
    if (endOfLocalDay(d) < nowLocal()) return 'Atrasada';
  }
  return 'Pendente';
}

function updateTasksCell(td, stats) {
  td.querySelector('.open-count').textContent = stats.open;
  td.querySelector('.total-count').textContent = stats.total;
  const percent = stats.total ? (stats.completed / stats.total) * 100 : 0;
  td.querySelector('.progress__bar').style.width = `${percent}%`;
  td.querySelector('.progress').setAttribute('aria-label', `Progresso de tarefas: ${stats.completed} de ${stats.total} concluídas`);
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

async function duplicateOrder(orderId) {
  const original = state.orders.find(o => o.id === orderId);
  if (!original) return;
  const codigo = await generateOrderCode();
  const dup = {
    id: codigo,
    codigo,
    cliente: original.cliente,
    propriedade: original.propriedade,
    talhao: original.talhao,
    abertura: formatDate(new Date()),
    prazo: original.prazo,
    itens: original.itens,
    obs: original.obs,
    status: 'Aberta',
    total: original.total,
    comments: []
  };
  openModal(dup, 'create');
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
    const ordemCodigo = document.getElementById('order-codigo').value || orderId;
    const prazo = document.getElementById('order-prazo').value || '';
    window.taskOriginHash = `order/${orderId}`;
    openTaskDetail(null, { mode: 'create', ordemId: orderId, ordemCodigo, prefill: { vencimento: prazo } });
    window.location.hash = `task/new`;
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('task-updated', e => {
  const orderId = e.detail?.orderId || state.current?.id;
  if (!orderId) return;
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
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const order = state.orders.find(o => o.id === id);
  if (!order) return;
  if (action === 'view-order') {
    window.location.href = `order-details.html#order/${id}`;
  } else if (action === 'done') {
    state.current = order;
    updateStatus('Concluída');
  } else if (action === 'cancel') {
    state.current = order;
    updateStatus('Cancelada');
  } else if (action === 'duplicate') {
    duplicateOrder(id);
  }
}

function handleHashChange() {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('task/')) {
    const id = hash.split('/')[1];
    document.getElementById('orders-section')?.classList.add('hidden');
    document.getElementById('order-view').hidden = true;
    openTaskDetail(id === 'new' ? null : id);
    document.getElementById('task-view').hidden = false;
    return;
  }
  hideTaskDetail();
  document.getElementById('task-view').hidden = true;
  if (!hash.startsWith('order/')) {
    closeModal(true);
  }
}

function renderStatus(status) {
  const norm = normalize(status);
  const cls = norm === 'aberta'
    ? 'pill pill--info'
    : norm === 'em andamento'
    ? 'pill pill--warn'
    : norm === 'concluída' || norm === 'concluida'
    ? 'pill pill--success'
    : norm === 'cancelada'
    ? 'pill pill--danger'
    : 'pill';
  return `<span class="${cls}">${status}</span>`;
}

function openModal(order, mode = 'view') {
  state.current = order;
  modal.dataset.mode = mode;
  fillForm(order, mode);
  renderComments();
  form.dataset.dirty = 'false';
  if (mode === 'create') {
    form.classList.remove('modal-read');
    toggleFormFields(false);
    document.getElementById('btn-order-save').classList.remove('hidden');
    document.getElementById('btn-order-conclude').classList.add('hidden');
    document.getElementById('btn-order-cancel').classList.add('hidden');
    document.getElementById('btn-order-edit')?.classList.add('hidden');
    document.getElementById('btn-order-duplicate')?.classList.add('hidden');
    document.getElementById('order-modal-title').textContent = 'Nova Ordem';
    document.getElementById('order-tasks').classList.add('hidden');
    document.getElementById('order-cliente').focus();
  } else {
    form.classList.add('modal-read');
    toggleFormFields(true);
    document.getElementById('btn-order-save').classList.add('hidden');
    document.getElementById('btn-order-conclude').classList.remove('hidden');
    document.getElementById('btn-order-cancel').classList.remove('hidden');
    document.getElementById('btn-order-edit')?.classList.remove('hidden');
    document.getElementById('btn-order-duplicate')?.classList.remove('hidden');
    document.getElementById('order-modal-title').textContent = 'Detalhes da Ordem';
    document.getElementById('order-tasks').classList.remove('hidden');
    document.getElementById('order-codigo').focus();
  }
  const newTaskBtn = document.getElementById('btn-order-new-task');
  if (newTaskBtn) newTaskBtn.onclick = () => newTaskFromOrder(order.id);
  state.editing = (mode === 'edit');
  document.getElementById('orders-section')?.classList.add('hidden');
  document.getElementById('order-view').hidden = false;
  window.location.hash = `order/${order.id}`;
}

function closeModal(force = false) {
  if (!force && (modal.dataset.mode === 'create' || modal.dataset.mode === 'edit') && form.dataset.dirty === 'true') {
    if (!confirm('Descartar alterações?')) return;
  }
  document.getElementById('order-view').hidden = true;
  document.getElementById('orders-section')?.classList.remove('hidden');
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

function nowLocal() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}


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

function fillForm(o, mode = 'view') {
  const codeChip = document.getElementById('order-code-chip');
  if (codeChip) {
    codeChip.textContent = o.id || '';
    codeChip.classList.toggle('hidden', !o.id);
  }
  const statusChip = document.getElementById('order-status-chip');
  if (statusChip) {
    const st = o.status || '';
    statusChip.textContent = st || '—';
    const cls = st
      ? st === 'Concluída'
        ? 'pill pill--success'
        : st === 'Cancelada'
          ? 'pill pill--danger'
          : st === 'Em andamento'
            ? 'pill pill--warn'
            : 'pill pill--info'
      : 'pill';
    statusChip.className = cls;
  }
  document.getElementById('order-codigo').value = o.id || '—';
  document.getElementById('order-cliente').value = o.cliente || (mode === 'view' ? '—' : '');
  document.getElementById('order-propriedade').value = o.propriedade || (mode === 'view' ? '—' : '');
  document.getElementById('order-talhao').value = o.talhao || (mode === 'view' ? '—' : '');
  const aberturaEl = document.getElementById('order-abertura');
  aberturaEl.type = 'text';
  aberturaEl.value = o.abertura || '—';
  const prazoEl = document.getElementById('order-prazo');
  prazoEl.type = mode === 'view' ? 'text' : 'date';
  prazoEl.value = o.prazo || '';
  document.getElementById('order-itens').value = o.itens || (mode === 'view' ? '—' : '');
  document.getElementById('order-total').value = (o.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  document.getElementById('order-obs').value = o.obs || (mode === 'view' ? '—' : '');
  document.getElementById('order-total').disabled = true;
  toggleFormFields(mode === 'view');
  if (mode !== 'view') document.getElementById('btn-order-save').classList.remove('hidden');
  else document.getElementById('btn-order-save').classList.add('hidden');
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

