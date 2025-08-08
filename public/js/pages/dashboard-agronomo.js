// js/pages/dashboard-agronomo.js
import { db } from '../config/firebase.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

export async function initAgronomoDashboard() {
  const farmList = document.getElementById('farmList');
  const addBtn = document.getElementById('addClientBtn');
  if (!addBtn) {
    return;
  }
  addBtn.addEventListener('click', () => {
    window.location.href = 'client-details.html';
  });

  try {
    const clientsSnap = await getDocs(collection(db, 'clients'));
    for (const clientDoc of clientsSnap.docs) {
      const clientData = clientDoc.data();
      const propertiesSnap = await getDocs(collection(clientDoc.ref, 'properties'));
      for (const propDoc of propertiesSnap.docs) {
        const propData = propDoc.data();
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow flex flex-col';
        card.innerHTML = `<h3 class="text-lg font-semibold mb-2">${propData.name || 'Propriedade'}</h3><span class="text-sm text-gray-500 mb-4">${clientData.name || ''}</span><button class="mt-auto px-3 py-2 text-white rounded" style="background-color: var(--brand-green);">Abrir</button>`;
        card.querySelector('button').addEventListener('click', () => {
          window.location.href = `agronomo-farm.html?clientId=${clientDoc.id}&propertyId=${propDoc.id}`;
        });
        farmList.appendChild(card);
      }
    }
  } catch (err) {
    console.error('Erro ao carregar fazendas:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('addClientBtn')) {
    initAgronomoDashboard();
  }
});
