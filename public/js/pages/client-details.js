// js/pages/client-details.js

// This page is loaded after the Firebase compat SDKs, so the global
// `firebase` object is available. We use the compat API
// (firebase.firestore()) to keep the code consistent with the rest of the
// project.

import { getLeads } from '../stores/leadsStore.js';
import { getVisits, updateVisit } from '../stores/visitsStore.js';

export function initClientDetails(userId, userRole) {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('clientId');
  const leadId = params.get('leadId');
  const from = params.get('from') || 'agronomo';
  const isLead = !!leadId;
  const id = leadId || clientId;

  if (!id) return;

  const db = firebase.firestore();

  const clientNameHeader = document.getElementById('clientNameHeader');
  const summaryName = document.getElementById('summaryName');
  const summaryProperty = document.getElementById('summaryProperty');
  const summaryInterest = document.getElementById('summaryInterest');
  const propertiesList = document.getElementById('propertiesList');
  const historyTimeline = document.getElementById('historyTimeline');

  // --- Navegação ----------------------------------------------------------
  document.getElementById('backBtn')?.addEventListener('click', () => {
    if (from === 'admin') {
      window.location.href = 'dashboard-admin.html';
    } else if (from === 'agronomo') {
      window.location.href = 'dashboard-agronomo.html';
    } else {
      window.history.back();
    }
  });

  // --- Utilitários --------------------------------------------------------
  function formatDate(str) {
    const d = new Date(str);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function interestClass(interest) {
    if (interest === 'Interessado') return 'bg-green-100 text-green-800';
    if (interest === 'Sem interesse') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  }

  // --- Carrega dados ------------------------------------------------------
  async function loadClient() {
    try {
      const snap = await db.collection('clients').doc(clientId).get();
      const data = snap.data();
      if (clientNameHeader) clientNameHeader.textContent = data?.name || 'Cliente';
      if (summaryName) summaryName.textContent = data?.name || '';
      if (summaryInterest) summaryInterest.classList.add('hidden');
    } catch (err) {
      console.error('Erro ao carregar cliente:', err);
      if (clientNameHeader) clientNameHeader.textContent = 'Erro ao carregar';
    }
  }

  function loadLead() {
    const lead = getLeads().find((l) => l.id === leadId);
    if (!lead) return;
    if (clientNameHeader) clientNameHeader.textContent = lead.name || 'Lead';
    if (summaryName) summaryName.textContent = lead.name || '';
    if (summaryProperty) summaryProperty.textContent = lead.farmName || '—';
    if (summaryInterest) {
      summaryInterest.textContent = lead.interest || '';
      summaryInterest.className = `text-xs font-semibold px-2 py-1 rounded ${interestClass(lead.interest)}`;
      summaryInterest.classList.remove('hidden');
    }
    document.getElementById('propertiesSection')?.classList.add('hidden');
  }

  function loadVisits() {
    if (!historyTimeline) return;
    const visits = getVisits().filter(
      (v) => v.refId === id && v.type === (isLead ? 'lead' : 'cliente')
    );
    if (!visits.length) {
      historyTimeline.innerHTML = '<p class="text-gray-500">Nenhuma visita registrada.</p>';
      return;
    }
    visits.sort((a, b) => new Date(b.at) - new Date(a.at));
    historyTimeline.innerHTML = '';
    visits.forEach((v) => {
      const card = document.createElement('div');
      card.className = 'mb-4 pl-4 border-l-2 border-green-600';
      const interest = isLead && v.interest
        ? `<span class="ml-2 ${interestClass(v.interest)} text-xs font-medium px-2 py-0.5 rounded">${v.interest}</span>`
        : '';
      card.innerHTML = `
        <div class="text-sm text-gray-500">${formatDate(v.at)}${interest}</div>
        <div class="mt-1">${v.notes || ''}</div>
        <button class="text-xs text-green-700 mt-1 edit-visit" data-id="${v.id}">Editar</button>
      `;
      historyTimeline.appendChild(card);
    });
  }

  historyTimeline?.addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-visit');
    if (!btn) return;
    const visitId = btn.dataset.id;
    const visit = getVisits().find((v) => v.id === visitId);
    if (!visit) return;
    const newText = prompt('Editar texto da visita', visit.notes || '');
    if (newText === null) return;
    updateVisit(visitId, { notes: newText.trim() });
    loadVisits();
  });

  // --- Lista propriedades -------------------------------------------------
  async function loadProperties() {
    if (!propertiesList) return;
    propertiesList.innerHTML = '';

    try {
      const snap = await db
        .collection('clients')
        .doc(clientId)
        .collection('properties')
        .get();

      if (snap.empty) {
        propertiesList.innerHTML =
          '<p class="text-gray-500">Nenhuma propriedade cadastrada.</p>';
        if (summaryProperty) summaryProperty.textContent = '—';
        return;
      }

      let firstPropName = '';
      snap.forEach((doc) => {
        const data = doc.data();
        const propertyId = doc.id;

        if (!firstPropName) firstPropName = data.name || '';

        const card = document.createElement('div');
        card.className = 'card flex justify-between items-center';
        card.innerHTML = `
          <span>${data.name || 'Sem nome'}</span>
          <div class="flex gap-2">
            <a class="btn-secondary text-xs" href="property-details.html?clientId=${clientId}&propertyId=${propertyId}&from=${from}">Abrir</a>
            <a class="btn-secondary text-xs" href="property-employees.html?clientId=${clientId}&propertyId=${propertyId}&from=${from}">Equipe</a>
          </div>
        `;
        propertiesList.appendChild(card);
      });

      if (summaryProperty) summaryProperty.textContent = firstPropName;
    } catch (err) {
      console.error('Erro ao carregar propriedades:', err);
      propertiesList.innerHTML =
        '<p class="text-red-500">Erro ao carregar propriedades.</p>';
    }
  }

  // --- Adiciona nova propriedade -----------------------------------------
  async function addProperty() {
    const name = prompt('Nome da propriedade');
    if (!name) return;

    try {
      await db
        .collection('clients')
        .doc(clientId)
        .collection('properties')
        .add({ name: name.trim() });
      await loadProperties();
    } catch (err) {
      console.error('Erro ao adicionar propriedade:', err);
    }
  }

  document
    .getElementById('showAddPropertyBtn')
    ?.addEventListener('click', addProperty);

  // --- Inicialização ------------------------------------------------------
  if (isLead) {
    loadLead();
  } else {
    loadClient();
    loadProperties();
  }
  loadVisits();
}

