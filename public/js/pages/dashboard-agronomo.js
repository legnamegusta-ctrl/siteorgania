// js/pages/dashboard-agronomo.js
import { db } from '../config/firebase.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

export async function initAgronomoDashboard(userId) {
  const clientList = document.getElementById('clientList');
  const addBtn = document.getElementById('addClientBtn');
  if (!addBtn) {
    return;
  }
  addBtn.addEventListener('click', () => {
    window.location.href = 'client-details.html';
  });

  try {
    const q = query(collection(db, 'clients'), where('agronomistId', '==', userId));
    const clientsSnap = await getDocs(q);
    clientsSnap.forEach(clientDoc => {
      const clientData = clientDoc.data();
      const card = document.createElement('div');
      card.className = 'bg-white p-4 rounded-lg shadow flex flex-col';
      card.innerHTML = `<h3 class="text-lg font-semibold mb-4">${clientData.name || 'Cliente'}</h3><button class="mt-auto px-3 py-2 text-white rounded" style="background-color: var(--brand-green);">Abrir</button>`;
      card.querySelector('button').addEventListener('click', () => {
        window.location.href = `client-details.html?clientId=${clientDoc.id}&from=agronomo`;
      });
      clientList.appendChild(card);
    });
  } catch (err) {
    console.error('Erro ao carregar clientes:', err);
  }
}