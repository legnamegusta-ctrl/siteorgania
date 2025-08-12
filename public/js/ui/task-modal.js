import { db, auth } from '../config/firebase.js';
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  collection,
  query,
  orderBy,
  limit,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

let currentTaskId = null;
let currentTaskRef = null;
let original = null;
let currentSource = null;

export function initTaskModal() {
  const modal = document.getElementById('task-modal');
  if (!modal) return;
  document.getElementById('btn-edit')?.addEventListener('click', enterEditMode);
  document.getElementById('btn-save')?.addEventListener('click', saveTaskEdits);
  document.getElementById('btn-close')?.addEventListener('click', () => {
    modal.classList.add('hidden');
    exitEditMode();
  });
  document.getElementById('btn-complete')?.addEventListener('click', completeTask);
  document.getElementById('btn-add-comment')?.addEventListener('click', addComment);
}

export async function openTaskModal(taskId, source = 'table') {
  const farmId = window.taskModalFarmId;
  if (!farmId || !taskId) return;
  currentTaskId = taskId;
  currentSource = source;
  currentTaskRef = doc(db, 'clients', farmId, 'tasks', taskId);
  const snap = await getDoc(currentTaskRef);
  if (!snap.exists()) return;
  const data = snap.data();
  original = {
    titulo: data.title || '',
    talhao: data.talhao || data.plotName || '',
    vencimento: data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : '',
    descricao: data.description || ''
  };
  document.getElementById('task-titulo').value = original.titulo;
  document.getElementById('task-talhao').value = original.talhao;
  document.getElementById('task-vencimento').value = original.vencimento;
  document.getElementById('task-desc').value = original.descricao;
  exitEditMode();
  await loadComments(currentTaskRef);
  document.getElementById('task-modal').classList.remove('hidden');
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
  if (!currentTaskRef || !original) return;
  const titulo = document.getElementById('task-titulo').value.trim();
  const talhao = document.getElementById('task-talhao').value.trim();
  const vencimento = document.getElementById('task-vencimento').value;
  const descricao = document.getElementById('task-desc').value.trim();
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
  if (currentSource === 'table') {
    document.dispatchEvent(new CustomEvent('task-updated', { detail: { id: currentTaskId } }));
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
  if (currentSource === 'table') {
    document.dispatchEvent(new CustomEvent('task-updated', { detail: { id: currentTaskId } }));
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
