import { initBottomNav, bindPlus, toggleModal } from './agro-bottom-nav.js';
import { getCurrentPositionSafe } from '../utils/geo.js';
import { initAgroMap, setMapCenter, plotLeads } from './agro-map.js';
import { getLeads, addLead, updateLead } from '../stores/leadsStore.js';
import { getClients, addClient } from '../stores/clientsStore.js';
import { addProperty } from '../stores/propertiesStore.js';
import { addVisit } from '../stores/visitsStore.js';
import { addAgenda, getAgenda, updateAgenda } from '../stores/agendaStore.js';

export function initAgronomoDashboard() {
  const quickModal = document.getElementById('quickActionsModal');
  const addLeadModal = document.getElementById('addLeadModal');
  const latInput = document.getElementById('leadLat');
  const lngInput = document.getElementById('leadLng');
  const btnUseLocation = document.getElementById('btnUseLocation');
  const visitModal = document.getElementById('visitModal');
  const saleModal = document.getElementById('saleModal');
  const quickCreateModal = document.getElementById('quickCreateModal');

  initBottomNav();
  initAgroMap();
  plotLeads(getLeads());

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
    const nome = document.getElementById('leadNome').value.trim();
    const propriedade = document.getElementById('leadPropriedade').value.trim();
    if (!nome || !propriedade) return;
    const notas = document.getElementById('leadNotas').value.trim();
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    const newLead = addLead({ name: nome, farmName: propriedade, notes: notas, lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng });
    console.log('[LEADS] novo', newLead.id);
    plotLeads(getLeads());
    if (newLead.lat && newLead.lng) setMapCenter(newLead.lat, newLead.lng);
    location.hash = '#mapa';
    toggleModal(addLeadModal, false);
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
    const items = type === 'lead' ? getLeads() : getClients();
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
    document.getElementById('visitReturnAt').required = needFollow;
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
      const type = document.querySelector("input[name='quickType']:checked").value;
      const name = document.getElementById('qcName').value.trim();
      const farm = document.getElementById('qcFarm').value.trim();
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
        plotLeads(getLeads());
      } else {
        created = addClient({ name });
        addProperty({
          clientId: created.id,
          name: farm,
          lat: isNaN(lat) ? null : lat,
          lng: isNaN(lng) ? null : lng,
        });
      }
      const reopen = !visitModal.classList.contains('hidden');
      toggleModal(quickCreateModal, false);
      if (reopen) {
        populateVisitSelect(type);
        visitSelect.value = created.id;
        toggleModal(visitModal, true);
      }
    });

  visitForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.querySelector("input[name='visitTarget']:checked").value;
    const refId = visitSelect.value;
    if (!refId) return;
    const at = document.getElementById('visitAt').value;
    const notes = document.getElementById('visitNotes').value.trim();
    let visit = { type, refId, at, notes };
    if (type === 'lead') {
      const interest = visitInterest.value;
      if (!interest) return;
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
          addProperty({
            clientId: client.id,
            name: lead.farmName,
            lat: lead.lat,
            lng: lead.lng,
          });
          updateLead(refId, { stage: 'Convertido' });
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
          if (!reason) return;
          visit.reason = reason;
        }
      }
      const lead = getLeads().find((l) => l.id === refId);
      visit.leadName = lead?.name;
    }
    const saved = addVisit(visit);
    console.log('[VISITS] novo', saved.id);
    toggleModal(visitModal, false);
    if (type === 'lead') {
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
        const formulationId = formulaSelect.value;
        const tons = parseFloat(document.getElementById('saleTons').value);
        const note = document.getElementById('saleNote').value.trim();
        toggleModal(saleModal, false);
        cleanup();
        resolve({ formulationId, tons, note });
      }
      function onCancel() {
        toggleModal(saleModal, false);
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
    const leads = getLeads();
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

  bindAgendaHomeEvents();
  renderAgendaHome(7);
}
