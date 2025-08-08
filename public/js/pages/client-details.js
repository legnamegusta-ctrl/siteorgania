import { db } from '../config/firebase.js';
import { doc, getDoc, collection, getDocs, addDoc } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

export async function initClientDetails(userId, userRole) {
        const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    const from = params.get('from') || 'agronomo';

    const backBtn = document.getElementById('backBtn');
 const clientNameHeader = document.getElementById('clientNameHeader');
     const propertiesListDiv = document.getElementById('propertiesList');
 const showAddPropertyBtn = document.getElementById('showAddPropertyBtn');

   if (backBtn) {
        backBtn.href = from === 'admin' ? 'dashboard-admin.html' : 'dashboard-agronomo.html';
    }

    if (!clientId) {
 clientNameHeader.textContent = 'Cliente não encontrado';
         return;
    }

const clientRef = doc(db, 'clients', clientId);
    const clientSnap = await getDoc(clientRef);
    if (clientSnap.exists()) {
        clientNameHeader.textContent = clientSnap.data().name || 'Cliente';
        }

 async function loadProperties() {
        propertiesListDiv.innerHTML = '';
        const propsSnap = await getDocs(collection(clientRef, 'properties'));
        if (propsSnap.empty) {
            propertiesListDiv.innerHTML = '<p class="text-gray-500">Nenhuma propriedade cadastrada.</p>';
                        return;
        }
propsSnap.forEach(propDoc => {
            const prop = propDoc.data();
            const div = document.createElement('div');
            div.className = 'p-4 border rounded cursor-pointer hover:bg-gray-50';
            div.textContent = prop.name || 'Propriedade';
            div.addEventListener('click', () => {
                window.location.href = `property-details.html?clientId=${clientId}&propertyId=${propDoc.id}&from=${from}`;
            });
propertiesListDiv.appendChild(div);
        });
    }

async function addProperty() {
        const name = prompt('Nome da propriedade');
        if (!name) return;
        await addDoc(collection(clientRef, 'properties'), { name });
        loadProperties();
    }

    if (showAddPropertyBtn) {
        showAddPropertyBtn.addEventListener('click', addProperty);
    }

    loadProperties();
}