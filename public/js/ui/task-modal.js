import { db, auth } from '../config/firebase.js';
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { parseDateLocal, formatDDMMYYYY } from '../lib/date-utils.js';

let overlay;
let currentTaskId = null;
let currentTaskRef = null;
let original = null;
let currentSource = null;
let taskOrder = null;
let returnOrderId = null;
let creatingTask = false;

export function initTaskModal() {
  if (window.__taskModalInited) return;
  window.__taskModalInited = true;
  overlay = document.getElementById('task-modal-overlay');
  const modal = overlay?.querySelector('.modal');
  if (!overlay || !modal) return;
  document.getElementById('btn-edit')?.addEventListener('click', enterEditMode);
  document.getElementById('task-form')?.addEventListener('submit', e => {
    e.preventDefault();
    saveTaskEdits();
  });
  document.getElementById('btn-close')?.addEventListener('click', () => {
    overlay.setAttribute('hidden','');
    document.body.classList.remove('has-modal');
    exitEditMode();
    if (returnOrderId) {
      window.openOrderModal?.(returnOrderId);
      returnOrderId = null;
    }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) document.getElementById('btn-close')?.click(); });
  document.getElementById('btn-complete')?.addEventListener('click', completeTask);
  document.getElementById('btn-add-comment')?.addEventListener('click', addComment);
}

export async function openTaskModal(taskId, opts = {}) {
  if (typeof opts === 'string') opts = { source: opts };
  const { source = 'table', mode = taskId ? 'view' : 'create', ordemId, ordemCodigo, prefill = {} } = opts;
  currentSource = source;
  document.getElementById('order-modal-overlay')?.setAttribute('hidden','');
  const drawer = document.querySelector('.drawer.is-open');
  const overlayDrawer = document.querySelector('.drawer-overlay.is-open');
  drawer?.classList.remove('is-open');
  overlayDrawer?.classList.remove('is-open');
  const modalEl = overlay?.querySelector('.modal');
  if (!overlay || !modalEl) return;
  modalEl.dataset.mode = mode;
  const chip = document.getElementById('task-order-chip');

  if (mode === 'create') {
    currentTaskId = null;
    currentTaskRef = null;
    original = null;
    taskOrder = { id: ordemId, codigo: ordemCodigo };
    returnOrderId = ordemId || null;
    ['task-titulo', 'task-talhao', 'task-vencimento', 'task-desc'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = false;
      if (id === 'task-titulo') el.value = prefill.titulo || '';
      else if (id === 'task-talhao') el.value = prefill.talhao || '';
      else if (id === 'task-vencimento') el.value = prefill.vencimento || '';
      else if (id === 'task-desc') el.value = prefill.descricao || '';
    });
    document.getElementById('task-form')?.classList.remove('modal-read');
    document.getElementById('btn-edit')?.classList.add('hidden');
    document.getElementById('btn-save')?.classList.remove('hidden');
    document.getElementById('btn-complete')?.classList.add('hidden');
    if (chip) {
      chip.textContent = `#${ordemCodigo}`;
      chip.title = `Ordem #${ordemCodigo}`;
      chip.onclick = () => window.openOrderModal?.(ordemId);
      chip.classList.remove('hidden');
    }
    document.getElementById('comments-list')?.replaceChildren();
    overlay.hidden = false;
    document.body.classList.add('has-modal');
    document.getElementById('task-titulo')?.focus();
    return;
  }

  const farmId = window.taskModalFarmId;
  currentTaskId = taskId;
  currentTaskRef = farmId ? doc(db, 'clients', farmId, 'tasks', taskId) : doc(db, 'tasks', taskId);
  const snap = await getDoc(currentTaskRef);
  if (!snap.exists()) return;
  const data = snap.data();
  original = {
    titulo: data.title || '',
    talhao: data.talhao || data.plotName || '',
    vencimento: data.dueDate || '',
    descricao: data.description || ''
  };
  document.getElementById('task-titulo').value = original.titulo;
  document.getElementById('task-talhao').value = original.talhao;
  document.getElementById('task-vencimento').value = original.vencimento;
  document.getElementById('task-desc').value = original.descricao;
  exitEditMode();
  taskOrder = data.orderId ? { id: data.orderId, codigo: data.orderCode || data.orderId } : null;
  returnOrderId = taskOrder?.id || null;
  if (chip) {
    if (taskOrder) {
      chip.textContent = `#${taskOrder.codigo}`;
      chip.title = `Ver ordem #${taskOrder.codigo}`;
      chip.onclick = () => window.openOrderModal?.(taskOrder.id);
      chip.classList.remove('hidden');
    } else {
      chip.classList.add('hidden');
    }
  }
  await loadComments(currentTaskRef);
  overlay.hidden = false;
  document.body.classList.add('has-modal');
}

export function enterEditMode() {
  ['task-titulo', 'task-talhao', 'task-vencimento', 'task-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  document.getElementById('task-form')?.classList.remove('modal-read');
  document.getElementById('btn-edit')?.classList.add('hidden');
  document.getElementById('btn-save')?.classList.remove('hidden');
  document.getElementById('btn-complete')?.classList.add('hidden');
}

export function exitEditMode() {
  ['task-titulo', 'task-talhao', 'task-vencimento', 'task-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
  document.getElementById('task-form')?.classList.add('modal-read');
  document.getElementById('btn-edit')?.classList.remove('hidden');
  document.getElementById('btn-save')?.classList.add('hidden');
  document.getElementById('btn-complete')?.classList.remove('hidden');
}

export async function saveTaskEdits() {
  const titulo = document.getElementById('task-titulo').value.trim();
  const talhao = document.getElementById('task-talhao').value.trim();
  const vencimento = document.getElementById('task-vencimento').value;
  const descricao = document.getElementById('task-desc').value.trim();
  const saveBtn = document.getElementById('btn-save');
  if (creatingTask) return;
  creatingTask = true;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando...';
  try {
    if (!currentTaskRef) {
      const farmId = window.taskModalFarmId;
      const colRef = farmId ? collection(db, 'clients', farmId, 'tasks') : collection(db, 'tasks');
      const now = Timestamp.now();
      const requestId = crypto.randomUUID();
      await setDoc(doc(colRef, requestId), {
        orderId: taskOrder?.id || '',
        ordemId: taskOrder?.id || '',
        title: titulo,
        talhao,
        plotName: talhao,
        dueDate: vencimento,
        description: descricao,
        status: 'Pendente',
        isCompleted: false,
        criadoEm: now,
        atualizadoEm: now
      });
      currentTaskId = requestId;
      currentTaskRef = doc(colRef, requestId);
      if (taskOrder?.id) {
        const user = auth.currentUser;
        const autor = user?.displayName || user?.email || user?.uid || 'Anônimo';
        await addDoc(collection(doc(db, 'ordens', taskOrder.id), 'comentarios'), {
          tipo: 'tarefa',
          resumo: `🆕 Tarefa criada por ${autor} — "${titulo}"`,
          criadoEm: now
        });
      }
      document.getElementById('task-modal').classList.add('hidden');
      document.dispatchEvent(new CustomEvent('task-updated', { detail: { orderId: taskOrder?.id } }));
      if (returnOrderId) window.openOrderModal?.(returnOrderId);
      taskOrder = null;
      returnOrderId = null;
      exitEditMode();
      return;
    }

    const changes = [];
    const updates = {};
    if (titulo !== original.titulo) {
      changes.push({ campo: 'titulo', de: original.titulo, para: titulo });
      updates.title = titulo;
    }
    if (talhao !== original.talhao) {
      changes.push({ campo: 'talhao', de: original.talhao, para: talhao });
      updates.talhao = talhao;
      updates.plotName = talhao;
    }
    if (vencimento !== original.vencimento) {
      changes.push({ campo: 'vencimento', de: formatDate(original.vencimento), para: formatDate(vencimento) });
      updates.dueDate = vencimento;
    }
    if (descricao !== original.descricao) {
      changes.push({ campo: 'descricao', de: original.descricao, para: descricao });
      updates.description = descricao;
    }
    if (!changes.length) {
      exitEditMode();
      return;
    }
    await updateDoc(currentTaskRef, updates);
    const user = auth.currentUser;
    const autor = user?.displayName || user?.email || user?.uid || 'Anônimo';
    const now = Timestamp.now();
    const resumoParts = changes.map(ch => {
      if (ch.campo === 'descricao') return 'Descrição: alterada';
      if (ch.campo === 'vencimento') return `Vencimento: ${ch.de} → ${ch.para}`;
      const cap = ch.campo.charAt(0).toUpperCase() + ch.campo.slice(1);
      return `${cap}: "${ch.de}" → "${ch.para}"`;
    });
    const resumo = `✏️ Edição por ${autor} — ${formatDateTime(now)} • ${resumoParts.join(' • ')}`;
    await addDoc(collection(currentTaskRef, 'comentarios'), {
      tipo: 'edicao',
      autorUid: user?.uid || '',
      autorNome: autor,
      criadoEm: now,
      mudancas: changes,
      resumo
    });
    original = { titulo, talhao, vencimento, descricao };
    exitEditMode();
    await loadComments(currentTaskRef);
    document.dispatchEvent(new CustomEvent('task-updated', { detail: { id: currentTaskId, orderId: taskOrder?.id } }));
  } catch (e) {
    console.error(e);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar';
    creatingTask = false;
  }
}

export async function completeTask() {
  if (!currentTaskRef) return;
  const user = auth.currentUser;
  const autor = user?.displayName || user?.email || user?.uid || 'Anônimo';
  const now = Timestamp.now();
  const snap = await getDoc(currentTaskRef);
  const data = snap.data() || {};
  const updates = { status: 'Concluída', isCompleted: true };
  if (!data.fim) updates.fim = now;
  await updateDoc(currentTaskRef, updates);
  await addDoc(collection(currentTaskRef, 'comentarios'), {
    tipo: 'conclusao',
    autorUid: user?.uid || '',
    autorNome: autor,
    criadoEm: now,
    resumo: `✅ Concluída por ${autor} — ${formatDateTime(now)}`
  });
  document.getElementById('task-modal').classList.add('hidden');
  exitEditMode();
  document.dispatchEvent(new CustomEvent('task-updated', { detail: { id: currentTaskId, orderId: taskOrder?.id } }));
  if (returnOrderId) {
    window.openOrderModal?.(returnOrderId);
    returnOrderId = null;
  }
}

export async function addComment() {
  if (!currentTaskRef) return;
  const text = document.getElementById('comment-input').value.trim();
  if (!text) return;
  const user = auth.currentUser;
  const autor = user?.displayName || user?.email || user?.uid || 'Anônimo';
  const now = Timestamp.now();
  await addDoc(collection(currentTaskRef, 'comentarios'), {
    tipo: 'comentario',
    autorUid: user?.uid || '',
    autorNome: autor,
    texto: text,
    criadoEm: now
  });
  document.getElementById('comment-input').value = '';
  await loadComments(currentTaskRef);
}

async function loadComments(taskRef) {
  const list = document.getElementById('comments-list');
  if (!list) return;
  list.innerHTML = '';
  const q = query(collection(taskRef, 'comentarios'), orderBy('criadoEm', 'desc'), limit(20));
  const snap = await getDocs(q);
  snap.forEach(c => {
    const data = c.data();
    const item = document.createElement('div');
    item.className = 'comment-item';
    const avatar = document.createElement('div');
    avatar.className = 'comment-avatar';
    avatar.textContent = (data.autorNome || '?').split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    const content = document.createElement('div');
    content.className = 'comment-content';
    const meta = document.createElement('div');
    meta.className = 'comment-meta';
    meta.textContent = `${data.autorNome || 'Anônimo'} • ${formatDateTime(data.criadoEm)}`;
    const text = document.createElement('p');
    text.className = 'text-sm';
    text.textContent = data.texto || data.resumo || '';
    content.appendChild(meta);
    content.appendChild(text);
    item.appendChild(avatar);
    item.appendChild(content);
    list.appendChild(item);
  });
}

function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(ts) {
  let date;
  if (ts instanceof Timestamp) date = ts.toDate();
  else if (ts?.toDate) date = ts.toDate();
  else date = new Date(ts);
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

