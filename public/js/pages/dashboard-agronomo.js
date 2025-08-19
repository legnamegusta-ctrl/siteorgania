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

// Wrapper simples para IndexedDB com fallback em localStorage
const crmStore = (() => {
  const DB_NAME = 'crm';
  const DB_VERSION = 1;
  const STORES = ['leads', 'visitas', 'propostas', 'clientes'];
  let db;
  let useLocal = false;

  function openDB() {
    if (db || useLocal) return Promise.resolve(db);
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
          db = req.result;
          resolve(db);
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

  return { getAll, getById, insert, update, upsert };
})();

let currentUserId = null;

function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      panels.forEach((p) => p.classList.add('hidden'));
      btn.classList.add('active');
      const panel = document.getElementById(`tab-${btn.dataset.tab}`);
      if (panel) panel.classList.remove('hidden');
    });
  });
}

function setupOfflineIndicator() {
  const el = document.getElementById('offline-indicator');
  function update() {
    el.classList.toggle('hidden', navigator.onLine);
  }
  window.addEventListener('online', () => { update(); syncPending(); });
  window.addEventListener('offline', update);
  update();
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
      console.warn('Falha ao sincronizar lead', err);
    }
  }
}

function renderClients(userId) {
  const clientList = document.getElementById('clientList');
  clientList.innerHTML = '';
  const q = query(collection(db, 'clients'), where('agronomistId', '==', userId));
  getDocs(q).then((snap) => {
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const card = document.createElement('div');
      card.className = 'bg-white p-4 rounded-lg shadow flex flex-col';
      card.innerHTML = `<h3 class="text-lg font-semibold mb-4">${data.name || 'Cliente'}</h3><button class="mt-auto px-3 py-2 text-white rounded" style="background-color: var(--brand-green);">Abrir</button>`;
      card.querySelector('button').addEventListener('click', () => {
        window.location.href = `client-details.html?clientId=${docSnap.id}&from=agronomo`;
      });
      clientList.appendChild(card);
    });
  });
}

function initLeadModal() {
  const modal = document.getElementById('modal-novo-lead');
  const btnNovo = document.getElementById('btn-novo-lead');
  const cancel = document.getElementById('btn-cancel-lead');
  const form = document.getElementById('form-novo-lead');

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
      nomeContato: document.getElementById('lead-nomeContato').value,
      propriedade: document.getElementById('lead-propriedade').value || undefined,
      telefone: document.getElementById('lead-telefone').value || undefined,
      email: document.getElementById('lead-email').value || undefined,
      municipio: document.getElementById('lead-municipio').value,
      uf: document.getElementById('lead-uf').value,
      culturas: document.getElementById('lead-culturas').value ? document.getElementById('lead-culturas').value.split(',').map((s) => s.trim()) : [],
      areaHa: document.getElementById('lead-areaHa').value ? Number(document.getElementById('lead-areaHa').value) : undefined,
      origem: document.getElementById('lead-origem').value || 'Prospeccao',
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

  const geoBtn = document.getElementById('btn-lead-geo');
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

async function renderLeads() {
  const tbody = document.getElementById('lead-list');
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
  setupTabs();
  setupOfflineIndicator();
  initLeadModal();
  renderLeads();
  if (currentUserId) renderClients(currentUserId);
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid;
    initAgronomoDashboard();
  } else {
    window.safeRedirectToIndex('dashboard-agronomo-unauthenticated');
  }
});

export { initAgronomoDashboard, crmStore };

