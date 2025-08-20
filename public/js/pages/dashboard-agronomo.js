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
  setDoc,
  limit
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';

const TAG = '[DASH-AGRO]';

const getEl = (id, tag = TAG) =>
  document.getElementById(id) ||
  (console.warn(tag, 'elemento ausente:', id), null);

// Wrapper simples para IndexedDB com fallback em localStorage
const DB_NAME = 'crm';
const DB_VERSION = 2;
const STORES = ['leads', 'visitas', 'propostas', 'clientes', 'agenda'];
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
      await setDoc(
        doc(db, 'leads', l.id),
        { ...l, agronomistId: l.ownerUid, syncFlag: 'synced' }
      );
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
  const propostas = await crmStore.getAll('propostas');
  for (const p of propostas.filter((x) => x.syncFlag === 'local-only')) {
    try {
      await setDoc(doc(db, 'proposals', p.id), { ...p, agronomistId: p.ownerUid, syncFlag: 'synced' });
      p.syncFlag = 'synced';
      await crmStore.upsert('propostas', p);
    } catch (err) {
      console.warn(TAG, 'Falha ao sincronizar proposta', err);
    }
  }
  const agenda = await crmStore.getAll('agenda');
  for (const a of agenda.filter((x) => x.syncFlag === 'local-only')) {
    try {
      await setDoc(doc(db, 'agenda', a.ownerUid, 'items', a.id), { ...a, syncFlag: 'synced' });
      a.syncFlag = 'synced';
      await crmStore.upsert('agenda', a);
    } catch (err) {
      console.warn(TAG, 'Falha ao sincronizar agenda', err);
    }
  }
}

async function renderClients(userId) {
  const clientList = getEl('clientList');
  if (!clientList) return;
  clientList.innerHTML = '';

  let clients = [];
  if (navigator.onLine) {
    try {
      const q = query(collection(db, 'clients'), where('agronomistId', '==', userId));
      const snap = await getDocs(q);
      clients = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      for (const c of clients) {
        await crmStore.upsert('clientes', { ...c, syncFlag: 'synced' });
      }
    } catch (err) {
      console.warn(TAG, 'falha ao buscar clientes', err);
      clients = await crmStore.getAll('clientes');
      clients = clients.filter((c) => c.agronomistId === userId);
    }
  } else {
    clients = await crmStore.getAll('clientes');
    clients = clients.filter((c) => c.agronomistId === userId);
  }

  for (const c of clients) {
    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded-lg shadow flex flex-col';
    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold mb-4';
    title.textContent = c.name || 'Cliente';

    const btnContainer = document.createElement('div');
    btnContainer.className = 'mt-auto flex flex-col gap-2';

    const btnCliente = document.createElement('button');
    btnCliente.className = 'px-3 py-2 text-white rounded';
    btnCliente.style.backgroundColor = 'var(--brand-green)';
    btnCliente.textContent = 'Abrir cliente';
    btnCliente.addEventListener('click', () => {
      console.log('[POS-VENDA]', 'abrir cliente', c.id);
      window.location.href = `client-details.html?clientId=${c.id}&from=agronomo`;
    });
    btnContainer.appendChild(btnCliente);

    try {
      const propsSnap = await getDocs(query(collection(db, `clients/${c.id}/properties`), limit(1)));
      if (!propsSnap.empty) {
        const propId = propsSnap.docs[0].id;
        const btnProps = document.createElement('button');
        btnProps.className = 'px-3 py-2 text-white rounded';
        btnProps.style.backgroundColor = 'var(--brand-green)';
        btnProps.textContent = 'Propriedades';
        btnProps.addEventListener('click', () => {
          console.log('[POS-VENDA]', 'abrir propriedades', c.id);
          window.location.href = `property-details.html?clientId=${c.id}&propertyId=${propId}&from=agronomo`;
        });
        btnContainer.appendChild(btnProps);

        const btnTalhoes = document.createElement('button');
        btnTalhoes.className = 'px-3 py-2 text-white rounded';
        btnTalhoes.style.backgroundColor = 'var(--brand-green)';
        btnTalhoes.textContent = 'Abrir talhões';
        btnTalhoes.addEventListener('click', () => {
          console.log('[POS-VENDA]', 'abrir talhoes', c.id, propId);
          window.location.href = `plot-details.html?clientId=${c.id}&propertyId=${propId}&from=agronomo`;
        });
        btnContainer.appendChild(btnTalhoes);
      }
    } catch (err) {
      console.warn(TAG, 'falha ao buscar propriedades', err);
    }

    card.appendChild(title);
    card.appendChild(btnContainer);
    clientList.appendChild(card);
  }
}

async function convertLeadToClient(leadId) {
  const lead = await crmStore.getById('leads', leadId);
  if (!lead) return null;
  const clientId = lead.id;
  const client = {
    id: clientId,
    name: lead.nomeContato || lead.nomePropriedade || 'Cliente',
    email: lead.email || null,
    phone: lead.telefone || null,
    municipio: lead.municipio,
    uf: lead.uf,
    agronomistId: currentUserId,
    createdAt: new Date().toISOString(),
    syncFlag: navigator.onLine ? 'synced' : 'local-only'
  };
  await crmStore.insert('clientes', client);
  if (navigator.onLine) {
    try {
      await setDoc(doc(db, 'clients', clientId), client);
    } catch (err) {
      client.syncFlag = 'local-only';
      await crmStore.upsert('clientes', client);
    }
  }
  const propertyId = Date.now().toString();
  const property = {
    id: propertyId,
    name: lead.nomePropriedade || 'Propriedade',
    lat: lead.lat || null,
    lng: lead.lng || null,
    createdAt: new Date().toISOString()
  };
  if (navigator.onLine) {
    try {
      await setDoc(doc(db, 'clients', clientId, 'properties', propertyId), property);
    } catch (err) {
      // ignore offline
    }
  }
  lead.stage = 'Convertido';
  lead.updatedAt = new Date().toISOString();
  lead.clientId = clientId;
  await crmStore.upsert('leads', lead);
  if (navigator.onLine) {
    try {
      await setDoc(doc(db, 'leads', lead.id), { stage: 'Convertido', updatedAt: lead.updatedAt }, { merge: true });
    } catch (err) {
      lead.syncFlag = 'local-only';
      await crmStore.upsert('leads', lead);
    }
  }
  console.log('[CONVERSAO]', 'lead->cliente', { leadId: lead.id, clientId, propertyId });
  renderLeads();
  renderClients(currentUserId);
  syncPending();
  return clientId;
}

async function updateProposalStatus(id, newStatus) {
  const prop = await crmStore.getById('propostas', id);
  if (!prop) return;
  prop.status = newStatus;
  prop.syncFlag = navigator.onLine ? 'synced' : 'local-only';
  await crmStore.upsert('propostas', prop);
  if (navigator.onLine) {
    try {
      await setDoc(doc(db, 'proposals', prop.id), { status: newStatus }, { merge: true });
    } catch (err) {
      prop.syncFlag = 'local-only';
      await crmStore.upsert('propostas', prop);
    }
  }
  console.log('[PROPOSTAS]', 'status alterado', prop.id, newStatus);
  if (newStatus === 'Aceita') {
    document.dispatchEvent(new CustomEvent('proposalAccepted', { detail: prop }));
  }
  renderProposals();
  syncPending();
}

document.addEventListener('proposalAccepted', async (e) => {
  const prop = e.detail;
  await convertLeadToClient(prop.leadId);
});

async function renderProposals() {
  const tbl = getEl('tbl-propostas');
  if (!tbl) return;
  const tbody = tbl.querySelector('tbody');
  if (!tbody) return;
  const props = await crmStore.getAll('propostas');
  const leads = await crmStore.getAll('leads');
  const leadMap = {};
  leads.forEach((l) => { leadMap[l.id] = l.nomeContato || l.nomePropriedade || l.id; });
  tbody.innerHTML = '';
  props.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${leadMap[p.leadId] || p.leadId}</td>
      <td class="p-2">${p.valorTotal}</td>
      <td class="p-2">${p.status}</td>
      <td class="p-2">${p.validade ? new Date(p.validade).toLocaleDateString() : '-'}</td>
      <td class="p-2 space-x-2">
        <button class="text-green-600 underline btn-prop-aceita" data-id="${p.id}">Aceitar</button>
        <button class="text-red-600 underline btn-prop-rejeita" data-id="${p.id}">Rejeitar</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-prop-aceita').forEach((btn) => {
    btn.addEventListener('click', () => updateProposalStatus(btn.dataset.id, 'Aceita'));
  });
  tbody.querySelectorAll('.btn-prop-rejeita').forEach((btn) => {
    btn.addEventListener('click', () => updateProposalStatus(btn.dataset.id, 'Rejeitada'));
  });
}

async function renderAgenda() {
  const lista = getEl('agenda-lista');
  if (!lista) return;
  const filtroSel = getEl('agenda-filtro-periodo');
  const dias = filtroSel ? Number(filtroSel.value) : 7;
  const items = await crmStore.getAll('agenda');
  const now = new Date();
  const limite = new Date();
  limite.setDate(now.getDate() + dias);
  const futuros = items
    .filter((i) => i.when && new Date(i.when) >= now && new Date(i.when) <= limite)
    .sort((a, b) => new Date(a.when) - new Date(b.when));
  lista.innerHTML = '';
  futuros.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'p-2 bg-white rounded shadow flex items-center gap-2';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!item.done;
    chk.addEventListener('change', async () => {
      item.done = chk.checked;
      item.syncFlag = navigator.onLine ? 'synced' : 'local-only';
      await crmStore.upsert('agenda', item);
      if (navigator.onLine) {
        try {
          await setDoc(
            doc(db, 'agenda', item.ownerUid, 'items', item.id),
            { done: item.done, syncFlag: 'synced' },
            { merge: true }
          );
        } catch (err) {
          item.syncFlag = 'local-only';
          await crmStore.upsert('agenda', item);
        }
      }
      console.log('[AGENDA]', 'done', item.id);
      renderAgenda();
      syncPending();
    });
    const span = document.createElement('span');
    span.textContent = `${new Date(item.when).toLocaleDateString()} - ${item.title}`;
    if (item.done) span.classList.add('line-through', 'text-gray-500');
    li.appendChild(chk);
    li.appendChild(span);
    lista.appendChild(li);
  });
}

function openProposalModal(leadId) {
  let modal = getEl('modal-proposta');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-proposta';
    document.body.appendChild(modal);
  } else if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50';
  modal.innerHTML = `
    <div class="bg-white p-4 rounded w-full max-w-md">
      <h2 class="text-lg font-semibold mb-4">Nova Proposta</h2>
      <form id="form-proposta" class="space-y-2">
        <input id="prop-leadId" class="w-full border p-2 rounded" readonly />
        <textarea id="prop-itens" class="w-full border p-2 rounded" placeholder="Itens"></textarea>
        <input id="prop-valorTotal" type="number" class="w-full border p-2 rounded" placeholder="Valor Total" required />
        <input id="prop-validade" type="date" class="w-full border p-2 rounded" required />
        <div class="text-right space-x-2 pt-2">
          <button type="button" id="btn-cancel-prop" class="px-4 py-2 bg-gray-300 rounded">Cancelar</button>
          <button type="submit" class="px-4 py-2 text-white rounded" style="background-color: var(--brand-green);">Salvar</button>
        </div>
      </form>
    </div>`;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  getEl('prop-leadId').value = leadId;
  const close = () => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  };
  getEl('btn-cancel-prop').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  getEl('form-proposta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prop = {
      id: Date.now().toString(),
      leadId,
      itens: getEl('prop-itens').value,
      valorTotal: Number(getEl('prop-valorTotal').value),
      validade: getEl('prop-validade').value,
      createdAt: new Date().toISOString(),
      status: 'Enviada',
      ownerUid: currentUserId,
      syncFlag: navigator.onLine ? 'synced' : 'local-only'
    };
    await crmStore.insert('propostas', prop);
    if (navigator.onLine) {
      try {
        await setDoc(doc(db, 'proposals', prop.id), { ...prop, agronomistId: currentUserId });
      } catch (err) {
        prop.syncFlag = 'local-only';
        await crmStore.upsert('propostas', prop);
      }
    }
    const lead = await crmStore.getById('leads', leadId);
    if (lead) {
      lead.stage = 'Proposta';
      lead.updatedAt = new Date().toISOString();
      await crmStore.upsert('leads', lead);
      if (navigator.onLine) {
        try {
          await setDoc(doc(db, 'leads', lead.id), { stage: 'Proposta', updatedAt: lead.updatedAt }, { merge: true });
        } catch (err) {
          lead.syncFlag = 'local-only';
          await crmStore.upsert('leads', lead);
        }
      }
    }
    if (prop.validade) {
      const agendaItem = {
        id: Date.now().toString(),
        type: 'followup',
        title: `Acompanhar proposta ${lead ? (lead.nomeContato || lead.nomePropriedade || leadId) : leadId} antes de ${new Date(prop.validade).toLocaleDateString()}`,
        when: new Date(prop.validade).toISOString(),
        leadId,
        ownerUid: currentUserId,
        createdAt: new Date().toISOString(),
        done: false,
        syncFlag: navigator.onLine ? 'synced' : 'local-only'
      };
      await crmStore.insert('agenda', agendaItem);
      if (navigator.onLine) {
        try {
          await setDoc(doc(db, 'agenda', currentUserId, 'items', agendaItem.id), agendaItem);
        } catch (err) {
          agendaItem.syncFlag = 'local-only';
          await crmStore.upsert('agenda', agendaItem);
        }
      }
      console.log('[AGENDA]', 'add', agendaItem.id);
      renderAgenda();
    }
  console.log('[PROPOSTAS]', 'criada', prop.id);
  close();
  renderProposals();
  renderLeads();
  syncPending();
});
}

async function openLeadDetails(leadId) {
  let modal = getEl('modal-lead-view');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-lead-view';
    document.body.appendChild(modal);
  }
  const lead = await crmStore.getById('leads', leadId);
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50';
  modal.innerHTML = `
    <div class="bg-white p-4 rounded w-full max-w-md max-h-full overflow-y-auto">
      <h2 class="text-lg font-semibold mb-4">Detalhes do Lead</h2>
      <pre class="whitespace-pre-wrap text-xs mb-4">${lead ? JSON.stringify(lead, null, 2) : 'Lead não encontrado'}</pre>
      <h3 class="font-semibold mb-2">Histórico</h3>
      <p class="text-sm text-gray-500">Sem dados</p>
      <div class="text-right mt-4"><button id="btn-close-lead-view" class="px-4 py-2 border rounded">Fechar</button></div>
    </div>`;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  const close = () => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  };
  getEl('btn-close-lead-view').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

function initLeadModal() {
  const modal = getEl('modal-novo-lead');
  const cancel = getEl('btn-cancel-lead');
  const form = getEl('form-novo-lead');
  if (!modal || !cancel || !form) return;
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
      ownerUid: currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stage: 'Novo',
      lastVisitAt: null,
      nextAction: null,
      nomeContato: getEl('lead-nomeContato')?.value || '',
      nomePropriedade: getEl('lead-propriedade')?.value || undefined,
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
      origem: getEl('lead-origem')?.value || '',
      notas: getEl('lead-notas')?.value || '',
      lat: form.dataset.lat ? Number(form.dataset.lat) : undefined,
      lng: form.dataset.lng ? Number(form.dataset.lng) : undefined,
      syncFlag: navigator.onLine ? 'synced' : 'local-only'
    };
    await crmStore.insert('leads', lead);
    console.log('[LEADS] novo lead', lead.id);
    if (navigator.onLine) {
      try {
        await setDoc(doc(db, 'leads', lead.id), { ...lead, agronomistId: currentUserId });
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
        <option value="medio" selected>Interesse médio</option>
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
      interest: 'medio',
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
      lead.stage = 'Visitado';
      lead.updatedAt = new Date().toISOString();
      await crmStore.upsert('leads', lead);
      console.log('[VISITAS]', 'lead stage -> Visitado', lead.id);
      if (navigator.onLine) {
        try {
          await setDoc(doc(db, 'leads', lead.id), { stage: 'Visitado', updatedAt: lead.updatedAt }, { merge: true });
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
  activeVisit.interest = getEl('visit-interest')?.value || 'medio';
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
    lead.updatedAt = new Date().toISOString();
    await crmStore.upsert('leads', lead);
    console.log('[VISITAS]', 'lead update', {
      id: lead.id,
      lastVisitAt: lead.lastVisitAt,
      nextAction: lead.nextAction || null
    });
    if (navigator.onLine) {
      try {
        await setDoc(
          doc(db, 'leads', lead.id),
          { lastVisitAt: lead.lastVisitAt, nextAction: lead.nextAction || null, updatedAt: lead.updatedAt },
          { merge: true }
        );
      } catch (err) {
        lead.syncFlag = 'local-only';
        await crmStore.upsert('leads', lead);
      }
    }
    if (activeVisit.nextWhen) {
      const agendaItem = {
        id: Date.now().toString(),
        type: 'followup',
        title: `Follow-up: ${lead.nomeContato || lead.nomePropriedade || lead.id}`,
        when: activeVisit.nextWhen,
        leadId: lead.id,
        ownerUid: currentUserId,
        createdAt: new Date().toISOString(),
        done: false,
        syncFlag: navigator.onLine ? 'synced' : 'local-only'
      };
      await crmStore.insert('agenda', agendaItem);
      if (navigator.onLine) {
        try {
          await setDoc(doc(db, 'agenda', currentUserId, 'items', agendaItem.id), agendaItem);
        } catch (err) {
          agendaItem.syncFlag = 'local-only';
          await crmStore.upsert('agenda', agendaItem);
        }
      }
      console.log('[AGENDA]', 'add', agendaItem.id);
      renderAgenda();
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
  const empty = getEl('lead-empty');
  const stageSel = getEl('lead-filtro-estagio');
  const cultureSel = getEl('lead-filtro-cultura');
  const periodSel = getEl('lead-filtro-periodo');
  const searchInput = getEl('lead-busca');

  let leads = await crmStore.getAll('leads');

  const stageVal = stageSel?.value || '';
  const cultureVal = cultureSel?.value || '';
  const periodVal = Number(periodSel?.value || 0);
  const searchVal = (searchInput?.value || '').toLowerCase().trim();

  if (stageSel) {
    const stages = Array.from(new Set(leads.map((l) => l.stage).filter(Boolean)));
    const prev = stageSel.value;
    stageSel.innerHTML = '<option value="">Estágio</option>' + stages.map((s) => `<option value="${s}">${s}</option>`).join('');
    stageSel.value = prev;
  }
  if (cultureSel) {
    const cultures = Array.from(new Set(leads.flatMap((l) => l.culturas || [])));
    const prevC = cultureSel.value;
    cultureSel.innerHTML = '<option value="">Cultura</option>' + cultures.map((c) => `<option value="${c}">${c}</option>`).join('');
    cultureSel.value = prevC;
  }

  if (stageVal) leads = leads.filter((l) => l.stage === stageVal);
  if (cultureVal) leads = leads.filter((l) => (l.culturas || []).includes(cultureVal));
  if (periodVal) {
    const since = Date.now() - periodVal * 24 * 60 * 60 * 1000;
    leads = leads.filter((l) => new Date(l.createdAt).getTime() >= since);
  }
  if (searchVal) {
    leads = leads.filter((l) => {
      const nome = (l.nomeContato || '').toLowerCase();
      const prop = (l.nomePropriedade || '').toLowerCase();
      return nome.includes(searchVal) || prop.includes(searchVal);
    });
  }

  tbody.innerHTML = '';
  if (!leads.length) {
    if (empty) empty.classList.remove('hidden');
    console.log('[LEADS] render', 0);
    return;
  }
  if (empty) empty.classList.add('hidden');
  leads.forEach((l) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">${l.nomeContato}${l.nomePropriedade ? '/' + l.nomePropriedade : ''}</td>
      <td class="p-2">${l.municipio}/${l.uf}</td>
      <td class="p-2">${(l.culturas || []).join(', ')}</td>
      <td class="p-2"><span class="px-2 py-1 rounded bg-gray-200">${l.stage}</span></td>
      <td class="p-2 text-center">${l.lastVisitAt ? new Date(l.lastVisitAt).toLocaleDateString() : '-'}</td>
      <td class="p-2 text-center">${l.nextAction || '-'}</td>
      <td class="p-2 space-x-1">
        <button class="text-blue-600 underline btn-lead-visitar" data-id="${l.id}">Visitar</button>
        <button class="text-blue-600 underline btn-lead-proposta" data-id="${l.id}">Proposta</button>
        <button class="text-blue-600 underline btn-lead-converter" data-id="${l.id}">Converter</button>
        <button class="text-blue-600 underline btn-lead-ver" data-id="${l.id}">Ver</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-lead-visitar').forEach((btn) => {
    btn.addEventListener('click', () => startVisit(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-lead-proposta').forEach((btn) => {
    btn.addEventListener('click', () => openProposalModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-lead-converter').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const cid = await convertLeadToClient(btn.dataset.id);
      if (cid) {
        window.location.href = `client-details.html?clientId=${cid}&from=agronomo`;
      }
    });
  });
  tbody.querySelectorAll('.btn-lead-ver').forEach((btn) => {
    btn.addEventListener('click', () => openLeadDetails(btn.dataset.id));
  });
  console.log('[LEADS] render', leads.length);
}

function bindDashboardHeader(userId) {
  const kpiLeads = getEl('kpiLeads7d');
  const kpiProps = getEl('kpiPropsAtivas');
  const kpiConv = getEl('kpiConv30d');
  if (kpiLeads) kpiLeads.textContent = '0';
  if (kpiProps) kpiProps.textContent = '0';
  if (kpiConv) kpiConv.textContent = '0';

  const openLeadModal = () => {
    const modal = getEl('modal-novo-lead');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };
  const btnNovo = getEl('btnNovoLead');
  const btnNovoEmpty = getEl('btnNovoLeadEmpty');
  btnNovo?.addEventListener('click', openLeadModal);
  btnNovoEmpty?.addEventListener('click', openLeadModal);

  getEl('lead-filtro-estagio')?.addEventListener('change', renderLeads);
  getEl('lead-filtro-cultura')?.addEventListener('change', renderLeads);
  getEl('lead-filtro-periodo')?.addEventListener('change', renderLeads);
  getEl('lead-busca')?.addEventListener('input', renderLeads);

  const btnVisita = getEl('btnIniciarVisita');
  btnVisita?.addEventListener('click', () => {
    setupVisitModal();
    const modal = getEl('modal-visita');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });
}

function initAgronomoDashboard() {
  if (!getEl('dashboard-agronomo-marker')) {
    return;
  }
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId = user.uid;
      bindDashboardHeader(currentUserId);
      setupTabs();
      setupOfflineIndicator();
      initLeadModal();
      setupVisitModal();
      renderLeads();
      renderProposals();
      renderClients(currentUserId);
      getEl('agenda-filtro-periodo')?.addEventListener('change', renderAgenda);
      renderAgenda();
    } else {
      window.safeRedirectToIndex('dashboard-agronomo-unauthenticated');
    }
  });
}

export { initAgronomoDashboard, bindDashboardHeader };

