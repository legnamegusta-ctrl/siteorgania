import { initBottomNav, bindPlus, toggleModal } from './agro-bottom-nav.js';
import { getCurrentPositionSafe } from '../utils/geo.js';
import { showToast } from '../services/ui.js';
import {
  initAgroMap,
  setMapCenter,
  plotLeads,
  plotClients,
  setVisibleLayers,
  focusClient,
  fitMapToPoints,
} from './agro-map.js';
import { getLeads, addLead, updateLead } from '../stores/leadsStore.js';
import { getClients, addClient } from '../stores/clientsStore.js';
import { getProperties, addProperty } from '../stores/propertiesStore.js';
import { getVisits, addVisit } from '../stores/visitsStore.js';
import { addAgenda, getAgenda, updateAgenda } from '../stores/agendaStore.js';
import { addSale } from '../stores/salesStore.js';
import { countVisitsLast30d, sumSalesLast30d } from '../utils/metrics.js';

export function initAgronomoDashboard() {
  const quickModal = document.getElementById('quickActionsModal');
  const addLeadModal = document.getElementById('addLeadModal');
  const latInput = document.getElementById('leadLat');
  const lngInput = document.getElementById('leadLng');
  const btnUseLocation = document.getElementById('btnUseLocation');
  const visitModal = document.getElementById('visitModal');
  const saleModal = document.getElementById('saleModal');
  const quickCreateModal = document.getElementById('quickCreateModal');

  let currentMapFilter = 'all';
  let highlightClientId = null;
  const CLIENTS_SORT_KEY = 'agro.clients.sort';
  const CLIENTS_FILTER_KEY = 'agro.clients.filter';
  const LEADS_SORT_KEY = 'agro.leads.sort';
  const LEADS_FILTER_KEY = 'agro.leads.filter';
  let clientsSort = localStorage.getItem(CLIENTS_SORT_KEY) || 'az';
  let clientsFilter = localStorage.getItem(CLIENTS_FILTER_KEY) || 'active';
  let leadsSort = localStorage.getItem(LEADS_SORT_KEY) || 'az';
  let leadsFilter = localStorage.getItem(LEADS_FILTER_KEY) || 'all';

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

  function applyMapFilter() {
    if (currentMapFilter === 'all')
      setVisibleLayers({ showLeads: true, showClients: true });
    else if (currentMapFilter === 'clients')
      setVisibleLayers({ showLeads: false, showClients: true });
    else setVisibleLayers({ showLeads: true, showClients: false });
  }

  async function renderMap() {
    const leads = getLeads().filter((l) => l.stage !== 'Convertido');
    const clients = getClientsWithProps();
    plotLeads(leads);
    plotClients(clients);
    applyMapFilter();

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
      .forEach((c) => c.classList.remove('filter-active'));
    if (currentMapFilter === 'all')
      document.getElementById('mapFilterAll')?.classList.add('filter-active');
    else if (currentMapFilter === 'clients')
      document
        .getElementById('mapFilterClients')
        ?.classList.add('filter-active');
    else document.getElementById('mapFilterLeads')?.classList.add('filter-active');
  }

  document.getElementById('mapFilterAll')?.addEventListener('click', () => {
    currentMapFilter = 'all';
    updateMapChips();
    applyMapFilter();
  });
  document.getElementById('mapFilterClients')?.addEventListener('click', () => {
    currentMapFilter = 'clients';
    updateMapChips();
    applyMapFilter();
  });
  document.getElementById('mapFilterLeads')?.addEventListener('click', () => {
    currentMapFilter = 'leads';
    updateMapChips();
    applyMapFilter();
  });

  initBottomNav();
  initAgroMap();
  renderMap();

  bindPlus(() => toggleModal(quickModal, true));
  document.getElementById('btnQuickClose')?.addEventListener('click', () => toggleModal(quickModal, false));
  document.getElementById('btnQuickAddLead')?.addEventListener('click', () => {
    toggleModal(quickModal, false);
    toggleModal(addLeadModal, true);
    ensureLeadMap();
  });
  document.getElementById('btnQuickAddCliente')?.addEventListener('click', () => {
    toggleModal(quickModal, false);
    openQuickCreateModal('cliente');
  });
  document.getElementById('btnQuickRegVisita')?.addEventListener('click', () => {
    toggleModal(quickModal, false);
    openVisitModal();
  });
  document.getElementById('btnCancelLead')?.addEventListener('click', () => toggleModal(addLeadModal, false));

  let leadMap;
  let leadMarker;
  function ensureLeadMap() {
    if (typeof L === 'undefined') return;
    if (!leadMap) {
      leadMap = L.map('leadMap').setView([0, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(leadMap);
    }
    if (latInput.value && lngInput.value) {
      setLeadMarker(parseFloat(latInput.value), parseFloat(lngInput.value));
    }
  }
  function setLeadMarker(lat, lng) {
    if (!leadMap || typeof L === 'undefined') return;
    if (leadMarker) leadMarker.setLatLng([lat, lng]);
    else leadMarker = L.marker([lat, lng]).addTo(leadMap);
    leadMap.setView([lat, lng], 14);
  }

  btnUseLocation?.addEventListener('click', async () => {
    const pos = await getCurrentPositionSafe();
    if (pos) {
      latInput.value = pos.lat.toFixed(6);
      lngInput.value = pos.lng.toFixed(6);
      ensureLeadMap();
      setLeadMarker(pos.lat, pos.lng);
    }
  });

  document.getElementById('leadForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    clearErrors(form);
    const nomeEl = document.getElementById('leadNome');
    const propEl = document.getElementById('leadPropriedade');
    const nome = nomeEl.value.trim();
    const propriedade = propEl.value.trim();
    let valid = true;
    if (!nome) {
      setFieldError(nomeEl, 'Campo obrigatório');
      valid = false;
    }
    if (!propriedade) {
      setFieldError(propEl, 'Campo obrigatório');
      valid = false;
    }
    if (!valid) return;
    const notas = document.getElementById('leadNotas').value.trim();
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    const newLead = addLead({
      name: nome,
      farmName: propriedade,
      notes: notas,
      lat: isNaN(lat) ? null : lat,
      lng: isNaN(lng) ? null : lng,
    });
    console.log('[LEADS] novo', newLead.id);
    renderMap();
    renderLeadsList();
    renderLeadsSummary();
    renderHomeMetrics();
    renderAgendaHome(
      parseInt(document.getElementById('agendaPeriod')?.value || '7')
    );
    if (newLead.lat && newLead.lng) setMapCenter(newLead.lat, newLead.lng);
    location.hash = '#mapa';
    toggleModal(addLeadModal, false);
    clearErrors(form);
    form.reset();
  });

  // ===== Visit Flow =====
  const visitSelect = document.getElementById('visitTargetSelect');
  const visitForm = document.getElementById('visitForm');
  const visitInterest = document.getElementById('visitInterest');
  const visitSale = document.getElementById('visitSale');
  const leadExtras = document.getElementById('leadExtras');
  const leadFollowUp = document.getElementById('leadFollowUp');
  const leadReason = document.getElementById('leadReason');

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
    document.getElementById('visitAt').value = new Date().toISOString().slice(0, 16);
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

  function renderClientsSummary() {
    const clients = getClients();
    const totalActive = clients.filter((c) => c.status !== 'inativo').length;
    const el = document.getElementById('clientsTotal');
    if (el) el.textContent = String(totalActive);
  }

  function renderClientsList(highlightId) {
    const listEl = document.getElementById('clientsList');
    const emptyEl = document.getElementById('clientsEmpty');
    if (!listEl || !emptyEl) return;
    const search =
      document.getElementById('clientsSearch')?.value.toLowerCase().trim() || '';
    const clients = getClients();
    const properties = getProperties();
    const visits = getVisits();
    let items = clients.map((c) => {
      const prop = properties.find((p) => p.clientId === c.id);
      const vList = visits.filter(
        (vi) => vi.type === 'cliente' && vi.refId === c.id
      );
      const last = vList.sort((a, b) => new Date(b.at) - new Date(a.at))[0];
      return {
        client: c,
        prop,
        visitCount: vList.length,
        lastTime: last ? new Date(last.at).getTime() : 0,
      };
    });
    if (clientsFilter === 'active')
      items = items.filter((it) => it.client.status !== 'inativo');
    if (search)
      items = items.filter((it) =>
        (it.client.name || '').toLowerCase().includes(search)
      );
    items.sort((a, b) => {
      if (clientsSort === 'recent') return b.lastTime - a.lastTime;
      if (clientsSort === 'visits') return b.visitCount - a.visitCount;
      return (a.client.name || '').localeCompare(b.client.name || '');
    });
    listEl.innerHTML = '';
    items.forEach((it) => {
      const div = document.createElement('div');
      div.className = 'py-2 cursor-pointer';
      const loc = [];
      if (it.prop?.city) loc.push(it.prop.city);
      if (it.prop?.state) loc.push(it.prop.state);
      div.innerHTML = `<div class="font-semibold">${
        it.client.name || '(sem nome)'
      }</div><div class="text-sm text-gray-600">${
        it.prop?.name || ''
      }${loc.length ? ' - ' + loc.join('/') : ''}</div><div class="text-xs text-gray-500">${
        it.client.status === 'inativo' ? 'Inativo' : 'Ativo'
      }</div>`;
      div.addEventListener('click', () => {
        location.href = `client-details.html?clientId=${it.client.id}&from=agronomo`;
      });
      if (highlightId && it.client.id === highlightId) {
        div.classList.add('highlight');
        setTimeout(() => div.classList.remove('highlight'), 3000);
      }
      listEl.appendChild(div);
    });
    listEl.classList.toggle('hidden', items.length === 0);
    emptyEl.classList.toggle('hidden', items.length !== 0);
    renderClientsSummary();
  }

  function bindClientsEvents() {
    document
      .getElementById('clientsSearch')
      ?.addEventListener('input', () => renderClientsList());
    const sortEl = document.getElementById('clientsSort');
    if (sortEl) {
      sortEl.value = clientsSort;
      sortEl.addEventListener('change', (e) => {
        clientsSort = e.target.value;
        localStorage.setItem(CLIENTS_SORT_KEY, clientsSort);
        renderClientsList();
      });
    }
    document.querySelectorAll('#clientsFilterChips button').forEach((b) => {
      if (b.dataset.filter === clientsFilter) b.classList.add('filter-active');
      b.addEventListener('click', () => {
        clientsFilter = b.dataset.filter;
        localStorage.setItem(CLIENTS_FILTER_KEY, clientsFilter);
        document
          .querySelectorAll('#clientsFilterChips button')
          .forEach((bt) => bt.classList.remove('filter-active'));
        b.classList.add('filter-active');
        renderClientsList();
      });
    });
    document
      .getElementById('btnClientsQuickAdd')
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

  function renderLeadsList() {
    const listEl = document.getElementById('leadsList');
    const emptyEl = document.getElementById('leadsEmpty');
    if (!listEl || !emptyEl) return;
    const search =
      document.getElementById('leadsSearch')?.value.toLowerCase().trim() || '';
    const leads = getLeads().filter((l) => l.stage !== 'Convertido');
    const visits = getVisits();
    let items = leads.map((l) => {
      const vList = visits.filter((v) => v.type === 'lead' && v.refId === l.id);
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
      div.className = 'py-2 cursor-pointer';
      div.innerHTML = `<div class="font-semibold">${
        it.lead.name || '(sem nome)'
      }</div><div class="text-sm text-gray-600">${
        it.lead.farmName || ''
      }</div><div class="text-xs text-gray-500">${
        it.lead.interest || ''
      }</div>`;
      div.addEventListener('click', () => {
        location.href = `client-details.html?leadId=${it.lead.id}`;
      });
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
    document.getElementById('visitReturnAt').required = false;
    const needReason = interest === 'Sem interesse';
    leadReason.classList.toggle('hidden', !needReason);
    document.getElementById('visitReason').required = needReason;
  }
  visitInterest?.addEventListener('change', refreshLeadFields);
  visitSale?.addEventListener('change', refreshLeadFields);

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
    ?.addEventListener('submit', (e) => {
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
      const lat = parseFloat(document.getElementById('qcLat').value);
      const lng = parseFloat(document.getElementById('qcLng').value);
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
      } else {
        created = addClient({ name });
        addProperty({
          clientId: created.id,
          name: farm,
          lat: isNaN(lat) ? null : lat,
          lng: isNaN(lng) ? null : lng,
        });
        highlightClientId = created.id;
        renderClientsSummary();
        if (location.hash === '#clientes') {
          renderClientsList(created.id);
          highlightClientId = null;
        }
      }
      renderMap();
      renderHomeMetrics();
      renderAgendaHome(
        parseInt(document.getElementById('agendaPeriod')?.value || '7')
      );
      const reopen = !visitModal.classList.contains('hidden');
      toggleModal(quickCreateModal, false);
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
    const atEl = document.getElementById('visitAt');
    const notesEl = document.getElementById('visitNotes');
    let valid = true;
    if (!atEl.value) {
      setFieldError(atEl, 'Campo obrigatório');
      valid = false;
    }
    if (!notesEl.value.trim()) {
      setFieldError(notesEl, 'Campo obrigatório');
      valid = false;
    }
    const visit = {
      type,
      refId,
      at: atEl.value,
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
          const client = addClient({ name: lead.name });
          const property = addProperty({
            clientId: client.id,
            name: lead.farmName,
            lat: lead.lat,
            lng: lead.lng,
          });
          addSale({
            clientId: client.id,
            propertyId: property.id,
            formulationId: saleData.formulationId,
            formulationName: saleData.formulationName,
            tons: saleData.tons,
            note: saleData.note,
          });
          updateLead(refId, { stage: 'Convertido' });
          renderMap();
        }
      } else {
        if (interest === 'Interessado' || interest === 'Na dúvida') {
          const when = document.getElementById('visitReturnAt').value;
          const note = document
            .getElementById('visitReturnNote')
            .value.trim();
          if (when) {
            addAgenda({ title: 'Retorno', when, leadId: refId, note });
            renderAgendaHome(
              parseInt(document.getElementById('agendaPeriod')?.value || '7')
            );
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
    const saved = addVisit(visit);
    console.log('[VISITS] novo', saved.id);
    showToast('Visita registrada com sucesso!', 'success');
    toggleModal(visitModal, false);
    clearErrors(form);
    form.reset();
    renderClientsList();
    renderLeadsList();
    renderHomeMetrics();
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

  function renderHomeMetrics() {
    document.getElementById('metricClients').textContent = String(
      getClients().length
    );
    document.getElementById('metricVisits').textContent = String(
      countVisitsLast30d()
    );
    const sales = sumSalesLast30d();
    document.getElementById('metricSales').textContent = sales.toLocaleString(
      'pt-BR',
      { maximumFractionDigits: 2 }
    );
  }

  function bindHomeQuickActions() {
    document
      .getElementById('chipAddCliente')
      ?.addEventListener('click', () => openQuickCreateModal('cliente'));
    document
      .getElementById('chipAddLead')
      ?.addEventListener('click', () => openQuickCreateModal('lead'));
    document
      .getElementById('chipRegVisit')
      ?.addEventListener('click', () => openVisitModal());
  }

  // ===== Agenda Home =====
  function renderAgendaHome(periodDays = 7) {
    const select = document.getElementById('agendaPeriod');
    if (select) select.value = String(periodDays);
    const listEl = document.getElementById('agendaList');
    const emptyEl = document.getElementById('agendaEmpty');
    if (!listEl || !emptyEl) return;
    listEl.innerHTML = '';
    const agenda = getAgenda();
    const now = new Date();
    const limit = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);
    const leads = getLeads().filter((l) => l.stage !== 'Convertido');
    const clients = getClients();
    const items = agenda
      .filter((it) => {
        if (it.done) return false;
        const w = new Date(it.when);
        if (isNaN(w)) return false;
        return w >= now && w <= limit;
      })
      .sort((a, b) => new Date(a.when) - new Date(b.when));
    items.forEach((it) => {
      const when = new Date(it.when);
      const li = document.createElement('li');
      li.className = 'flex justify-between items-start gap-2 py-2';
      const info = document.createElement('div');
      info.className = 'flex-1';
      const dt = document.createElement('div');
      dt.className = 'text-sm';
      dt.textContent = when.toLocaleString('pt-BR');
      const nameDiv = document.createElement('div');
      nameDiv.className = 'font-semibold';
      let name = '(sem nome)';
      let type = 'Lead';
      if (it.clientId) {
        const c = clients.find((cl) => cl.id === it.clientId);
        name = c?.name || '(sem nome)';
        type = 'Cliente';
      } else if (it.leadId) {
        const l = leads.find((ld) => ld.id === it.leadId);
        name = l?.name || '(sem nome)';
        type = 'Lead';
      }
      nameDiv.innerHTML = `<span class="text-xs bg-blue-100 text-blue-800 rounded px-1 mr-1">${type}</span>${name}`;
      info.appendChild(dt);
      info.appendChild(nameDiv);
      if (it.note) {
        const note = document.createElement('div');
        note.className = 'text-xs text-gray-600';
        note.textContent = it.note;
        info.appendChild(note);
      }
      const btn = document.createElement('button');
      btn.className = 'btn-secondary text-sm';
      btn.textContent = 'Concluir';
      btn.addEventListener('click', () => {
        updateAgenda(it.id, { done: true });
        renderAgendaHome(parseInt(select.value));
        renderHomeMetrics();
      });
      li.appendChild(info);
      li.appendChild(btn);
      listEl.appendChild(li);
    });
    listEl.classList.toggle('hidden', items.length === 0);
    emptyEl.classList.toggle('hidden', items.length !== 0);
    const upcomingCount = agenda.filter((it) => {
      if (it.done) return false;
      const w = new Date(it.when);
      if (isNaN(w)) return false;
      return w >= now && w <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }).length;
    toggleHomeBadge(upcomingCount);
  }

  function bindAgendaHomeEvents() {
    document.getElementById('agendaPeriod')?.addEventListener('change', (e) => {
      const days = parseInt(e.target.value);
      renderAgendaHome(days);
    });
    document.getElementById('btnAgendaAddVisit')?.addEventListener('click', () => {
      openVisitModal();
    });
  }

  function toggleHomeBadge(count) {
    const btn = document.querySelector('#bottomBar button[data-nav="#home"]');
    if (!btn) return;
    btn.classList.add('relative');
    let badge = btn.querySelector('span.badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge absolute top-0 right-1 bg-red-500 text-white rounded-full text-xs px-1';
        btn.appendChild(badge);
      }
      badge.textContent = String(count);
    } else {
      badge?.remove();
    }
  }
  function handleHashChange() {
    if (location.hash === '#mapa') {
      const focusId = sessionStorage.getItem('focusClientId');
      if (focusId) {
        focusClient(focusId);
        sessionStorage.removeItem('focusClientId');
      }
    }
    if (location.hash === '#clientes') {
      renderClientsList(highlightClientId);
      highlightClientId = null;
    }
    if (location.hash === '#leads') {
      renderLeadsList();
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

  bindClientsEvents();
  bindLeadsEvents();
  renderClientsList();
  renderLeadsList();
  bindAgendaHomeEvents();
  bindHomeQuickActions();
  renderAgendaHome(7);
  renderHomeMetrics();
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}
