// js/pages/agronomo-farm.js
import { db } from '../config/firebase.js';
import { doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

export async function initAgronomoFarm() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('clientId');
  const propertyId = params.get('propertyId');
  if (!clientId || !propertyId) {
    document.getElementById('farmTitle').textContent = 'Fazenda não encontrada';
    return;
  }

  try {
    const propertyRef = doc(db, `clients/${clientId}/properties/${propertyId}`);
    const propertySnap = await getDoc(propertyRef);
    const propertyData = propertySnap.exists() ? propertySnap.data() : { name: 'Fazenda' };
    document.getElementById('farmTitle').textContent = propertyData.name || 'Fazenda';

    document.getElementById('employeesLink').href = `property-employees.html?clientId=${clientId}&propertyId=${propertyId}`;
    document.getElementById('agendaLink').href = `agenda.html?clientId=${clientId}&propertyId=${propertyId}`;
    document.getElementById('plotsLink').href = `property-details.html?clientId=${clientId}&propertyId=${propertyId}&from=agronomo`;

    const plotsRef = collection(propertyRef, 'plots');
    const plotsSnap = await getDocs(plotsRef);
    const overview = document.getElementById('overview');
    overview.innerHTML = `<div class="bg-white p-6 rounded-lg shadow"><p class="text-gray-700">${plotsSnap.size} talhões cadastrados.</p></div>`;
  } catch (err) {
    console.error('Erro ao carregar dados da fazenda:', err);
  }
}

initAgronomoFarm();