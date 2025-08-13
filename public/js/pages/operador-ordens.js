/* Ordens: filtros + tabela harmonizada */

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

const ordersTable = document.getElementById('orders-table');
const modal = document.getElementById('order-modal');
const form = document.getElementById('order-form');
const commentList = document.getElementById('order-comments-list');

render();
document.getElementById('filter-status').addEventListener('change', render);
document.getElementById('filter-search').addEventListener('input', render);

document.getElementById('btn-order-close').addEventListener('click', closeModal);
document.getElementById('btn-order-edit').addEventListener('click', enableEdit);
document.getElementById('btn-order-save').addEventListener('click', saveEdit);
document.getElementById('btn-order-conclude').addEventListener('click', () => updateStatus('Concluída'));
document.getElementById('btn-order-cancel').addEventListener('click', () => updateStatus('Cancelada'));
document.getElementById('btn-order-add-comment').addEventListener('click', addComment);

function render() {
  if (!ordersTable) return;
  ordersTable.innerHTML = '';
  const statusFilter = document.getElementById('filter-status').value;
  const search = document.getElementById('filter-search').value.toLowerCase();

  getFilteredOrders(statusFilter, search).forEach(o => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-200 hover:bg-gray-100';

    tr.innerHTML = `
      <td class="px-3 py-3">${o.id}</td>
      <td class="px-3 py-3 max-w-[200px] truncate">${o.cliente}</td>
      <td class="px-3 py-3">${o.talhao}</td>
      <td class="px-3 py-3 min-w-[112px]">${o.prazo}</td>
      <td class="px-3 py-3 min-w-[120px]">${renderStatus(o.status)}</td>
      <td class="px-3 py-3 min-w-[96px] text-right">${o.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td class="px-3 py-3">
        <div class="flex gap-2">
          <button class="btn-ghost text-gray-600" title="Ver detalhes" data-action="view" data-id="${o.id}"><i class="fas fa-eye"></i></button>
          <button class="btn-ghost text-gray-600" title="Encerrar" data-action="done" data-id="${o.id}"><i class="fas fa-flag-checkered"></i></button>
          <button class="btn-ghost text-gray-600" title="Cancelar" data-action="cancel" data-id="${o.id}"><i class="fas fa-ban"></i></button>
        </div>
      </td>`;

    ordersTable.appendChild(tr);
  });

  ordersTable.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', handleRowAction);
  });
}

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

function openModal(order) {
  state.current = order;
  form.classList.add('modal-read');
  state.editing = false;
  fillForm(order);
  renderComments();
  modal.classList.remove('hidden');
  document.getElementById('order-codigo').focus();
}

function closeModal() {
  modal.classList.add('hidden');
}

function enableEdit() {
  if (!state.current) return;
  state.editing = true;
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
  form.classList.add('modal-read');
  toggleFormFields(true);
  document.getElementById('btn-order-save').classList.add('hidden');
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
  document.getElementById('order-obs').value = o.obs || '';
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

