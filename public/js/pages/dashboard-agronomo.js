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
let activeVisit = null;

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
  const visitas = await crmStore.getAll('visitas');
  for (const v of visitas.filter((x) => x.syncFlag === 'local-only')) {
    try {
      await setDoc(doc(db, 'visits', v.id), { ...v, syncFlag: 'synced' });
      v.syncFlag = 'synced';
      await crmStore.upsert('visitas', v);
    } catch (err) {
      console.warn(TAG, 'Falha ao sincronizar visita', err);
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

function setupVisitModal() {
  if (getEl('modal-visita')) return;
  const modal = document.createElement('div');
  modal.id = 'modal-visita';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50';
  modal.innerHTML = `
    <div class="bg-white p-4 rounded w-full max-w-md">
      <h2 class="text-lg font-semibold mb-4">Visita em andamento</h2>
      <textarea id="visit-notes" class="w-full border p-2 rounded mb-2" placeholder="Observações"></textarea>
      <select id="visit-interest" class="w-full border p-2 rounded mb-2">
        <option value="baixo">Interesse baixo</option>
        <option value="medio">Interesse médio</option>
        <option value="alto">Interesse alto</option>
      </select>
      <input id="visit-next" class="w-full border p-2 rounded mb-2" placeholder="Próximo passo" />
      <input id="visit-date" type="date" class="w-full border p-2 rounded mb-4" />
      <div class="text-right space-x-2">
        <button id="btn-finish-visit" class="px-4 py-2 bg-green-600 text-white rounded">Encerrar Visita</button>
        <button id="btn-cancel-visit" class="px-4 py-2 bg-gray-300 rounded">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
      activeVisit = null;
    }
  });
  getEl('btn-cancel-visit').addEventListener('click', () => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    activeVisit = null;
  });
  getEl('btn-finish-visit').addEventListener('click', finishVisit);
}

function startVisit(leadId) {
  const proceed = async (lat, lng) => {
    activeVisit = {
      id: Date.now().toString(),
      leadId,
      startedAt: new Date().toISOString(),
      startLat: lat,
      startLng: lng,
      endedAt: null,
      notes: '',
      interest: 'baixo',
      nextAction: null,
      nextWhen: null,
      ownerUid: currentUserId,
      syncFlag: navigator.onLine ? 'synced' : 'local-only'
    };
    await crmStore.insert('visitas', activeVisit);
    if (navigator.onLine) {
      try {
        await setDoc(doc(db, 'visits', activeVisit.id), activeVisit);
      } catch (err) {
        activeVisit.syncFlag = 'local-only';
        await crmStore.upsert('visitas', activeVisit);
      }
    }
    const lead = await crmStore.getById('leads', leadId);
    if (lead) {
      lead.estagio = 'Visitado';
      await crmStore.upsert('leads', lead);
      if (navigator.onLine) {
        try {
          await setDoc(doc(db, 'leads', lead.id), { estagio: 'Visitado' }, { merge: true });
        } catch (err) {
          lead.syncFlag = 'local-only';
          await crmStore.upsert('leads', lead);
        }
      }
      renderLeads();
    }
    console.log('[VISITAS]', 'check-in', activeVisit.id);
    const modal = getEl('modal-visita');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  };
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => proceed(pos.coords.latitude, pos.coords.longitude),
      () => proceed(null, null)
    );
  } else {
    proceed(null, null);
  }
}

async function finishVisit() {
  if (!activeVisit) return;
  activeVisit.endedAt = new Date().toISOString();
  activeVisit.notes = getEl('visit-notes')?.value || '';
  activeVisit.interest = getEl('visit-interest')?.value || 'baixo';
  activeVisit.nextAction = getEl('visit-next')?.value || null;
  activeVisit.nextWhen = getEl('visit-date')?.value
    ? new Date(getEl('visit-date').value).toISOString()
    : null;
  await crmStore.upsert('visitas', activeVisit);
  if (navigator.onLine) {
    try {
      await setDoc(doc(db, 'visits', activeVisit.id), activeVisit);
      activeVisit.syncFlag = 'synced';
    } catch (err) {
      activeVisit.syncFlag = 'local-only';
      await crmStore.upsert('visitas', activeVisit);
    }
  } else {
    activeVisit.syncFlag = 'local-only';
    await crmStore.upsert('visitas', activeVisit);
  }
  const lead = await crmStore.getById('leads', activeVisit.leadId);
  if (lead) {
    lead.lastVisitAt = activeVisit.endedAt;
    if (activeVisit.nextAction) {
      const when = activeVisit.nextWhen
        ? new Date(activeVisit.nextWhen).toLocaleDateString()
        : '';
      lead.nextAction = when ? `${activeVisit.nextAction} até ${when}` : activeVisit.nextAction;
    }
    await crmStore.upsert('leads', lead);
    if (navigator.onLine) {
      try {
        await setDoc(
          doc(db, 'leads', lead.id),
          { lastVisitAt: lead.lastVisitAt, nextAction: lead.nextAction || null },
          { merge: true }
        );
      } catch (err) {
        lead.syncFlag = 'local-only';
        await crmStore.upsert('leads', lead);
      }
    }
  }
  console.log('[VISITAS]', 'check-out', activeVisit.id);
  const modal = getEl('modal-visita');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  activeVisit = null;
  renderLeads();
  syncPending();
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
      <td class="p-2 text-center">${l.lastVisitAt ? new Date(l.lastVisitAt).toLocaleDateString() : '-'}</td>
      <td class="p-2 text-center">${l.nextAction || '-'}</td>
      <td class="p-2 space-x-1">
        <button class="text-blue-600 underline btn-lead-visitar" data-id="${l.id}">Iniciar Visita</button>
        <button class="text-blue-600 underline btn-lead-proposta" data-id="${l.id}">Proposta</button>
        <button class="text-blue-600 underline btn-lead-converter" data-id="${l.id}">Converter</button>
        <button class="text-blue-600 underline btn-lead-ver" data-id="${l.id}">Ver</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-lead-visitar').forEach((btn) => {
    btn.addEventListener('click', () => startVisit(btn.dataset.id));
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
      setupVisitModal();
      renderLeads();
      renderClients(currentUserId);
    } else {
      window.safeRedirectToIndex('dashboard-agronomo-unauthenticated');
    }
  });
}

export { initAgronomoDashboard };

