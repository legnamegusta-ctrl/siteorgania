// js/pages/mapa-geral.js

import { db } from '../config/firebase.js';
import { showSpinner, hideSpinner } from '../services/ui.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

export function initMapaGeral() {
  const mapContainer = document.getElementById('mapaGeral');
  if (!mapContainer) return;
  let map = null;

  async function loadLeads() {
    showSpinner(mapContainer);
    try {
      const snap = await getDocs(collection(db, 'leads'));
      hideSpinner(mapContainer);
      if (snap.empty) {
        mapContainer.innerHTML = '<p class="text-center text-gray-500 p-8">Nenhum lead cadastrado.</p>';
        return;
      }
      initializeMap();
      snap.forEach((docSnap) => {
        const lead = docSnap.data();
        if (lead.lat && lead.lng) {
          const color = lead.stage === 'Visitado' ? 'green' : 'blue';
          const marker = L.circleMarker([lead.lat, lead.lng], { color }).addTo(map);
          const popup = `<b>${lead.nomeContato || 'Lead'}</b><br><a href="dashboard-agronomo.html?leadId=${docSnap.id}" class="text-blue-600 underline">Abrir lead</a>`;
          marker.bindPopup(popup);
        }
      });
    } catch (err) {
      console.error('Erro ao carregar leads no mapa:', err);
      hideSpinner(mapContainer);
      mapContainer.innerHTML = '<p class="text-center text-red-500 p-8">Ocorreu um erro ao carregar os leads.</p>';
    }
  }

  function initializeMap() {
    if (map) return;
    map = L.map('mapaGeral').setView([-14.235, -51.925], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
  }

  loadLeads();
}
