import { getClients } from '../stores/clientsStore.js';
import { getLeads } from '../stores/leadsStore.js';
import { getProperties, addProperty } from '../stores/propertiesStore.js';
import { getVisits } from '../stores/visitsStore.js';
import { getSalesByClient, addSale } from '../stores/salesStore.js';
import { getCurrentPositionSafe } from '../utils/geo.js';

function toggleModal(modal, show) {
  if (!modal) return;
  modal.classList.toggle('hidden', !show);
  document.body.classList.toggle('has-modal', show);
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

export function initClientDetails(userId, userRole) {
  const params = new URLSearchParams(location.search);
  const clientId = params.get('clientId');
  const leadId = params.get('leadId');
  const from = params.get('from') || 'agronomo';
  if (!clientId && !leadId) return;

  if (leadId) {
    const lead = getLeads().find((l) => l.id === leadId);
    const header = document.getElementById('clientNameHeader');
    if (header) header.textContent = lead?.name || 'Lead';
    document.getElementById('backBtn')?.addEventListener('click', () => {
      location.href = 'dashboard-agronomo.html#leads';
    });
    const summaryName = document.getElementById('summaryName');
    const summaryProperty = document.getElementById('summaryProperty');
    const summaryInterest = document.getElementById('summaryInterest');
    if (summaryName) summaryName.textContent = lead?.name || '';
    if (summaryProperty) summaryProperty.textContent = lead?.farmName || '—';
    if (summaryInterest) summaryInterest.textContent = lead?.interest
      ? `Interesse: ${lead.interest}`
      : '';
    document.getElementById('propertiesSection')?.classList.add('hidden');
    document.getElementById('btnNewSale')?.classList.add('hidden');
    document.getElementById('btnRegisterVisit')?.classList.add('hidden');
    renderLeadTimeline(leadId);
    return;
  }

  const client = getClients().find((c) => c.id === clientId);
  const clientNameHeader = document.getElementById('clientNameHeader');
  if (clientNameHeader) clientNameHeader.textContent = client?.name || 'Cliente';

  document.getElementById('backBtn')?.addEventListener('click', () => {
    if (from === 'agronomo') {
      location.href = 'dashboard-agronomo.html';
    } else {
      history.back();
    }
  });

  const summaryName = document.getElementById('summaryName');
  const summaryProperty = document.getElementById('summaryProperty');
  if (summaryName) summaryName.textContent = client?.name || '';
  const allProps = getProperties().filter((p) => p.clientId === clientId);
  const mainProp = allProps[0];
  if (summaryProperty) {
    if (mainProp) {
      const loc = [];
      if (mainProp.city) loc.push(mainProp.city);
      if (mainProp.state) loc.push(mainProp.state);
      summaryProperty.textContent = `${mainProp.name}${loc.length ? ' - ' + loc.join('/') : ''}`;
    } else summaryProperty.textContent = '—';
  }

  document.getElementById('btnViewMap')?.addEventListener('click', () => {
    sessionStorage.setItem('focusClientId', clientId);
    location.href = 'dashboard-agronomo.html#mapa';
  });

  const propertiesListDiv = document.getElementById('propertiesList');
  function renderProperties() {
    propertiesListDiv.innerHTML = '';
    const props = getProperties().filter((p) => p.clientId === clientId);
    if (!props.length) {
      propertiesListDiv.innerHTML = '<p class="text-gray-500">Nenhuma propriedade cadastrada.</p>';
      return;
    }
    props.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'card';
      div.textContent = p.name;
      div.addEventListener('click', () => {
        location.href = `property-details.html?clientId=${clientId}&propertyId=${p.id}&from=${from}`;
      });
      propertiesListDiv.appendChild(div);
    });
  }
  renderProperties();

  const addModal = document.getElementById('addPropertyModal');
  const addForm = document.getElementById('addPropertyForm');
  document.getElementById('showAddPropertyBtn')?.addEventListener('click', () => {
    addForm.reset();
    clearErrors(addForm);
    toggleModal(addModal, true);
  });
  document.getElementById('addPropUseLocation')?.addEventListener('click', async () => {
    const coords = await getCurrentPositionSafe();
    if (coords) {
      document.getElementById('addPropLat').value = coords.lat.toFixed(6);
      document.getElementById('addPropLng').value = coords.lng.toFixed(6);
    }
  });
  document.getElementById('btnAddPropCancel')?.addEventListener('click', () => toggleModal(addModal, false));
  addForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    clearErrors(addForm);
    const nameInput = document.getElementById('addPropName');
    const name = nameInput.value.trim();
    if (!name) {
      setFieldError(nameInput, 'Campo obrigatório');
      return;
    }
    const lat = parseFloat(document.getElementById('addPropLat').value);
    const lng = parseFloat(document.getElementById('addPropLng').value);
    const prop = { clientId, name };
    if (!isNaN(lat) && !isNaN(lng)) Object.assign(prop, { lat, lng });
    addProperty(prop);
    toggleModal(addModal, false);
    renderProperties();
  });

  function renderLeadTimeline(id) {
    const container = document.getElementById('historyTimeline');
    container.innerHTML = '';
    const visits = getVisits().filter((v) => v.type === 'lead' && v.refId === id);
    if (!visits.length) {
      container.innerHTML = '<p class="text-gray-500">Sem histórico.</p>';
      return;
    }
    const items = visits.sort((a, b) => new Date(b.at) - new Date(a.at));
    const ul = document.createElement('ul');
    ul.className = 'timeline';
    items.forEach((v) => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      const badge = document.createElement('span');
      badge.className = 'timeline-badge';
      const card = document.createElement('div');
      card.className = 'card ml-4';
      const dateStr = new Date(v.at).toLocaleString('pt-BR');
      card.innerHTML = `<div class="font-semibold">Visita</div><div class="text-sm text-gray-500">${dateStr}</div><div>${v.note || ''}</div><div class="text-xs text-gray-500">${v.interest || ''}</div>`;
      li.appendChild(badge);
      li.appendChild(card);
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  function renderTimeline() {
    const container = document.getElementById('historyTimeline');
    container.innerHTML = '';
    const visits = getVisits().filter((v) => v.type === 'cliente' && v.refId === clientId);
    const sales = getSalesByClient(clientId);
    const items = [
      ...visits.map((v) => ({ type: 'visit', at: v.at, note: v.note })),
      ...sales.map((s) => ({
        type: 'sale',
        at: s.createdAt,
        formulationName: s.formulationName || s.formulationId,
        tons: s.tons,
        note: s.note,
      })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));
    if (!items.length) {
      container.innerHTML = '<p class="text-gray-500">Sem histórico.</p>';
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'timeline';
    items.forEach((it) => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      const badge = document.createElement('span');
      badge.className = 'timeline-badge';
      const card = document.createElement('div');
      card.className = 'card ml-4';
      const dateStr = new Date(it.at).toLocaleString('pt-BR');
      if (it.type === 'visit') {
        card.innerHTML = `<div class="font-semibold">Visita</div><div class="text-sm text-gray-500">${dateStr}</div><div>${it.note || ''}</div>`;
      } else {
        card.innerHTML = `<div class="font-semibold">Venda</div><div class="text-sm text-gray-500">${dateStr}</div><div>${it.formulationName} - ${it.tons}t</div><div>${it.note || ''}</div>`;
      }
      li.appendChild(badge);
      li.appendChild(card);
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }
  renderTimeline();

  document.getElementById('btnRegisterVisit')?.addEventListener('click', () => {
    sessionStorage.setItem('visitForClientId', clientId);
    location.href = 'dashboard-agronomo.html#visita';
  });

  document.getElementById('btnNewSale')?.addEventListener('click', async () => {
    const data = await openSaleModal();
    if (!data) return;
    addSale({ clientId, ...data });
    renderTimeline();
  });

  async function openSaleModal() {
    const modal = document.getElementById('saleModal');
    const saleForm = document.getElementById('saleForm');
    const formulaSelect = document.getElementById('saleFormula');
    await loadFormulas();
    toggleModal(modal, true);
    return new Promise((resolve) => {
      function cleanup() {
        saleForm.removeEventListener('submit', onSubmit);
        document.getElementById('btnSaleCancel').removeEventListener('click', onCancel);
      }
      function onSubmit(e) {
        e.preventDefault();
        clearErrors(saleForm);
        const formulationId = formulaSelect.value;
        const formulationName = formulaSelect.options[formulaSelect.selectedIndex]?.textContent || '';
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
        toggleModal(modal, false);
        saleForm.reset();
        cleanup();
        resolve({ formulationId, formulationName, tons, note });
      }
      function onCancel() {
        toggleModal(modal, false);
        saleForm.reset();
        cleanup();
        resolve(null);
      }
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
}
