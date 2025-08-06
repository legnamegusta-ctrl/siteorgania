// js/pages/property-details.js

// IMPORTADO: 'db' (instância do Firestore v9) de firebase.js
import { db } from '../config/firebase.js';
// Importa as funções Firestore necessárias da API modular do v9
import { collection, query, where, orderBy, getDocs, doc, updateDoc, addDoc, serverTimestamp, onSnapshot, GeoPoint, deleteField, writeBatch, increment, getDoc, limit } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
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

    // Botão de adicionar talhão
    const showAddPlotModalBtn = document.getElementById('showAddPlotModalBtn');

    const addPlotModal = document.getElementById('addPlotModal');
    const closeAddPlotModalBtn = document.getElementById('closeAddPlotModalBtn');
    const addPlotBtn = document.getElementById('addPlotBtn');
    const newPlotNameInput = document.getElementById('newPlotName');
    const newPlotAreaInput = document.getElementById('newPlotArea');
    const newPlotPlantsInput = document.getElementById('newPlotPlants'); // NOVO
    const newCultureNameInput = document.getElementById('newCultureName');
    const newCultureStartDateInput = document.getElementById('newCultureStartDate');

    const propertyMapDiv = document.getElementById('propertyMap');
    let propertyLeafletMap = null;
    let propertyMapMarker = null;

    const visitsHistoryList = document.getElementById('visitsHistoryList');

    const viewVisitDetailsModal = document.getElementById('viewVisitDetailsModal');
    const visitDetailsContent = document.getElementById('visitDetailsContent');
    const closeViewVisitDetailsModalBtn = document.getElementById('closeViewVisitDetailsModalBtn');

    // Elementos da Navbar Inferior
    const navHomeBtn = document.getElementById('navHomeBtnPropertyDetails');
    const navClientsBtn = document.getElementById('navClientsBtnPropertyDetails');
    const navVisitBtn = document.getElementById('navVisitBtnPropertyDetails');
    const navAgendaBtn = document.getElementById('navAgendaBtnPropertyDetails');
    const navProfileBtn = document.getElementById('navProfileBtnPropertyDetails');

    let clientDataCache = {};
    let allPlotsData = []; // Para armazenar todos os talhões e suas coordenadas para o mapa

    if (!currentPropertyId || !currentClientId) {
        if(propertyNameHeader) propertyNameHeader.textContent = "ID da Propriedade ou do Cliente não encontrado.";
        return;
    };

    const propertyDocRef = doc(collection(db, `clients/${currentClientId}/properties`), currentPropertyId);
    const clientDocRef = doc(db, 'clients', currentClientId);

    async function addPlotAndFirstCulture() {
        const plotName = newPlotNameInput.value.trim();
        const plotArea = parseFloat(newPlotAreaInput.value) || 0;
        const plotPlants = parseInt(newPlotPlantsInput.value) || 0; // NOVO: Quantidade de plantas
        const cultureName = newCultureNameInput.value.trim();
        const cultureStartDate = newCultureStartDateInput.value;

        if (!plotName || !cultureName || !cultureStartDate) {
            showToast('Por favor, preencha o nome do talhão, o nome da cultura e a data de início.', 'error');
            return;
        }
        if (isNaN(plotArea) || plotArea <= 0) {
            showToast('A área do talhão deve ser um número válido e maior que zero.', 'error');
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
                plantsCount: plotPlants, // NOVO: Salva quantidade de plantas
                status: 'ativo', 
                createdAt: serverTimestamp() 
            });
            batch.set(cultureRef, { 
                cropName: cultureName, 
                startDate: new Date(cultureStartDate), 
                status: 'ativo', 
                createdAt: serverTimestamp() 
            });
            batch.update(clientDocRef, { cultureCount: increment(1) });
            // Incrementa o contador de talhões da propriedade se você mantiver isso no cliente
            batch.update(propertyDocRef, { plotCount: increment(1) }); // Adicionar um campo 'plotCount' no documento da propriedade

            await batch.commit();

            newPlotNameInput.value = ''; 
            newPlotAreaInput.value = '';
            newPlotPlantsInput.value = ''; // NOVO: Limpa campo de plantas
            newCultureNameInput.value = ''; 
            newCultureStartDateInput.value = '';
            closeModal(addPlotModal);
            showToast("Talhão e cultura adicionados com sucesso!", "success");

        } catch (error) {
            console.error("Erro ao adicionar talhão e cultura:", error);
            showToast("Ocorreu um erro ao salvar os dados.", "error");
        }
    }

    async function loadPropertyDetails() {
        // Redirecionamento do botão de voltar depende do role de quem veio para cá (agronomo/admin ou cliente)
        if (userRole === 'cliente') {
            backBtn.href = 'dashboard-cliente.html'; // Cliente volta para seu próprio dashboard
        } else {
            backBtn.href = `client-details.html?clientId=${currentClientId}&from=${from}`;
        }
        
        // Controlar visibilidade de botões de edição/adição
        if (userRole === 'cliente') {
            if (showAddPlotModalBtn) showAddPlotModalBtn.style.display = 'none';
            // Os inputs do modal de adicionar talhão também devem ser somente leitura ou ocultos se o modal for visível por outro caminho.
            // Para simplicidade, o modal inteiro de addPlotModal é controlado pela visibilidade do botão showAddPlotModalBtn
        } else { // Agronomo, Operador, Admin
            if (showAddPlotModalBtn) showAddPlotModalBtn.style.display = 'inline-block'; // Garante que o botão esteja visível para edição
        }

        try {
            const propPromise = getDoc(propertyDocRef);
            const clientPromise = getDoc(clientDocRef);

            const [propDoc, clientDoc] = await Promise.all([propPromise, clientPromise]);

            if (propDoc.exists()) {
                const propertyData = propDoc.data();
                if (propertyNameHeader) propertyNameHeader.textContent = propertyData.name;
                // Inicializa o mapa com a localização da propriedade, se houver
                initializePropertyMap(propertyData); 
            } else {
                if (propertyNameHeader) propertyNameHeader.textContent = "Propriedade não encontrada";
            }
            if (clientDoc.exists()) {
                clientDataCache = clientDoc.data();
                if (clientNameDisplay) clientNameDisplay.textContent = `Cliente: ${clientDataCache.name}`;
            } else {
                if (clientNameDisplay) clientNameDisplay.textContent = "Cliente não encontrado";
            }
        } catch (error) {
            console.error("Erro ao carregar detalhes:", error);
            if (propertyNameHeader) propertyNameHeader.textContent = "Erro ao carregar detalhes";
        }

        setupCulturesListener();
        loadVisitsHistory();
        setupNavbarListeners();
    }

    function setupCulturesListener() {
        if (!plotsListDiv) return;
        showSpinner(plotsListDiv);
        const plotsCollectionRef = collection(db, `clients/${currentClientId}/properties/${currentPropertyId}/plots`);
        const plotsQuery = query(plotsCollectionRef, where('status', '==', 'ativo'));

        onSnapshot(plotsQuery, async (plotsSnapshot) => {
            hideSpinner(plotsListDiv);
            plotsListDiv.innerHTML = '';
            let cultures = [];
            allPlotsData = []; // Limpa e preenche com os novos dados para o mapa de talhões

            for (const plotDocSnap of plotsSnapshot.docs) {
                const plotData = plotDocSnap.data();
                const plotId = plotDocSnap.id;

                allPlotsData.push({ // Armazena dados do talhão para o mapa
                    id: plotId,
                    name: plotData.name,
                    area: plotData.area,
                    plantsCount: plotData.plantsCount, // NOVO: Quantidade de plantas
                    coordenadas: plotData.coordenadas, // Se o talhão tiver coordenadas próprias
                    plotRef: plotDocSnap.ref // Referência completa para o documento do talhão
                });

                const culturasQuery = query(collection(db, `${plotDocSnap.ref.path}/culturas`), where('status', '==', 'ativo'), orderBy('startDate', 'desc'), limit(1)); // Limita a 1 cultura ativa
                const culturasSnapshot = await getDocs(culturasQuery);
                
                if (!culturasSnapshot.empty) {
                    const culturaDocSnap = culturasSnapshot.docs[0]; // Pega a cultura mais recente/ativa
                    cultures.push({ 
                        plotId: plotId, 
                        plotName: plotData.name, 
                        cultureId: culturaDocSnap.id, 
                        cultureData: culturaDocSnap.data(),
                        plantsCount: plotData.plantsCount || 'N/A' // NOVO: Passa a contagem de plantas do talhão
                    });
                } else {
                    // Se não houver cultura ativa, ainda mostra o talhão
                    cultures.push({
                        plotId: plotId,
                        plotName: plotData.name,
                        cultureId: null,
                        cultureData: { cropName: 'Nenhuma Cultura Ativa', startDate: null },
                        plantsCount: plotData.plantsCount || 'N/A' // NOVO: Passa a contagem de plantas do talhão
                    });
                }
            }

            if (cultures.length === 0) {
                plotsListDiv.innerHTML = '<p class="text-gray-500 text-center p-4">Nenhum talhão ativo encontrado nesta propriedade.</p>';
                // Se não há talhões, o mapa deve ser redefinido para a propriedade
                initializePropertyMap(propDocRef ? (await getDoc(propDocRef)).data() : null); 
                return;
            }

            // Ordena os talhões pelo nome para a lista
            cultures.sort((a,b) => a.plotName.localeCompare(b.plotName));

            plotsListDiv.innerHTML = ''; // Limpa antes de renderizar
            cultures.forEach(c => {
                const destinationUrl = `plot-details.html?clientId=${currentClientId}&propertyId=${currentPropertyId}&plotId=${c.plotId}&cultureId=${c.cultureId}&from=${from}`;
                const startDate = c.cultureData.startDate && c.cultureData.startDate.toDate ? c.cultureData.startDate.toDate().toLocaleDateString('pt-BR') : 'N/A';
                const plantsInfo = c.plantsCount !== 'N/A' ? `<p class="text-xs text-gray-500">Plantas: ${c.plantsCount}</p>` : ''; // NOVO

                plotsListDiv.innerHTML += `
                    <div class="plot-card-item bg-white p-4 rounded-lg flex justify-between items-center border-b last:border-0 hover:bg-gray-50 cursor-pointer" onclick="window.location.href='${destinationUrl}'">
                        <div>
                            <span class="font-bold text-lg text-gray-800">${c.plotName}</span>
                            <p class="text-sm" style="color:var(--brand-green);">${c.cultureData.cropName}</p>
                            <p class="text-xs text-gray-500">Início: ${startDate}</p>
                            ${plantsInfo}
                        </div>
                        <i class="fas fa-chevron-right text-gray-400"></i>
                    </div>`;
            });

            // Após carregar os talhões, atualiza o mapa com seus marcadores
            updateMapWithPlots();

        }, error => {
            console.error("Erro ao carregar culturas/talhões:", error);
            hideSpinner(plotsListDiv);
            plotsListDiv.innerHTML = '<p class="text-red-500 text-center p-4">Erro ao carregar talhões ativos.</p>';
        });
    }

    function initializePropertyMap(propertyData) {
        if (!propertyMapDiv) {
            console.warn("Elemento #propertyMap não encontrado. O mapa da propriedade não será inicializado.");
            return;
        }

        // Se o mapa já existe e está vinculado ao #propertyMap, invalida o tamanho e retorna.
        if (propertyLeafletMap instanceof L.Map && propertyLeafletMap._container && propertyLeafletMap._container.id === 'propertyMap') {
            propertyLeafletMap.invalidateSize();
            return;
        }

        // Se existe uma instância antiga do mapa, remove-a para evitar duplicação ou erros.
        if (propertyLeafletMap) {
            propertyLeafletMap.remove();
        }
        
        propertyMapDiv.textContent = '';
        propertyMapDiv.classList.add('leaflet-container');

        // Inicializa o mapa Leaflet
        propertyLeafletMap = L.map('propertyMap').setView([-14.235, -51.925], 4); // Centro do Brasil
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(propertyLeafletMap);

        // Adiciona um marcador para a propriedade se ela tiver coordenadas
        if (propertyData && propertyData.coordenadas && propertyData.coordenadas.latitude !== undefined && propertyData.coordenadas.longitude !== undefined) {
            const { latitude, longitude } = propertyData.coordenadas;
            propertyMapMarker = L.marker([latitude, longitude]).addTo(propertyLeafletMap);
            propertyMapMarker.bindPopup(`<b>${propertyData.name}</b>`).openPopup();
            propertyLeafletMap.setView([latitude, longitude], 15);
        } else {
            propertyMapDiv.innerHTML = '<p class="text-center text-gray-500 p-4">Nenhuma localização definida para esta propriedade.</p>';
            propertyLeafletMap.setView([-14.235, -51.925], 4);
        }

        propertyLeafletMap.invalidateSize();
        console.log("Mapa da propriedade inicializado.");
    }

    // NOVO: Função para atualizar o mapa com marcadores dos talhões
    function updateMapWithPlots() {
        if (!propertyLeafletMap) {
            console.warn("Mapa da propriedade não inicializado, não é possível adicionar marcadores de talhões.");
            return;
        }

        // Remove marcadores de talhões existentes (se houver)
        propertyLeafletMap.eachLayer(layer => {
            if (layer instanceof L.Marker && layer !== propertyMapMarker) { // Não remove o marcador da propriedade
                propertyLeafletMap.removeLayer(layer);
            }
        });

        const plotLatLngs = [];

        allPlotsData.forEach(plot => {
            if (plot.coordenadas && plot.coordenadas.latitude !== undefined && plot.coordenadas.longitude !== undefined) {
                const { latitude, longitude } = plot.coordenadas;
                const plotMarker = L.marker([latitude, longitude]);
                
                // Conteúdo do popup do talhão
                let popupContent = `<b>${plot.name}</b><br>`;
                if (plot.area) popupContent += `Área: ${plot.area} ha<br>`;
                if (plot.plantsCount) popupContent += `Plantas: ${plot.plantsCount}<br>`;
                
                popupContent += `<a href="plot-details.html?clientId=${currentClientId}&propertyId=${currentPropertyId}&plotId=${plot.id}&from=${from}" class="text-blue-600 hover:underline mt-1 block">Ver Detalhes do Talhão</a>`;
                
                plotMarker.bindPopup(popupContent);
                propertyLeafletMap.addLayer(plotMarker);
                plotLatLngs.push([latitude, longitude]);
            }
        });

        // Ajusta o zoom do mapa para incluir todos os marcadores de talhões e da propriedade
        if (propertyMapMarker && plotLatLngs.length > 0) {
            const allCoords = [[propertyMapMarker.getLatLng().lat, propertyMapMarker.getLatLng().lng], ...plotLatLngs];
            const bounds = L.latLngBounds(allCoords);
            propertyLeafletMap.fitBounds(bounds, { padding: [50, 50] });
        } else if (plotLatLngs.length > 0) {
            const bounds = L.latLngBounds(plotLatLngs);
            propertyLeafletMap.fitBounds(bounds, { padding: [50, 50] });
        } else if (propertyMapMarker) {
            propertyLeafletMap.setView(propertyMapMarker.getLatLng(), 15);
        }
        
        propertyLeafletMap.invalidateSize();
    }


    async function loadVisitsHistory() {
        if (!visitsHistoryList) return;
        showSpinner(visitsHistoryList);

        try {
            const visitsCollectionRef = collection(db, 'visits');
            let visitsQuery = query(
                            visitsCollectionRef,
                            where('propertyId', '==', currentPropertyId),
                            orderBy('checkInTime', 'desc')
                        );

            const visitsSnapshot = await getDocs(visitsQuery);

            hideSpinner(visitsHistoryList);
            visitsHistoryList.innerHTML = '';

            if (visitsSnapshot.empty) {
                visitsHistoryList.innerHTML = '<p class="text-gray-500 text-center">Nenhuma visita registrada para esta propriedade.</p>';
                return;
            }

            for (const visitDocSnap of visitsSnapshot.docs) {
                const visit = { id: visitDocSnap.id, ...visitDocSnap.data() };
                const checkInDate = visit.checkInTime ? visit.checkInTime.toDate().toLocaleDateString('pt-BR') : 'N/A';
                const checkInTime = visit.checkInTime ? visit.checkInTime.toDate().toLocaleTimeString('pt-BR') : 'N/A';
                const checkOutTime = visit.checkOutTime ? visit.checkOutTime.toDate().toLocaleTimeString('pt-BR') : 'Em Andamento';
                const duration = visit.checkInTime && visit.checkOutTime ? calculateDuration(visit.checkInTime.toDate(), visit.checkOutTime.toDate()) : 'Em Andamento';
                
                // Buscar nome do agrônomo responsável pela visita
                let agronomistName = 'Desconhecido';
                if (visit.agronomistId) {
                    const agronomoDoc = await getDoc(doc(collection(db, 'users'), visit.agronomistId));
                    if (agronomoDoc.exists()) {
                        agronomistName = agronomoDoc.data().name || `Agrônomo ${visit.agronomistId.substring(0, 5)}`;
                    }
                }

                let observationsHtml = '';
                // Limita a 2 observações para a visualização inicial
                const obsQuery = query(collection(visitDocSnap.ref, 'observations'), orderBy('timestamp', 'desc'), limit(2)); 
                const obsSnapshot = await getDocs(obsQuery);
                if (!obsSnapshot.empty) {
                    observationsHtml += '<ul class="list-disc list-inside text-sm text-gray-600 mt-2">';
                    obsSnapshot.forEach(obsDocSnap => {
                        const obs = obsDocSnap.data();
                        const obsTime = obs.timestamp ? obs.timestamp.toDate().toLocaleTimeString('pt-BR') : '';
                        let obsContent = obs.text || 'Sem descrição';
                        if (obs.imageUrl) {
                            obsContent += `<br><a href="${obs.imageUrl}" target="_blank" class="text-blue-500 hover:underline">Ver Foto</a>`;
                        }
                        observationsHtml += `<li>${obsTime}: ${obsContent}</li>`;
                    });
                    if (obsSnapshot.size > 2) { // Adiciona indicação se houver mais observações
                         observationsHtml += `<li>... e mais ${obsSnapshot.size - 2} observação(ões).</li>`;
                    }
                    observationsHtml += '</ul>';
                } else {
                    observationsHtml = '<p class="text-sm text-gray-500 mt-2 italic">Nenhuma observação registrada.</p>';
                }

                visitsHistoryList.innerHTML += `
                    <div class="bg-gray-50 p-4 rounded-lg shadow-sm">
                        <div class="flex justify-between items-center mb-2">
                            <p class="font-bold text-gray-800">Visita em ${checkInDate}</p>
                            <span class="px-2 py-1 text-xs font-semibold rounded-full ${visit.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                                ${visit.status === 'completed' ? 'Finalizada' : 'Em Andamento'}
                            </span>
                        </div>
                        <p class="text-sm text-gray-700">Agrônomo: ${agronomistName}</p>
                        <p class="text-sm text-gray-700">Check-in: ${checkInTime}</p>
                        <p class="text-sm text-gray-700">Check-out: ${checkOutTime}</p>
                        <p class="text-sm text-gray-700">Duração: ${duration}</p>
                        ${observationsHtml}
                        <button class="view-visit-details-btn mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm" data-visit-id="${visit.id}">Ver Detalhes</button>
                    </div>
                `;
            }

            document.querySelectorAll('.view-visit-details-btn').forEach(button => {
                button.addEventListener('click', (e) => openViewVisitDetailsModal(e.target.dataset.visitId));
            });

        } catch (error) {
            console.error("Erro ao carregar histórico de visitas:", error);
            hideSpinner(visitsHistoryList);
            visitsHistoryList.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar histórico de visitas.</p>';
             if (error.code === 'permission-denied') {
                showToast("Erro de permissão ao carregar visitas. Verifique as regras de segurança para a coleção 'visits'.", 'error', 10000);
            }
        }
    }

    function calculateDuration(start, end) {
        const diffMs = end - start;
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        if (diffMinutes < 60) {
            return `${diffMinutes} min`;
        } else {
            const hours = Math.floor(diffMinutes / 60);
            const minutes = diffMinutes % 60;
            return `${hours}h ${minutes}min`;
        }
    }

    async function openViewVisitDetailsModal(visitId) {
        if (!viewVisitDetailsModal || !visitDetailsContent) return;
        try {
            const visitDocRef = doc(db, 'visits', visitId);
            const visitDoc = await getDoc(visitDocRef);
            if (!visitDoc.exists()) {
                showToast("Detalhes da visita não encontrados.", 'error');
                return;
            }
            const visit = { id: visitDoc.id, ...visitDoc.data() };

            const checkInDate = visit.checkInTime ? visit.checkInTime.toDate().toLocaleDateString('pt-BR') : 'N/A';
            const checkInTime = visit.checkInTime ? visit.checkInTime.toDate().toLocaleTimeString('pt-BR') : 'N/A';
            const checkOutTime = visit.checkOutTime ? visit.checkOutTime.toDate().toLocaleTimeString('pt-BR') : 'Em Andamento';
            const duration = visit.checkInTime && visit.checkOutTime ? calculateDuration(visit.checkInTime.toDate(), visit.checkOutTime.toDate()) : 'Em Andamento';

            // Buscar nome do agrônomo responsável pela visita
            let agronomistName = 'Desconhecido';
            if (visit.agronomistId) {
                const agronomoDoc = await getDoc(doc(collection(db, 'users'), visit.agronomistId));
                if (agronomoDoc.exists()) {
                    agronomistName = agronomoDoc.data().name || `Agrônomo ${visit.agronomistId.substring(0, 5)}`;
                }
            }

            let obsContentHtml = '';
            const obsQuery = query(collection(visitDocRef, 'observations'), orderBy('timestamp', 'asc'));
            const obsSnapshot = await getDocs(obsQuery);
            if (!obsSnapshot.empty) {
                obsSnapshot.forEach(obsDocSnap => {
                    const obs = obsDocSnap.data();
                    const obsDate = obs.timestamp ? obs.timestamp.toDate().toLocaleDateString('pt-BR') : '';
                    const obsTime = obs.timestamp ? obs.timestamp.toDate().toLocaleTimeString('pt-BR') : '';
                    let obsText = obs.text || 'Sem descrição';
                    let obsImageHtml = obs.imageUrl ? `<img src="${obs.imageUrl}" alt="Observação" class="w-full h-auto rounded-md mt-2">` : '';

                    obsContentHtml += `
                        <div class="border-b pb-3 mb-3 last:border-b-0 last:pb-0 last:mb-0">
                            <p class="text-sm text-gray-600 font-semibold mb-1">Registro em ${obsDate} às ${obsTime}</p>
                            <p class="text-gray-800 text-sm">${obsText}</p>
                            ${obsImageHtml}
                        </div>
                    `;
                });
            } else {
                obsContentHtml = '<p class="text-gray-500 italic text-sm">Nenhuma observação detalhada registrada.</p>';
            }

            visitDetailsContent.innerHTML = `
                <p class="text-gray-700"><strong>Cliente:</strong> ${visit.clientName}</p>
                <p class="text-700"><strong>Propriedade:</strong> ${visit.propertyName}</p>
                <p class="text-gray-700"><strong>Agrônomo:</strong> ${agronomistName}</p>
                <p class="text-gray-700"><strong>Status:</strong> ${visit.status === 'completed' ? 'Finalizada' : 'Em Andamento'}</p>
                <p class="text-gray-700"><strong>Check-in:</strong> ${checkInDate} às ${checkInTime}</p>
                <p class="text-gray-700"><strong>Check-out:</strong> ${checkOutTime}</p>
                <p class="text-gray-700"><strong>Duração:</strong> ${duration}</p>
                <h4 class="font-bold text-gray-800 mt-4 mb-2 border-b pb-1">Observações</h4>
                ${obsContentHtml}
            `;
            openModal(viewVisitDetailsModal);

        } catch (error) {
            console.error("Erro ao carregar detalhes da visita:", error);
            showToast(`Erro ao carregar detalhes da visita: ${error.message}`, 'error');
        }
    }


    if (showAddPlotModalBtn) showAddPlotModalBtn.addEventListener('click', () => openModal(addPlotModal));
    if (closeAddPlotModalBtn) closeAddPlotModalBtn.addEventListener('click', () => closeModal(addPlotModal));
    if (addPlotBtn) addPlotBtn.addEventListener('click', addPlotAndFirstCulture);

    if (closeViewVisitDetailsModalBtn) closeViewVisitDetailsModalBtn.addEventListener('click', () => closeModal(viewVisitDetailsModal));

    function setupNavbarListeners() {
        // Redireciona "Home" para o dashboard apropriado, mantendo a navbar consistente
        if (navHomeBtn) {
            navHomeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = `dashboard-${userRole}.html`;
            });
        }
        if (navClientsBtn) {
            navClientsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Apenas Agrônomo e Admin tem "Clientes"
                if (userRole === 'agronomo' || userRole === 'admin') {
                    window.location.href = `client-list.html`;
                } else {
                    showToast("Funcionalidade não disponível para seu perfil.", "info");
                }
            });
        }
        if (navVisitBtn) {
            navVisitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Apenas Agrônomo e Admin tem "Visita"
                if (userRole === 'agronomo' || userRole === 'admin') {
                    window.location.href = `mapa-agronomo.html`;
                } else {
                    showToast("Funcionalidade não disponível para seu perfil.", "info");
                }
            });
        }
        if (navAgendaBtn) {
            navAgendaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Apenas Agrônomo tem "Agenda" dedicada
                if (userRole === 'agronomo') {
                    window.location.href = `agenda.html`;
                } else {
                    showToast("Funcionalidade não disponível para seu perfil.", "info");
                }
            });
        }
        if (navProfileBtn) {
            navProfileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showToast("A seção de Perfil será implementada em breve.", "info");
            });
        }
    }

    loadPropertyDetails();
}