// js/pages/client-details.js

// This page is loaded after the Firebase compat SDKs, so the global
// `firebase` object is available. We use the compat API
// (firebase.firestore()) to keep the code consistent with the rest of the
// project.

export function initClientDetails(userId, userRole) {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('clientId');
  const from = params.get('from') || 'agronomo';

  if (!clientId) return;

  const db = firebase.firestore();

  const clientNameHeader = document.getElementById('clientNameHeader');
  const summaryName = document.getElementById('summaryName');
  const summaryProperty = document.getElementById('summaryProperty');
  const propertiesList = document.getElementById('propertiesList');

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

  // --- Carrega dados do cliente ------------------------------------------
  async function loadClient() {
    try {
      const snap = await db.collection('clients').doc(clientId).get();
      const data = snap.data();
      if (clientNameHeader) clientNameHeader.textContent = data?.name || 'Cliente';
      if (summaryName) summaryName.textContent = data?.name || '';
    } catch (err) {
      console.error('Erro ao carregar cliente:', err);
      if (clientNameHeader) clientNameHeader.textContent = 'Erro ao carregar';
    }
  }

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
  loadClient();
  loadProperties();
}

