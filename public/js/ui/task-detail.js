import { db, auth } from '../config/firebase.js';
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

let view;
let currentTaskId = null;
let currentTaskRef = null;
let original = null;
let taskOrder = null;

export function initTaskDetail() {
  if (window.__taskDetailInited) return;
  window.__taskDetailInited = true;
  view = document.getElementById('task-view');
  document.getElementById('btn-task-back')?.addEventListener('click', () => {
    const target = window.taskOriginHash || '';
    window.taskOriginHash = null;
    window.location.hash = target;
  });
  document.getElementById('btn-edit')?.addEventListener('click', enterEditMode);
  document.getElementById('task-form')?.addEventListener('submit', e => {
    e.preventDefault();
    saveTaskEdits();
  });
  document.getElementById('btn-complete')?.addEventListener('click', completeTask);
  document.getElementById('btn-add-comment')?.addEventListener('click', addComment);
}

export async function openTaskDetail(taskId, opts = {}) {
  const { mode = taskId ? 'view' : 'create', ordemId, ordemCodigo, prefill = {} } = opts;
  if (mode === 'create') {
    currentTaskId = null;
    currentTaskRef = null;
    original = null;
    taskOrder = ordemId ? { id: ordemId, codigo: ordemCodigo } : null;
    ['task-titulo','task-talhao','task-vencimento','task-desc'].forEach(id => {
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
    document.getElementById('comments-list')?.replaceChildren();
    updateStatusChip('Pendente');
    view.hidden = false;
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
  updateStatusChip(data.status || (data.isCompleted ? 'Concluída' : 'Pendente'));
  await loadComments(currentTaskRef);
  view.hidden = false;
}

function updateStatusChip(status) {
  const chip = document.getElementById('task-status-chip');
  if (!chip) return;
  chip.textContent = status || '—';
  const norm = (status || '').toLowerCase();
  let cls = 'pill';
  if (norm.includes('conclu')) cls = 'pill pill--success';
  else if (norm.includes('atras')) cls = 'pill pill--danger';
  else if (norm.includes('pend')) cls = 'pill pill--warn';
  else if (norm.includes('em and')) cls = 'pill pill--info';
  chip.className = cls;
}

function enterEditMode() {
  ['task-titulo','task-talhao','task-vencimento','task-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  document.getElementById('task-form')?.classList.remove('modal-read');
  document.getElementById('btn-edit')?.classList.add('hidden');
  document.getElementById('btn-save')?.classList.remove('hidden');
  document.getElementById('btn-complete')?.classList.add('hidden');
}

function exitEditMode() {
  ['task-titulo','task-talhao','task-vencimento','task-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
  document.getElementById('task-form')?.classList.add('modal-read');
  document.getElementById('btn-edit')?.classList.remove('hidden');
  document.getElementById('btn-save')?.classList.add('hidden');
  document.getElementById('btn-complete')?.classList.remove('hidden');
}

let saving = false;
export async function saveTaskEdits() {
  if (saving) return;
  const titulo = document.getElementById('task-titulo').value.trim();
  const talhao = document.getElementById('task-talhao').value.trim();
  const vencimento = document.getElementById('task-vencimento').value;
  const descricao = document.getElementById('task-desc').value.trim();
  const saveBtn = document.getElementById('btn-save');
  saving = true;
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
        orderCode: taskOrder?.codigo || '',
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
    } else {
      await updateDoc(currentTaskRef, {
        title: titulo,
        talhao,
        plotName: talhao,
        dueDate: vencimento,
        description: descricao,
        atualizadoEm: Timestamp.now()
      });
    }
    document.dispatchEvent(new CustomEvent('task-updated', { detail: { id: currentTaskId, orderId: taskOrder?.id } }));
    exitEditMode();
  } catch (e) {
    console.error(e);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salvar';
    saving = false;
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
  updateStatusChip('Concluída');
  document.dispatchEvent(new CustomEvent('task-updated', { detail: { id: currentTaskId, orderId: taskOrder?.id } }));
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

function formatDateTime(ts) {
  let date;
  if (ts instanceof Timestamp) date = ts.toDate();
  else if (ts?.toDate) date = ts.toDate();
  else date = new Date(ts);
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function hideTaskDetail() {
  view?.classList.add('hidden');
}
