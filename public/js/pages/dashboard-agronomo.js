// js/pages/dashboard-agronomo.js
// Dashboard do agrônomo com suporte a leads, clientes e uso offline

// Importa configuração do Firebase e métodos necessários
import { db, auth } from '../config/firebase.js';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';

const TAG = '[DASH-AGRO]';

function getEl(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(TAG, 'elemento ausente:', id);
  return el;
}

// Wrapper simples para IndexedDB com fallback em localStorage
const DB_NAME = 'crm';
const DB_VERSION = 1;
const STORES = ['leads', 'visitas', 'propostas', 'clientes'];
let crmDb;
let useLocal = false;

function openDB() {
  if (crmDb || useLocal) return Promise.resolve(crmDb);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        STORES.forEach((name) => {
          if (!d.objectStoreNames.contains(name)) {
            d.createObjectStore(name, { keyPath: 'id' });
          }
        });
      };
      req.onsuccess = () => {
        crmDb = req.result;
        resolve(crmDb);
      };
      req.onerror = () => {
        useLocal = true;
        resolve(null);
      };
    } catch (err) {
      useLocal = true;
      resolve(null);
    }
  });
}

function lsKey(col) {
  return `crm:${col}`;
}
function lsRead(col) {
  return JSON.parse(localStorage.getItem(lsKey(col)) || '[]');
}
function lsWrite(col, data) {
  localStorage.setItem(lsKey(col), JSON.stringify(data));
}

async function getAll(col) {
  if (useLocal) return lsRead(col);
  const d = await openDB();
  if (!d) return lsRead(col);
  return new Promise((res) => {
    const tx = d.transaction(col, 'readonly');
    const store = tx.objectStore(col);
    const req = store.getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => res([]);
  });
}

async function getById(col, id) {
  if (useLocal) return lsRead(col).find((r) => r.id === id);
  const d = await openDB();
  if (!d) return lsRead(col).find((r) => r.id === id);
  return new Promise((res) => {
    const tx = d.transaction(col, 'readonly');
    const req = tx.objectStore(col).get(id);
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(undefined);
  });
}

async function put(col, data) {
  if (useLocal) {
    const arr = lsRead(col);
    const idx = arr.findIndex((r) => r.id === data.id);
    if (idx >= 0) arr[idx] = data; else arr.push(data);
    lsWrite(col, arr);
    return;
  }
  const d = await openDB();
  if (!d) return put(col, data);
  return new Promise((res) => {
    const tx = d.transaction(col, 'readwrite');
    tx.objectStore(col).put(data);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

async function insert(col, data) { return put(col, data); }
async function update(col, data) { return put(col, data); }
async function upsert(col, data) { return put(col, data); }

const crmStore = { getAll, getById, insert, update, upsert };

let currentUserId = null;

function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      panels.forEach((p) => p.classList.add('hidden'));
      btn.classList.add('active');
      const panel = getEl(`tab-${btn.dataset.tab}`);
      if (panel) panel.classList.remove('hidden');
    });
  });
}

let offlineIndicatorSetup = false;
function setupOfflineIndicator() {
  const el = getEl('offline-indicator');
  if (!el) return { update: () => {} };
  function update() {
    el.classList.toggle('hidden', navigator.onLine);
  }
  if (!offlineIndicatorSetup) {
    window.addEventListener('online', () => { update(); syncPending(); });
    window.addEventListener('offline', update);
    offlineIndicatorSetup = true;
  }
  update();
  return { update };
}

async function syncPending() {
  if (!navigator.onLine) return;
  const leads = await crmStore.getAll('leads');
  for (const l of leads.filter((x) => x.syncFlag === 'local-only')) {
    try {
      await setDoc(doc(db, 'leads', l.id), { ...l, syncFlag: 'synced' });
      l.syncFlag = 'synced';
      await crmStore.upsert('leads', l);
    } catch (err) {
      console.warn(TAG, 'Falha ao sincronizar lead', err);
    }
  }
}

function renderClients(userId) {
  const clientList = getEl('clientList');
  if (!clientList) return;
  clientList.innerHTML = '';
  const q = query(collection(db, 'clients'), where('agronomistId', '==', userId));
  getDocs(q).then((snap) => {
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const card = document.createElement('div');
      card.className = 'bg-white p-4 rounded-lg shadow flex flex-col';
      card.innerHTML = `<h3 class="text-lg font-semibold mb-4">${data.name || 'Cliente'}</h3><button class="mt-auto px-3 py-2 text-white rounded" style="background-color: var(--brand-green);">Abrir</button>`;
      const btn = card.querySelector('button');
      if (btn) {
        btn.addEventListener('click', () => {
          window.location.href = `client-details.html?clientId=${docSnap.id}&from=agronomo`;
        });
      }
      clientList.appendChild(card);
    });
  });
}

function initLeadModal() {
  const modal = getEl('modal-novo-lead');
  const btnNovo = getEl('btn-novo-lead');
  const cancel = getEl('btn-cancel-lead');
  const form = getEl('form-novo-lead');
  if (!modal || !btnNovo || !cancel || !form) return;

  btnNovo.addEventListener('click', () => {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });
  cancel.addEventListener('click', () => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lead = {
      id: Date.now().toString(),
      nomeContato: getEl('lead-nomeContato')?.value || '',
      propriedade: getEl('lead-propriedade')?.value || undefined,
      telefone: getEl('lead-telefone')?.value || undefined,
      email: getEl('lead-email')?.value || undefined,
      municipio: getEl('lead-municipio')?.value,
      uf: getEl('lead-uf')?.value,
      culturas: (() => {
        const val = getEl('lead-culturas')?.value;
        return val ? val.split(',').map((s) => s.trim()) : [];
      })(),
      areaHa: (() => {
        const val = getEl('lead-areaHa')?.value;
        return val ? Number(val) : undefined;
      })(),
      origem: getEl('lead-origem')?.value || 'Prospeccao',
      lat: form.dataset.lat ? Number(form.dataset.lat) : undefined,
      lng: form.dataset.lng ? Number(form.dataset.lng) : undefined,
      criadoEm: new Date().toISOString(),
      donoAgronomoId: currentUserId,
      estagio: 'Novo',
      syncFlag: navigator.onLine ? 'synced' : 'local-only'
    };
    await crmStore.insert('leads', lead);
    if (navigator.onLine) {
      try {
        await setDoc(doc(db, 'leads', lead.id), lead);
      } catch (err) {
        lead.syncFlag = 'local-only';
        await crmStore.upsert('leads', lead);
      }
    }
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    form.reset();
    renderLeads();
  });

  const geoBtn = getEl('btn-lead-geo');
  if (geoBtn) {
    geoBtn.addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          form.dataset.lat = pos.coords.latitude;
          form.dataset.lng = pos.coords.longitude;
        },
        () => {
          // Usuário negou; apenas segue
        }
      );
    });
  }
}

async function renderLeads() {
  const tbody = getEl('lead-list');
  if (!tbody) return;
  const leads = await crmStore.getAll('leads');
  tbody.innerHTML = '';
  leads.forEach((l) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${l.nomeContato}${l.propriedade ? '/' + l.propriedade : ''}</td>
      <td class="p-2">${l.municipio}/${l.uf}</td>
      <td class="p-2">${(l.culturas || []).join(', ')}</td>
      <td class="p-2"><span class="px-2 py-1 rounded bg-gray-200">${l.estagio}</span></td>
      <td class="p-2 text-center">-</td>
      <td class="p-2 text-center">-</td>
      <td class="p-2 space-x-1">
        <button class="text-blue-600 underline btn-lead-visitar" data-id="${l.id}">Visitar</button>
        <button class="text-blue-600 underline btn-lead-proposta" data-id="${l.id}">Proposta</button>
        <button class="text-blue-600 underline btn-lead-converter" data-id="${l.id}">Converter</button>
        <button class="text-blue-600 underline btn-lead-ver" data-id="${l.id}">Ver</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function initAgronomoDashboard() {
  if (!document.getElementById('dashboard-agronomo-marker')) {
    console.log(TAG, 'marcador ausente; abortando init');
    return;
  }
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId = user.uid;
      setupTabs();
      setupOfflineIndicator();
      initLeadModal();
      renderLeads();
      renderClients(currentUserId);
    } else {
      window.safeRedirectToIndex('dashboard-agronomo-unauthenticated');
    }
  });
}

export { initAgronomoDashboard };

