import { initBottomNav, bindPlus } from './agro-bottom-nav.js';
import { getCurrentPositionSafe } from '../utils/geo.js';
import { showToast, promptModal } from '../services/ui.js';
import { db, auth } from '../config/firebase.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  GeoPoint
} from '/vendor/firebase/9.6.0/firebase-firestore.js';
import {
  initAgroMap,
  setMapCenter,
  plotLeads,
  plotClients,
  setVisibleLayers,
  focusClient,
  fitMapToPoints,
  invalidateMapSize,
} from './agro-map.js';
import { getLeads, addLead, updateLead, syncLeadsFromFirestore } from '../stores/leadsStore.js';
import { getClients, addClient, syncClientsFromFirestore } from '../stores/clientsStore.js';
import { getProperties, addProperty } from '../stores/propertiesStore.js';
import {
  listVisits,
  addVisit,
  updateVisit,
  syncVisitsFromFirestore,
} from '../stores/visitsStore.js';
import { processOutbox } from '../sync/outbox.js';
import { addAgenda, getAgenda, updateAgenda, syncAgendaFromFirestore } from '../stores/agendaStore.js';
import { addSale } from '../stores/salesStore.js';
import { nowBrasiliaISO, nowBrasiliaLocal } from '../lib/date-utils.js';
import { initHomeView } from './home-view.js';

let currentModal;
let lastFocusedElement;
let focusableElements = [];

const networkStatusEl = document.getElementById('networkStatus');

function updateNetworkStatus() {
  if (!networkStatusEl) return;
  const online = navigator.onLine;
  networkStatusEl.textContent = online ? 'Online' : 'Offline';
  networkStatusEl.classList.toggle('online', online);
  networkStatusEl.classList.toggle('offline', !online);
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();

function handleModalKeydown(e) {
  if (!currentModal) return;
  if (e.key === 'Escape') {
    toggleModal(currentModal, false);
  } else if (e.key === 'Tab') {
    if (focusableElements.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}

function toggleModal(el, open) {
  if (!el) return;
  if (open) {
    lastFocusedElement = document.activeElement;
    currentModal = el;
    el.classList.remove('hidden');
    focusableElements = Array.from(
      el.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])')
    );
    const first = el.querySelector('[autofocus]') || focusableElements[0];
    first?.focus();
    document.addEventListener('keydown', handleModalKeydown);
  } else {
    el.classList.add('hidden');
    document.removeEventListener('keydown', handleModalKeydown);
    currentModal = null;
    focusableElements = [];
    lastFocusedElement?.focus();
  }
}

export async function initAgronomoDashboard(userId, userRole) {
  if (window.__agroBooted) return;
  window.__agroBooted = true;
  const quickModal = document.getElementById('quickActionsModal');
  const visitModal = document.getElementById('visitModal');
  const saleModal = document.getElementById('saleModal');
  const quickCreateModal = document.getElementById('quickCreateModal');
  const leadVisitModal = document.getElementById('leadVisitModal');
  const leadVisitForm = document.getElementById('leadVisitForm');
  const leadVisitDate = document.getElementById('leadVisitDate');
  const leadVisitSummary = document.getElementById('leadVisitSummary');
  const leadVisitNotes = document.getElementById('leadVisitNotes');
  const exportOfflineBtn = document.getElementById('exportOfflineBtn');

  exportOfflineBtn?.addEventListener('click', async () => {
    const data = {
      clients: getClients(),
      leads: getLeads(),
      agenda: getAgenda(),
      visits: await listVisits(),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agronomo-data.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  const leadVisitOutcome = document.getElementById('leadVisitOutcome');
  const leadVisitNextStep = document.getElementById('leadVisitNextStep');
  const leadVisitTaskEnable = document.getElementById('leadVisitTaskEnable');
  const leadVisitTaskFields = document.getElementById('leadVisitTaskFields');
  const leadVisitTaskWhen = document.getElementById('leadVisitTaskWhen');
  const leadVisitTaskTitle = document.getElementById('leadVisitTaskTitle');

  const historyTimeline = document.getElementById('historyTimeline');
  const historyFilterAll = document.getElementById('historyFilterAll');
  const historyFilterVisits = document.getElementById('historyFilterVisits');
  const historyFilterAdds = document.getElementById('historyFilterAdds');
  let historyFilter = 'all';

  let currentLeadId = null;

  let currentMapFilter = 'all';
  let highlightContactId = null;
  let contactsFilter = 'all';
  const CLIENTS_SORT_KEY = 'agro.clients.sort';
  const CLIENTS_FILTER_KEY = 'agro.clients.filter';
  const LEADS_SORT_KEY = 'agro.leads.sort';
  const LEADS_FILTER_KEY = 'agro.leads.filter';
  let clientsSort = localStorage.getItem(CLIENTS_SORT_KEY) || 'az';
  let clientsFilter = localStorage.getItem(CLIENTS_FILTER_KEY) || 'active';
  let leadsSort = localStorage.getItem(LEADS_SORT_KEY) || 'az';
  let leadsFilter = localStorage.getItem(LEADS_FILTER_KEY) || 'all';

  function runStagger() {
    const items = document.querySelectorAll('.stagger-item');
    items.forEach((el, index) => {
      setTimeout(() => {
        el.classList.remove('opacity-0', 'translate-y-4');
      }, index * 100);
    });
  }

  function clearErrors(form) {
    form?.querySelectorAll('.error').forEach((e) => e.remove());
  }
  function setFieldError(input, message) {
    const field = input.closest('.field') || input.parentElement;
    if (!field) return;
    let span = field.querySelector('span.error');
    if (!span) {
      span = document.createElement('span');
      span.className = 'error';
      field.appendChild(span);
    }
    span.textContent = message;
  }

  async function renderHistory() {
    if (!historyTimeline) return;
    const visitList = await listVisits();
    const visits = visitList.map((v) => ({
      id: v.id,
      type: 'visit',
      at: v.at,
      name: v.clientName || v.leadName || '',
      text: v.notes || ''
    }));
    const leads = getLeads().map((l) => ({
      id: `lead-${l.id}`,
      type: 'add',
      at: l.createdAt,
      text: `Lead cadastrado: ${l.name}${l.notes ? ' - ' + l.notes : ''}`
    }));
    const clients = getClients().map((c) => ({
      id: `client-${c.id}`,
      type: 'add',
      at: c.createdAt,
      text: `Cliente cadastrado: ${c.name}${c.notes ? ' - ' + c.notes : ''}`
    }));
    let events = [...visits, ...leads, ...clients].filter((e) => e.at);
    if (historyFilter === 'visits') events = events.filter((e) => e.type === 'visit');
    if (historyFilter === 'adds') events = events.filter((e) => e.type === 'add');
    events.sort((a, b) => new Date(b.at) - new Date(a.at));
    if (!events.length) {
      historyTimeline.innerHTML = '<p class="text-gray-500">Nenhum evento.</p>';
      return;
    }
    historyTimeline.innerHTML = '';
    events.forEach((ev) => {
      const card = document.createElement('div');
      card.className = 'mb-4 pl-4 border-l-2 border-green-600';
      const dateStr = new Date(ev.at).toLocaleString('pt-BR');
      if (ev.type === 'visit') {
        const name = ev.name ? `<strong>${ev.name}</strong> - ` : '';
        card.innerHTML = `
          <div class="text-sm text-gray-500">${dateStr}</div>
          <div class="mt-1">${name}${ev.text}</div>
          <button class="text-xs text-green-700 mt-1 edit-visit" data-id="${ev.id}">Editar</button>
        `;
      } else {
        card.innerHTML = `
          <div class="text-sm text-gray-500">${dateStr}</div>
          <div class="mt-1">${ev.text}</div>
        `;
      }
      historyTimeline.appendChild(card);
    });
  }

  async function setHistoryFilter(f) {
    historyFilter = f;
    historyFilterAll?.classList.toggle('filter-active', f === 'all');
    historyFilterAll?.setAttribute('aria-pressed', f === 'all');
    historyFilterVisits?.classList.toggle('filter-active', f === 'visits');
    historyFilterVisits?.setAttribute('aria-pressed', f === 'visits');
    historyFilterAdds?.classList.toggle('filter-active', f === 'adds');
    historyFilterAdds?.setAttribute('aria-pressed', f === 'adds');
    await renderHistory();
  }

  function bindHistoryEvents() {
    historyFilterAll?.addEventListener('click', () => setHistoryFilter('all'));
    historyFilterVisits?.addEventListener('click', () => setHistoryFilter('visits'));
    historyFilterAdds?.addEventListener('click', () => setHistoryFilter('adds'));
    historyTimeline?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.edit-visit');
      if (!btn) return;
      const visitId = btn.dataset.id;
      const allVisits = await listVisits();
      const visit = allVisits.find((v) => v.id === visitId);
      if (!visit) return;
      const newText = await promptModal({
        title: 'Editar texto da visita',
        initialValue: visit.notes || '',
      });
      if (newText === null) return;
      await updateVisit(visitId, { notes: newText.trim() });
      await renderHistory();
    });
  }

  function getClientsWithProps() {
    const clients = getClients();
    const properties = getProperties();
    return clients.map((c) => {
      const prop = properties.find((p) => p.clientId === c.id);
      return {
        id: c.id,
        name: c.name,
        farmName: prop?.name,
        lat: prop?.lat,
        lng: prop?.lng,
      };
    });
  }

  function replotMap() {
    const leads = getLeads().filter((l) => l.stage !== 'Convertido');
    const clients = getClientsWithProps();
    plotLeads(leads);
    plotClients(clients);
    applyMapFilter();
    return { leads, clients };
  }

  function adjustMapHeight() {
    const mapEl = document.getElementById('agroMap');
    const filtersEl = document.getElementById('mapFilters');
    const bottom = document.getElementById('bottomBar');
    if (!mapEl || !filtersEl || !bottom) return;
    const height = window.innerHeight - filtersEl.offsetHeight - bottom.offsetHeight;
    mapEl.style.height = `${height}px`;
    requestAnimationFrame(() => invalidateMapSize());
  }

  function applyMapFilter() {
    if (currentMapFilter === 'all')
      setVisibleLayers({ showLeads: true, showClients: true });
    else if (currentMapFilter === 'clients')
      setVisibleLayers({ showLeads: false, showClients: true });
    else setVisibleLayers({ showLeads: true, showClients: false });
  }

  async function renderMap() {
    const { leads, clients } = replotMap();

    // Center the map on existing markers or use current location when empty
    const points = [
      ...leads
        .filter((l) => l.stage !== 'Convertido' && l.lat && l.lng)
        .map((l) => [l.lat, l.lng]),
      ...clients.filter((c) => c.lat && c.lng).map((c) => [c.lat, c.lng]),
    ];
    if (points.length) {
      fitMapToPoints(points);
    } else {
      const pos = await getCurrentPositionSafe();
      if (pos) setMapCenter(pos.lat, pos.lng, 12);
    }
  }

  function updateMapChips() {
    document
      .querySelectorAll('#mapFilters .chip')
      .forEach((c) => {
        c.classList.remove('filter-active');
        c.setAttribute('aria-pressed', 'false');
      });
    let active;
    if (currentMapFilter === 'all')
      active = document.getElementById('mapFilterAll');
    else if (currentMapFilter === 'clients')
      active = document.getElementById('mapFilterClients');
    else active = document.getElementById('mapFilterLeads');
    active?.classList.add('filter-active');
    active?.setAttribute('aria-pressed', 'true');
  }

  function handleMapFilterChange(f) {
    currentMapFilter = f;
    updateMapChips();
    replotMap();
    adjustMapHeight();
  }
  document
    .getElementById('mapFilterAll')
    ?.addEventListener('click', () => handleMapFilterChange('all'));
  document
    .getElementById('mapFilterClients')
    ?.addEventListener('click', () => handleMapFilterChange('clients'));
  document
    .getElementById('mapFilterLeads')
    ?.addEventListener('click', () => handleMapFilterChange('leads'));

  initBottomNav();
  initAgroMap();
  renderMap();
  runStagger();

  bindPlus(() => toggleModal(quickModal, true));
  document
    .getElementById('btnQuickClose')
    ?.addEventListener('click', () => {
      toggleModal(quickModal, false);
      if (location.hash === '#mapa') adjustMapHeight();
    });
  document
    .getElementById('btnQuickAddContato')
    ?.addEventListener('click', () => {
      toggleModal(quickModal, false);
      openQuickCreateModal('cliente');
      if (location.hash === '#mapa') adjustMapHeight();
    });
  document.getElementById('btnQuickRegVisita')?.addEventListener('click', () => {
    toggleModal(quickModal, false);
    openVisitModal();
    if (location.hash === '#mapa') adjustMapHeight();
  });
  // ===== Visit Flow =====
  const visitSelect = document.getElementById('visitTargetSelect');
  const visitForm = document.getElementById('visitForm');
  const visitInterest = document.getElementById('visitInterest');
  const visitSale = document.getElementById('visitSale');
  const leadExtras = document.getElementById('leadExtras');
  const leadFollowUp = document.getElementById('leadFollowUp');
  const leadReason = document.getElementById('leadReason');
  const visitTaskEnable = document.getElementById('visitTaskEnable');
  const visitTaskFields = document.getElementById('visitTaskFields');
  const visitTaskWhen = document.getElementById('visitTaskWhen');
  const visitTaskTitle = document.getElementById('visitTaskTitle');

  function populateVisitSelect(type) {
    visitSelect.innerHTML = '';
    const items =
      type === 'lead'
        ? getLeads().filter((l) => l.stage !== 'Convertido')
        : getClients();
    items.forEach((it) => {
      const opt = document.createElement('option');
      opt.value = it.id;
      opt.textContent = it.name || it.farmName || 'Sem nome';
      visitSelect.appendChild(opt);
    });
  }

  function openVisitModal() {
    populateVisitSelect('cliente');
    document.querySelector("input[name='visitTarget'][value='cliente']").checked = true;
    visitForm.reset();
    document.getElementById('visitAt').value = nowBrasiliaLocal();
    leadExtras.classList.add('hidden');
    toggleModal(visitModal, true);
  }

  function openQuickCreateModal(defaultType) {
    document.getElementById('quickCreateForm')?.reset();
    document.getElementById('qcLat').value = '';
    document.getElementById('qcLng').value = '';
    document
      .querySelectorAll("input[name='quickType']")
      .forEach((r) => (r.checked = r.value === defaultType));
    toggleModal(quickCreateModal, true);
  }

  const { renderHomeKPIs, renderHomeCharts, renderAgendaHome } = initHomeView({
    openVisitModal,
    openQuickCreateModal,
    replotMap,
    renderHistory,
  });

  function openLeadVisitModal(leadId) {
    currentLeadId = leadId;
    leadVisitForm?.reset();
    if (leadVisitDate)
      leadVisitDate.value = nowBrasiliaLocal();
    // Garante estado inicial dos campos de tarefa
    if (leadVisitTaskFields) leadVisitTaskFields.classList.add('hidden');
    toggleModal(leadVisitModal, true);
  }

  document
    .getElementById('btnLeadVisitCancel')
    ?.addEventListener('click', () => toggleModal(leadVisitModal, false));

  // Toggle campos de tarefa no modal de visita de lead
  leadVisitTaskEnable?.addEventListener('change', () => {
    leadVisitTaskFields?.classList.toggle('hidden', !leadVisitTaskEnable.checked);
  });

  leadVisitForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const summary = leadVisitSummary?.value.trim();
    if (!summary) {
      showToast('Informe o resumo da visita.', 'error');
      return;
    }
    if (leadVisitTaskEnable?.checked) {
      if (!leadVisitTaskWhen?.value) {
        showToast('Informe a data/hora da tarefa.', 'error');
        return;
      }
      if (!leadVisitTaskTitle?.value.trim()) {
        showToast('Informe o título da tarefa.', 'error');
        return;
      }
    }

    const btn = leadVisitForm.querySelector('[type="submit"]');
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = 'Salvando…';

    try {
      const saved = await addVisit({
        type: 'lead',
        refId: currentLeadId,
        at: nowBrasiliaISO(),
        summary,
        notes: leadVisitNotes?.value.trim() || summary,
        leadName: getLeads().find((l) => l.id === currentLeadId)?.name,
      });

      toggleModal(leadVisitModal, false);

      if (leadVisitTaskEnable?.checked) {
        const when = leadVisitTaskWhen.value;
        const title = leadVisitTaskTitle.value.trim();
        addAgenda({ title, when, leadId: currentLeadId });
      }

      clearErrors(leadVisitForm);
      leadVisitForm.reset();
      if (leadVisitTaskFields) leadVisitTaskFields.classList.add('hidden');

      await renderHistory();
      renderLeadsList();
      renderContactsList();
      renderHomeKPIs();
      renderHomeCharts();
      renderLeadsSummary();
      renderAgendaHome(
        parseInt(document.getElementById('agendaPeriod')?.value || '7')
      );
      if (location.hash === '#mapa') {
        replotMap();
        adjustMapHeight();
      }

      showToast(
        saved?.synced
          ? 'Visita salva e sincronizada.'
          : 'Sem internet: visita salva e será sincronizada.',
        saved?.synced ? 'success' : 'info'
      );
    } catch (err) {
      console.error('Erro ao salvar visita localmente:', err);
      toggleModal(leadVisitModal, false);
      clearErrors(leadVisitForm);
      leadVisitForm.reset();
      if (leadVisitTaskFields) leadVisitTaskFields.classList.add('hidden');
      await renderHistory();
      showToast('Sem internet: visita salva e será sincronizada.', 'info');
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });

  function renderClientsSummary() {
    const clients = getClients();
    const totalActive = clients.filter((c) => c.status !== 'inativo').length;
    const el = document.getElementById('clientsTotal');
    if (el) el.textContent = String(totalActive);
  }

  async function renderContactsList(highlightId) {
    const listEl = document.getElementById('contactsList');
    const emptyEl = document.getElementById('contactsEmpty');
    if (!listEl || !emptyEl) return;
    const search =
      document.getElementById('contactsSearch')?.value.toLowerCase().trim() || '';
    const clients = getClients();
    const properties = getProperties();
    const leads = getLeads().filter((l) => l.stage !== 'Convertido');
    const visitList = await listVisits();
    let items = [];
    items.push(
      ...clients.map((c) => {
        const prop = properties.find((p) => p.clientId === c.id);
        const vList = visitList.filter(
          (vi) => vi.type === 'cliente' && vi.refId === c.id
        );
        const last = vList.sort((a, b) => new Date(b.at) - new Date(a.at))[0];
        return {
          id: c.id,
          name: c.name,
          farmName: prop?.name,
          type: 'cliente',
          lastTime: last ? new Date(last.at).getTime() : 0,
        };
      })
    );
    items.push(
      ...leads.map((l) => {
        const vList = visitList.filter(
          (vi) => vi.type === 'lead' && vi.refId === l.id
        );
        const last = vList.sort((a, b) => new Date(b.at) - new Date(a.at))[0];
        return {
          id: l.id,
          name: l.name,
          farmName: l.farmName,
          type: 'lead',
          lastTime: last ? new Date(last.at).getTime() : 0,
        };
      })
    );
    if (contactsFilter === 'clients')
      items = items.filter((it) => it.type === 'cliente');
    else if (contactsFilter === 'leads')
      items = items.filter((it) => it.type === 'lead');
    if (search)
      items = items.filter(
        (it) =>
          (it.name || '').toLowerCase().includes(search) ||
          (it.farmName || '').toLowerCase().includes(search)
      );
    items.sort((a, b) => {
      if (b.lastTime !== a.lastTime) return b.lastTime - a.lastTime;
      return (a.name || '').localeCompare(b.name || '');
    });
    listEl.innerHTML = '';
    items.forEach((it) => {
      const div = document.createElement('div');
      div.className = 'p-4 bg-white rounded-2xl shadow-md';
      if (it.type === 'lead') {
        div.classList.add('lead-card');
        div.dataset.id = it.id;
      }
      div.innerHTML = `<div class="font-semibold">${
        it.name || '(sem nome)'
      }</div><div class="text-sm text-gray-600">${it.farmName || ''}</div>`;
      const actions = document.createElement('div');
      actions.className = 'mt-2 flex gap-2';
      const visitBtn = document.createElement('button');
      visitBtn.className = 'btn-secondary flex-1';
      visitBtn.textContent = 'Registrar visita';
      if (it.type === 'lead') {
        visitBtn.classList.add('btn-registrar-visita');
        visitBtn.dataset.id = it.id;
      } else {
        visitBtn.addEventListener('click', () => {
          openVisitModal();
          document.querySelector(
            `input[name='visitTarget'][value='${it.type}']`
          ).checked = true;
          populateVisitSelect(it.type);
          visitSelect.value = it.id;
        });
      }
      actions.appendChild(visitBtn);
      if (it.type === 'cliente') {
        const openBtn = document.createElement('button');
        openBtn.className = 'btn-secondary flex-1';
        openBtn.textContent = 'Abrir';
        openBtn.addEventListener('click', () => {
          location.href = `client-details.html?clientId=${it.id}&from=agronomo`;
        });
        actions.appendChild(openBtn);
      }
      div.appendChild(actions);
      if (highlightId && it.id === highlightId) {
        div.classList.add('highlight');
        setTimeout(() => div.classList.remove('highlight'), 3000);
      }
      listEl.appendChild(div);
    });
    listEl.classList.toggle('hidden', items.length === 0);
    emptyEl.classList.toggle('hidden', items.length !== 0);
  }

  const contactsEl = document.getElementById('contactsList');
  contactsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-registrar-visita');
    if (btn) {
      e.stopPropagation();
      openLeadVisitModal(btn.dataset.id);
      return;
    }
    const card = e.target.closest('.lead-card');
    if (card) {
      location.href = `lead-details.html?id=${card.dataset.id}`;
    }
  });

  function bindContactsEvents() {
    const searchEl = document.getElementById('contactsSearch');
    searchEl?.addEventListener('input', () => renderContactsList());
    function setFilter(f) {
      contactsFilter = f;
      document
        .querySelectorAll('#view-contatos .chip')
        .forEach((c) => c.classList.remove('filter-active'));
      document
        .getElementById(
          f === 'all'
            ? 'contactsFilterAll'
            : f === 'clients'
            ? 'contactsFilterClients'
            : 'contactsFilterLeads'
        )
        ?.classList.add('filter-active');
      renderContactsList();
    }
    document
      .getElementById('contactsFilterAll')
      ?.addEventListener('click', () => setFilter('all'));
    document
      .getElementById('contactsFilterClients')
      ?.addEventListener('click', () => setFilter('clients'));
    document
      .getElementById('contactsFilterLeads')
      ?.addEventListener('click', () => setFilter('leads'));
    document
      .getElementById('btnContactsQuickAdd')
      ?.addEventListener('click', () => openQuickCreateModal('cliente'));
  }

  function renderLeadsSummary() {
    const leads = getLeads().filter((l) => l.stage !== 'Convertido');
    const counts = { 'Interessado': 0, 'Na dúvida': 0, 'Sem interesse': 0 };
    leads.forEach((l) => {
      if (counts[l.interest] >= 0) counts[l.interest]++;
    });
    document.getElementById('leadCountInteressado').textContent = counts['Interessado'];
    document.getElementById('leadCountNaDuvida').textContent = counts['Na dúvida'];
    document.getElementById('leadCountSemInteresse').textContent = counts['Sem interesse'];
  }

  async function renderLeadsList() {
    const listEl = document.getElementById('leadsList');
    const emptyEl = document.getElementById('leadsEmpty');
    if (!listEl || !emptyEl) return;
    const search =
      document.getElementById('leadsSearch')?.value.toLowerCase().trim() || '';
    const leads = getLeads().filter((l) => l.stage !== 'Convertido');
    const visitList = await listVisits();
    let items = leads.map((l) => {
      const vList = visitList.filter((v) => v.type === 'lead' && v.refId === l.id);
      const last = vList.sort((a, b) => new Date(b.at) - new Date(a.at))[0];
      return {
        lead: l,
        visitCount: vList.length,
        lastTime: last ? new Date(last.at).getTime() : 0,
      };
    });
    if (leadsFilter !== 'all')
      items = items.filter((it) => it.lead.interest === leadsFilter);
    if (search)
      items = items.filter((it) =>
        (it.lead.name || '').toLowerCase().includes(search)
      );
    items.sort((a, b) => {
      if (leadsSort === 'recent') return b.lastTime - a.lastTime;
      if (leadsSort === 'visits') return b.visitCount - a.visitCount;
      return (a.lead.name || '').localeCompare(b.lead.name || '');
    });
    listEl.innerHTML = '';
    items.forEach((it) => {
      const div = document.createElement('div');
      div.className = 'py-2 cursor-pointer lead-card';
      div.dataset.id = it.lead.id;
      div.innerHTML = `<div class="font-semibold">${
        it.lead.name || '(sem nome)'
      }</div><div class="text-sm text-gray-600">${
        it.lead.farmName || ''
      }</div><div class="text-xs text-gray-500">${
        it.lead.interest || ''
      }</div>`;
      const canVisit =
        userRole === 'admin' ||
        userRole === 'agronomo' ||
        (userRole === 'operador' && it.lead.assignedTo === userId);
      if (canVisit) {
        const btn = document.createElement('button');
        btn.className = 'btn-secondary mt-2 btn-registrar-visita';
        btn.dataset.id = it.lead.id;
        btn.textContent = 'Registrar visita';
        div.appendChild(btn);
      }
      listEl.appendChild(div);
    });
    listEl.classList.toggle('hidden', items.length === 0);
    emptyEl.classList.toggle('hidden', items.length !== 0);
    renderLeadsSummary();
  }

  function bindLeadsEvents() {
    document
      .getElementById('leadsSearch')
      ?.addEventListener('input', () => renderLeadsList());
    const sortEl = document.getElementById('leadsSort');
    if (sortEl) {
      sortEl.value = leadsSort;
      sortEl.addEventListener('change', (e) => {
        leadsSort = e.target.value;
        localStorage.setItem(LEADS_SORT_KEY, leadsSort);
        renderLeadsList();
      });
    }
    document.querySelectorAll('#leadsFilterChips button').forEach((b) => {
      if (b.dataset.filter === leadsFilter) b.classList.add('filter-active');
      b.addEventListener('click', () => {
        leadsFilter = b.dataset.filter;
        localStorage.setItem(LEADS_FILTER_KEY, leadsFilter);
        document
          .querySelectorAll('#leadsFilterChips button')
          .forEach((bt) => bt.classList.remove('filter-active'));
        b.classList.add('filter-active');
        renderLeadsList();
      });
    });
    document
      .getElementById('btnLeadsQuickAdd')
      ?.addEventListener('click', () => openQuickCreateModal('lead'));
    const listEl = document.getElementById('leadsList');
    listEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-registrar-visita');
      if (btn) {
        e.stopPropagation();
        openLeadVisitModal(btn.dataset.id);
        return;
      }
      const card = e.target.closest('.lead-card');
      if (card) {
        location.href = `lead-details.html?id=${card.dataset.id}`;
      }
    });
  }

  document.querySelectorAll("input[name='visitTarget']").forEach((r) =>
    r.addEventListener('change', () => {
      const type = document.querySelector("input[name='visitTarget']:checked").value;
      populateVisitSelect(type);
      leadExtras.classList.toggle('hidden', type !== 'lead');
    })
  );

  function refreshLeadFields() {
    const interest = visitInterest.value;
    const sale = visitSale.value;
    const needFollow =
      sale === 'nao' && (interest === 'Interessado' || interest === 'Na dúvida');
    leadFollowUp.classList.toggle('hidden', !needFollow);
    if (visitTaskFields && visitTaskEnable) {
      visitTaskFields.classList.toggle('hidden', !(needFollow && visitTaskEnable.checked));
      if (visitTaskWhen) visitTaskWhen.required = needFollow && visitTaskEnable.checked;
      if (visitTaskTitle) visitTaskTitle.required = needFollow && visitTaskEnable.checked;
    }
    const needReason = interest === 'Sem interesse';
    leadReason.classList.toggle('hidden', !needReason);
    document.getElementById('visitReason').required = needReason;
  }
  visitInterest?.addEventListener('change', refreshLeadFields);
  visitSale?.addEventListener('change', refreshLeadFields);
  visitTaskEnable?.addEventListener('change', refreshLeadFields);

  document.getElementById('btnVisitQuickCreate')?.addEventListener('click', () => {
    const type = document.querySelector("input[name='visitTarget']:checked").value;
    toggleModal(visitModal, false);
    openQuickCreateModal(type);
  });

  document.getElementById('btnVisitCancel')?.addEventListener('click', () =>
    toggleModal(visitModal, false)
  );

  document.getElementById('btnQCCancel')?.addEventListener('click', () => {
    toggleModal(quickCreateModal, false);
    toggleModal(visitModal, true);
    if (location.hash === '#mapa') adjustMapHeight();
  });

  document.getElementById('qcUseLocation')?.addEventListener('click', async () => {
    const pos = await getCurrentPositionSafe();
    if (pos) {
      document.getElementById('qcLat').value = pos.lat.toFixed(6);
      document.getElementById('qcLng').value = pos.lng.toFixed(6);
    }
  });

  document
    .getElementById('quickCreateForm')
    ?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      clearErrors(form);
      const type = document.querySelector("input[name='quickType']:checked").value;
      const nameEl = document.getElementById('qcName');
      const farmEl = document.getElementById('qcFarm');
      const name = nameEl.value.trim();
      const farm = farmEl.value.trim();
      let valid = true;
      if (!name) {
        setFieldError(nameEl, 'Campo obrigatório');
        valid = false;
      }
      if (!farm) {
        setFieldError(farmEl, 'Campo obrigatório');
        valid = false;
      }
      if (!valid) return;
      const notes = document.getElementById('qcNotes').value.trim();
      let lat = parseFloat(document.getElementById('qcLat').value);
      let lng = parseFloat(document.getElementById('qcLng').value);
      // Fallback: se nao houver lat/lng informados, tenta usar a localizacao atual
      if (isNaN(lat) || isNaN(lng)) {
        const pos = await getCurrentPositionSafe();
        if (pos) {
          lat = pos.lat;
          lng = pos.lng;
        }
      }
      let created;
      if (type === 'lead') {
        created = addLead({
          name,
          farmName: farm,
          notes,
          lat: isNaN(lat) ? null : lat,
          lng: isNaN(lng) ? null : lng,
        });
        renderLeadsList();
        renderLeadsSummary();
        highlightContactId = created.id;
        if (location.hash === '#contatos') {
          renderContactsList(highlightContactId);
          highlightContactId = null;
        }
      } else {
        created = addClient({ name, notes });
        addProperty({
          clientId: created.id,
          name: farm,
          lat: isNaN(lat) ? null : lat,
          lng: isNaN(lng) ? null : lng,
        });
        // Also write to clients/{id}/properties with GeoPoint so collectionGroup(map) can consume
        try {
          if (!isNaN(lat) && !isNaN(lng)) {
            await addDoc(collection(db, 'clients', created.id, 'properties'), {
              name: farm,
              clientId: created.id,
              coordenadas: new GeoPoint(Number(lat), Number(lng)),
              createdAt: serverTimestamp(),
            });
          }
        } catch (e) {
          console.warn('[quickCreate] failed to create subcollection property with coords', e);
        }
        highlightContactId = created.id;
        renderClientsSummary();
        if (location.hash === '#contatos') {
          renderContactsList(highlightContactId);
          highlightContactId = null;
        }
      }
      if (location.hash === '#mapa') {
        replotMap();
        adjustMapHeight();
      }
      renderHomeKPIs();
      renderHomeCharts();
      renderAgendaHome(
        parseInt(document.getElementById('agendaPeriod')?.value || '7')
      );
      if (location.hash === '#historico') renderHistory();
      const reopen = !visitModal.classList.contains('hidden');
      toggleModal(quickCreateModal, false);
      if (location.hash === '#mapa') adjustMapHeight();
      clearErrors(form);
      form.reset();
      if (reopen) {
        populateVisitSelect(type);
        visitSelect.value = created.id;
        toggleModal(visitModal, true);
      }
    });

  visitForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    clearErrors(form);
    const type = document.querySelector("input[name='visitTarget']:checked").value;
    const refId = visitSelect.value;
    if (!refId) return;
    const notesEl = document.getElementById('visitNotes');
    let valid = true;
    if (!notesEl.value.trim()) {
      setFieldError(notesEl, 'Campo obrigatório');
      valid = false;
    }
    const visit = {
      type,
      refId,
      at: nowBrasiliaISO(),
      notes: notesEl.value.trim(),
    };
    if (type === 'lead') {
      const interest = visitInterest.value;
      if (!interest) {
        setFieldError(visitInterest, 'Campo obrigatório');
        valid = false;
      }
      if (interest === 'Sem interesse') {
        const reasonEl = document.getElementById('visitReason');
        if (!reasonEl.value.trim()) {
          setFieldError(reasonEl, 'Campo obrigatório');
          valid = false;
        }
      }
      if (!valid) return;
      visit.interest = interest;
      const sale = visitSale.value;
      if (sale === 'sim') {
        toggleModal(visitModal, false);
        const saleData = await openSaleModal();
        if (!saleData) {
          toggleModal(visitModal, true);
          return;
        }
        visit.sale = saleData;
        const lead = getLeads().find((l) => l.id === refId);
        if (lead) {
          const client = addClient({ name: lead.name, notes: lead.notes });
          let lat = lead.lat;
          let lng = lead.lng;
          if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
            const pos = await getCurrentPositionSafe();
            if (pos) {
              lat = pos.lat;
              lng = pos.lng;
            }
          }
          const property = addProperty({
            clientId: client.id,
            name: lead.farmName,
            lat: lat ?? null,
            lng: lng ?? null,
          });
          addSale({
            clientId: client.id,
            propertyId: property.id,
            formulationId: saleData.formulationId,
            formulationName: saleData.formulationName,
            tons: saleData.tons,
            note: saleData.note,
          });
          renderHomeKPIs();
          renderHomeCharts();
          updateLead(refId, { stage: 'Convertido' });
          if (location.hash === '#mapa') {
            replotMap();
            adjustMapHeight();
          }
        }
      } else {
        if (interest === 'Interessado' || interest === 'Na dúvida') {
          if (visitTaskEnable?.checked) {
            const when = visitTaskWhen?.value;
            const title = visitTaskTitle?.value.trim();
            if (!when) {
              setFieldError(visitTaskWhen, 'Campo obrigatório');
              valid = false;
            }
            if (!title) {
              setFieldError(visitTaskTitle, 'Campo obrigatório');
              valid = false;
            }
            if (valid) {
              addAgenda({ title, when, leadId: refId });
              renderAgendaHome(
                parseInt(document.getElementById('agendaPeriod')?.value || '7')
              );
            }
          }
        }
        if (interest === 'Sem interesse') {
          const reason = document.getElementById('visitReason').value.trim();
          visit.reason = reason;
        }
      }
      const lead = getLeads().find((l) => l.id === refId);
      visit.leadName = lead?.name;
    } else {
      if (!valid) return;
      const client = getClients().find((c) => c.id === refId);
      visit.clientName = client?.name;
    }
    if (!valid) return;
    const pos = await getCurrentPositionSafe();
    if (pos) {
      visit.lat = pos.lat;
      visit.lng = pos.lng;
    }
    const saved = await addVisit(visit);
    console.log('[VISITS] novo', saved.id);
    showToast(
      saved.synced
        ? 'Visita registrada com sucesso!'
        : 'Sem internet: visita salva e será sincronizada.',
      saved.synced ? 'success' : 'info'
    );
    toggleModal(visitModal, false);
    clearErrors(form);
    form.reset();
    if (location.hash === '#historico') await renderHistory();
    renderLeadsList();
    renderContactsList();
    renderHomeKPIs();
    renderHomeCharts();
    renderAgendaHome(
      parseInt(document.getElementById('agendaPeriod')?.value || '7')
    );
    if (type === 'lead') {
      updateLead(refId, { interest: visit.interest, lastVisitAt: visit.at });
      renderLeadsSummary();
      const lead = getLeads().find((l) => l.id === refId);
      if (lead && lead.lat && lead.lng) {
        setMapCenter(lead.lat, lead.lng);
        location.hash = '#mapa';
      }
    }
  });

  async function openSaleModal() {
    const formulaSelect = document.getElementById('saleFormula');
    await loadFormulas();
    toggleModal(saleModal, true);
    return new Promise((resolve) => {
      function cleanup() {
        saleForm.removeEventListener('submit', onSubmit);
        document
          .getElementById('btnSaleCancel')
          .removeEventListener('click', onCancel);
      }
      function onSubmit(ev) {
        ev.preventDefault();
        clearErrors(saleForm);
        const formulationId = formulaSelect.value;
        const formulationName =
          formulaSelect.options[formulaSelect.selectedIndex]?.textContent || '';
        const tonsEl = document.getElementById('saleTons');
        const tons = parseFloat(tonsEl.value);
        let valid = true;
        if (!formulationId) {
          setFieldError(formulaSelect, 'Campo obrigatório');
          valid = false;
        }
        if (!tons || tons <= 0) {
          setFieldError(tonsEl, 'Campo obrigatório');
          valid = false;
        }
        if (!valid) return;
        const note = document.getElementById('saleNote').value.trim();
        toggleModal(saleModal, false);
        clearErrors(saleForm);
        saleForm.reset();
        cleanup();
        resolve({ formulationId, formulationName, tons, note });
      }
      function onCancel() {
        toggleModal(saleModal, false);
        clearErrors(saleForm);
        saleForm.reset();
        cleanup();
        resolve(null);
      }
      const saleForm = document.getElementById('saleForm');
      saleForm.addEventListener('submit', onSubmit);
      document.getElementById('btnSaleCancel').addEventListener('click', onCancel);
    });
  }

  async function loadFormulas() {
    const sel = document.getElementById('saleFormula');
    sel.innerHTML = '';
    let formulas = [];
    try {
      const snap = await firebase
        .firestore()
        .collection('fertilizer_formulas')
        .where('isFixed', '==', true)
        .get();
      formulas = snap.docs.map((d) => ({ id: d.id, name: d.data().name }));
    } catch (e) {
      formulas = [
        { id: 'local1', name: 'Fórmula A' },
        { id: 'local2', name: 'Fórmula B' },
      ];
    }
    formulas.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      sel.appendChild(opt);
    });
  }


  // Marca inicialização concluída (para fallback não duplicar)
  window.__agroBootReady = true;
}

// Fallback: se por algum motivo o fluxo de auth não disparar
// (ex.: reabertura 100% offline antes do onAuthStateChanged),
// inicializa o dashboard com dados locais após pequeno atraso.
try {
  document.addEventListener('DOMContentLoaded', () => {
    const marker = document.getElementById('dashboard-agronomo-marker');
    if (!marker) return;
    setTimeout(() => {
      if (!window.__agroBooted) {
        try {
          initAgronomoDashboard((auth && auth.currentUser && auth.currentUser.uid) || null, 'agronomo');
        } catch (e) {
          console.warn('[agronomo] Fallback init falhou', e);
        }
      }
    }, 900);
  });
} catch {}
  function handleHashChange() {
    if (location.hash === '#clientes' || location.hash === '#leads') {
      location.hash = '#contatos';
      return;
    }
    if (location.hash === '#home') {
      renderHomeKPIs();
      renderHomeCharts();
    }
    if (location.hash === '#mapa') {
      adjustMapHeight();
      replotMap();
      requestAnimationFrame(() => {
        const focusId = sessionStorage.getItem('focusClientId');
        if (focusId) {
          focusClient(focusId);
          sessionStorage.removeItem('focusClientId');
        }
      });
    }
    if (location.hash === '#contatos') {
      renderContactsList(highlightContactId);
      highlightContactId = null;
    }
    if (location.hash === '#historico') {
      renderHistory();
    }
    if (location.hash === '#visita') {
      const target = sessionStorage.getItem('visitForClientId');
      openVisitModal();
      if (target) {
        visitSelect.value = target;
        sessionStorage.removeItem('visitForClientId');
      }
    }
  }

  bindContactsEvents();
  bindHistoryEvents();
  if (navigator.onLine) {
    await syncVisitsFromFirestore();
  }
  renderAgendaHome(7);
  renderHomeKPIs();
  renderHistory();
  renderHomeCharts();
  renderContactsList();
  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('resize', () => {
    if (location.hash === '#mapa') adjustMapHeight();
  });
  processOutbox();
  handleHashChange();
}
