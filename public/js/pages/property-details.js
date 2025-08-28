// js/pages/property-details.js

import { db } from '../config/firebase.js';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, addDoc, serverTimestamp, onSnapshot, writeBatch, increment, getDoc, limit } from '/vendor/firebase/9.6.0/firebase-firestore.js';
import { showToast, showSpinner, hideSpinner, openModal, closeModal } from '../services/ui.js';

export function initPropertyDetails(userId, userRole) {
    const params = new URLSearchParams(window.location.search);
    const currentClientId = params.get('clientId');
    const currentPropertyId = params.get('propertyId');
    const from = params.get('from') || 'agronomo';

    const propertyNameHeader = document.getElementById('propertyNameHeader');
    const clientNameDisplay = document.getElementById('clientNameDisplay');
    const backBtn = document.getElementById('backBtn');
    const plotsListDiv = document.getElementById('plotsList');
    const showAddPlotModalBtn = document.getElementById('showAddPlotModalBtn');
    const viewEmployeesBtn = document.getElementById('viewEmployeesBtn');
  
    const addPlotModal = document.getElementById('addPlotModal');
    const closeAddPlotModalBtn = document.getElementById('closeAddPlotModalBtn');
    const addPlotBtn = document.getElementById('addPlotBtn');
    const newPlotNameInput = document.getElementById('newPlotName');
    const newPlotAreaInput = document.getElementById('newPlotArea');
 const newPlotPlantsInput = document.getElementById('newPlotPlants');
     const newCultureNameInput = document.getElementById('newCultureName');
    const newCultureStartDateInput = document.getElementById('newCultureStartDate');

    let isSavingPlot = false;

    if (!currentPropertyId || !currentClientId) {
         if (propertyNameHeader) propertyNameHeader.textContent = 'ID da Propriedade ou do Cliente não encontrado.';
        return;
    }

    if (viewEmployeesBtn) {
        viewEmployeesBtn.href = `property-employees.html?clientId=${currentClientId}&propertyId=${currentPropertyId}&from=${from}`;
    }

    const propertyDocRef = doc(collection(db, `clients/${currentClientId}/properties`), currentPropertyId);
    const clientDocRef = doc(db, 'clients', currentClientId);

    async function addPlotAndFirstCulture() {
        if (isSavingPlot) return;
        isSavingPlot = true;
        addPlotBtn.disabled = true;
        const plotName = newPlotNameInput.value.trim();
        const plotArea = parseFloat(newPlotAreaInput.value) || 0;
  const plotPlants = parseInt(newPlotPlantsInput.value) || 0;
          const cultureName = newCultureNameInput.value.trim();
        const cultureStartDate = newCultureStartDateInput.value;

        if (!plotName || !cultureName || !cultureStartDate) {
            showToast('Por favor, preencha o nome do talhão, o nome da cultura e a data de início.', 'error');
            addPlotBtn.disabled = false;
            isSavingPlot = false;
            return;
        }
        if (isNaN(plotArea) || plotArea <= 0) {
            showToast('A área do talhão deve ser um número válido e maior que zero.', 'error');
            addPlotBtn.disabled = false;
            isSavingPlot = false;
            return;
        }

        try {
            const batch = writeBatch(db);
            const plotsCollectionRef = collection(db, `clients/${currentClientId}/properties/${currentPropertyId}/plots`);
            const plotRef = doc(plotsCollectionRef);
            const cultureRef = doc(collection(db, `${plotsCollectionRef.path}/${plotRef.id}/culturas`));


 batch.set(plotRef, {
                name: plotName,
                area: plotArea,
                plantsCount: plotPlants,
                status: 'ativo',
                createdAt: serverTimestamp()
            });
            batch.set(cultureRef, {
                cropName: cultureName,
                startDate: new Date(cultureStartDate),
                status: 'ativo',
                createdAt: serverTimestamp()
            });
            // Use set with merge to avoid errors if documents don't exist yet
            batch.set(clientDocRef, { cultureCount: increment(1) }, { merge: true });
            batch.set(propertyDocRef, { plotCount: increment(1) }, { merge: true });
            await batch.commit();

 newPlotNameInput.value = '';
            newPlotAreaInput.value = '';
            newPlotPlantsInput.value = '';
            newCultureNameInput.value = '';
            newCultureStartDateInput.value = '';
            closeModal(addPlotModal);
            showToast('Talhão e cultura adicionados com sucesso!', 'success');

        } catch (error) {
            console.error('Erro ao adicionar talhão e cultura:', error);
            showToast('Ocorreu um erro ao salvar os dados.', 'error');
        } finally {
            addPlotBtn.disabled = false;
            isSavingPlot = false;
        }
    }

    async function loadPropertyDetails() {
        if (userRole === 'cliente') {
            if (backBtn) backBtn.href = 'dashboard-cliente.html';
            if (showAddPlotModalBtn) showAddPlotModalBtn.style.display = 'none';
        } else {
            if (backBtn) backBtn.href = `client-details.html?clientId=${currentClientId}&from=${from}`;
            if (showAddPlotModalBtn) showAddPlotModalBtn.style.display = 'inline-block';
        }

        try {
            const [propDoc, clientDoc] = await Promise.all([
                getDoc(propertyDocRef),
                getDoc(clientDocRef)
            ]);

            if (propDoc.exists()) {
                const propertyData = propDoc.data();
                if (propertyNameHeader) propertyNameHeader.textContent = propertyData.name;
            } else if (propertyNameHeader) {
                propertyNameHeader.textContent = 'Propriedade não encontrada';
            }

            if (clientDoc.exists()) {
                const clientData = clientDoc.data();
                if (clientNameDisplay) clientNameDisplay.textContent = `Cliente: ${clientData.name}`;
            } else if (clientNameDisplay) {
                clientNameDisplay.textContent = 'Cliente não encontrado';
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            if (propertyNameHeader) propertyNameHeader.textContent = 'Erro ao carregar detalhes';
        }

        setupCulturesListener();
    }

    function setupCulturesListener() {
        if (!plotsListDiv) return;
        showSpinner(plotsListDiv);
        const plotsCollectionRef = collection(db, `clients/${currentClientId}/properties/${currentPropertyId}/plots`);
        const plotsQuery = query(plotsCollectionRef, where('status', '==', 'ativo'));

        onSnapshot(plotsQuery, async (plotsSnapshot) => {
            hideSpinner(plotsListDiv);
            plotsListDiv.innerHTML = '';

            for (const plotDocSnap of plotsSnapshot.docs) {
                const plotData = plotDocSnap.data();
                const plotId = plotDocSnap.id;

  const culturasQuery = query(
                    collection(db, `${plotDocSnap.ref.path}/culturas`),
                    where('status', '==', 'ativo'),
                    orderBy('startDate', 'desc'),
                    limit(1)
                );
                const culturasSnapshot = await getDocs(culturasQuery);

                if (!culturasSnapshot.empty) {
                    const culturaDocSnap = culturasSnapshot.docs[0];
                    const cultureData = culturaDocSnap.data();
                    const startDateObj = cultureData.startDate?.toDate ? cultureData.startDate.toDate() : new Date(cultureData.startDate);
                    const startDateFormatted = isNaN(startDateObj) ? 'N/A' : startDateObj.toLocaleDateString('pt-BR');
                    const plantsCount = plotData.plantsCount || 'N/A';

                    const cultureDiv = document.createElement('div');
                    cultureDiv.className = 'p-4 bg-gray-50 rounded-lg border border-gray-200 shadow hover:shadow-md transition-shadow cursor-pointer';
                    cultureDiv.innerHTML = `
                        <h4 class="text-lg font-bold" style="color: var(--brand-green);">${plotData.name}</h4>
                        <p class="text-sm text-gray-600">Cultura de ${cultureData.cropName} (Início: ${startDateFormatted})</p>
                        <p class="text-sm text-gray-600">Pés/Plantas: ${plantsCount}</p>
                    `;
                    cultureDiv.addEventListener('click', () => {
                        window.location.href = `plot-details.html?clientId=${currentClientId}&propertyId=${currentPropertyId}&plotId=${plotId}&cultureId=${culturaDocSnap.id}&from=${from}`;
                    });
                    plotsListDiv.appendChild(cultureDiv);
                } else {
                    const noCultureDiv = document.createElement('div');
                    noCultureDiv.className = 'p-4 bg-gray-50 rounded-lg border border-gray-200 shadow';
                    noCultureDiv.innerHTML = `
                        <h4 class="text-lg font-bold" style="color: var(--brand-green);">${plotData.name}</h4>
                        <p class="text-sm text-gray-500">Nenhuma cultura ativa.</p>
                    `;
                    plotsListDiv.appendChild(noCultureDiv);
                }
            }
        });
    }

    showAddPlotModalBtn?.addEventListener('click', () => openModal(addPlotModal));
    closeAddPlotModalBtn?.addEventListener('click', () => closeModal(addPlotModal));
    addPlotBtn?.addEventListener('click', addPlotAndFirstCulture);

    loadPropertyDetails();
}
