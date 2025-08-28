// js/pages/property-employees.js
import { db } from '../config/firebase.js';
import { collection, getDocs, doc } from '/vendor/firebase/9.6.0/firebase-firestore.js';

export async function initPropertyEmployees() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('clientId');
  const propertyId = params.get('propertyId');
  const from = params.get('from') || 'agronomo';
  if (!clientId || !propertyId) return;

  document.getElementById('backToFarm').href = `property-details.html?clientId=${clientId}&propertyId=${propertyId}&from=${from}`;

  try {
    const employeesRef = collection(doc(db, `clients/${clientId}/properties/${propertyId}`), 'employees');
    const snapshot = await getDocs(employeesRef);
    const body = document.getElementById('employeesBody');
    if (snapshot.empty) {
      document.getElementById('noEmployeesMsg').classList.remove('hidden');
      return;
    }
    snapshot.forEach((docu) => {
      const data = docu.data();
      const row = document.createElement('tr');
      row.innerHTML = `<td class="py-2 px-4 border-b">${data.name || ''}</td><td class="py-2 px-4 border-b">${data.role || ''}</td>`;
      body.appendChild(row);
    });
  } catch (err) {
    console.error('Erro ao carregar funcionários:', err);
  }
}

initPropertyEmployees();
