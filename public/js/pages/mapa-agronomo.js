// js/pages/mapa-agronomo.js

import { db } from '../config/firebase.js';
import { showSpinner, hideSpinner, showToast, openModal, closeModal } from '../services/ui.js';
// IMPORTADO: GeoPoint e serverTimestamp para Firebase v9
import { collection, query, where, getDocs, doc, addDoc, updateDoc, GeoPoint, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

export function initMapaAgronomo(userId, userRole) {
    // Declaração de variáveis no topo para que sejam acessíveis por todas as funções
    const mapContainer = document.getElementById('agronomistClientsMap');
    // Verifica a existência do contêiner principal do mapa imediatamente
    if (!mapContainer) {
        console.error("ERRO CRÍTICO: Elemento #agronomistClientsMap não encontrado. O mapa não pode ser inicializado.");
        // Substitui o conteúdo da main se o contêiner do mapa não for encontrado
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.innerHTML = '<div class="text-center p-8 bg-red-100 text-red-800 rounded-lg shadow-md"><p class="font-bold">Erro!</p><p>Não foi possível encontrar o local para o mapa. Por favor, recarregue a página.</p></div>';
        }
        return;
    }

    let agronomistClientsLeafletMap = null;
    let agronomistClientsMapMarkers = null; 

    // Elementos de filtro e botões
    const filterClientMap = document.getElementById('filterClientMap');
    const filterStatusMap = document.getElementById('filterStatusMap');
    const locateMeBtn = document.getElementById('locateMeBtn');

    // Elementos do painel de visita
    const visitInProgressPanel = document.getElementById('visitInProgressPanel');
    const currentVisitClientName = document.getElementById('currentVisitClientName');
    const currentVisitPropertyName = document.getElementById('currentVisitPropertyName');
    const closeVisitPanelBtn = document.getElementById('closeVisitPanelBtn');
    const addObservationBtn = document.getElementById('addObservationBtn');
    const endVisitBtn = document.getElementById('endVisitBtn');

    // Elementos do modal de observação
    const addObservationModal = document.getElementById('addObservationModal');
    const observationText = document.getElementById('observationText');
    const observationImage = document.getElementById('observationImage');
    const closeObservationModalBtn = document.getElementById('closeObservationModalBtn');
    const saveObservationBtn = document.getElementById('saveObservationBtn');

    let allAgronomistClientsData = [];
    let allAgronomistPropertiesWithCoords = [];
    let currentVisitInProgress = null;

    // Função de inicialização principal que espera pelos elementos DOM e pela biblioteca L
    async function initializeMapaAgronomoPage() {
        // Verifica todos os elementos DOM necessários de uma vez
        const allElementsPresent = filterClientMap && filterStatusMap && locateMeBtn && mapContainer && visitInProgressPanel &&
                                 addObservationModal && observationText && observationImage &&
                                 closeObservationModalBtn && saveObservationBtn &&
                                 currentVisitClientName && currentVisitPropertyName &&
                                 closeVisitPanelBtn && addObservationBtn && endVisitBtn;

        if (!allElementsPresent) {
            console.warn("Elementos DOM do mapa agrônomo não totalmente carregados. Tentando novamente em 150ms...");
            setTimeout(initializeMapaAgronomoPage, 150); 
            return;
        }

        console.log("Todos os elementos DOM principais encontrados para o mapa agrônomo.");

        // Configura event listeners gerais APENAS UMA VEZ
        setupGeneralEventListeners(); 

        showSpinner(mapContainer);

        // Verifica se L está definido antes de inicializar o mapa.
        const checkLeafletAndInitialize = () => {
            if (typeof L !== 'undefined' && L.map) {
                console.log("Leaflet (L) está definido. Inicializando mapa Leaflet.");
                initializeAgronomistClientsMap();
                loadAgronomistClientsProperties(); // Agora carrega os dados e renderiza o mapa
                checkActiveVisit();
            } else {
                console.warn("Leaflet (L) ainda não está definido. Tentando novamente em 150ms...");
                setTimeout(checkLeafletAndInitialize, 150);
            }
        };

        // Inicia a verificação de disponibilidade do Leaflet
        checkLeafletAndInitialize();
    }


    async function loadAgronomistClientsProperties() {
        try {
            const clientsSnapshot = await getDocs(
                query(collection(db, 'clients'), where('agronomistId', '==', userId))
            );

            allAgronomistClientsData = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populateClientFilterDropdown(allAgronomistClientsData);

            if (clientsSnapshot.empty) {
                hideSpinner(mapContainer);
                mapContainer.innerHTML = '<p class="text-center text-gray-500 p-8">Você não possui clientes cadastrados.</p>';
                // Se não há clientes, remove o mapa se ele foi inicializado para evitar erros
                if (agronomistClientsLeafletMap) {
                    agronomistClientsLeafletMap.remove();
                    agronomistClientsLeafletMap = null;
                }
                return;
            }

            const clientIds = allAgronomistClientsData.map(client => client.id);
            const clientsMap = new Map(allAgronomistClientsData.map(client => [client.id, client]));

            allAgronomistPropertiesWithCoords = [];

            // A consulta Collection Group para 'properties' já é um índice composto, se não for, Firebase vai pedir
            const allPropertiesSnapshot = await getDocs(
                query(collection(db, 'properties'), where('coordenadas', '!=', null)) // Correção: Coleção 'properties' no nível superior
            );
            
            allPropertiesSnapshot.forEach(propDoc => {
                const clientIdOfProp = propDoc.data().clientId; // Assume que 'clientId' está no documento da propriedade
                const clientData = clientsMap.get(clientIdOfProp);

                // Garante que a propriedade pertence a um cliente do agrônomo logado
                if (clientData && clientData.agronomistId === userId) {
                    allAgronomistPropertiesWithCoords.push({
                        id: propDoc.id,
                        clientId: clientIdOfProp, 
                        clientName: clientData.name, 
                        clientIsFavorite: clientData.isFavorite || false, 
                        clientStatus: clientData.status || 'ativo', 
                        ...propDoc.data()
                    });
                }
            });

            hideSpinner(mapContainer);
            filterAndRenderProperties(); 

        } catch (error) {
            console.error("Erro ao carregar propriedades dos clientes do agrônomo:", error);
            hideSpinner(mapContainer);
            mapContainer.innerHTML = '<p class="text-center text-red-500 p-8">Ocorreu um erro ao carregar os dados do mapa dos seus clientes.</p>';
            if (agronomistClientsLeafletMap) {
                agronomistClientsLeafletMap.remove();
                agronomistClientsLeafletMap = null;
            }
            if (error.code === 'failed-precondition') {
                showToast("Um índice do Firestore é necessário para esta consulta de mapa. Verifique o console para o link de criação.", 'error', 10000);
            } else if (error.code === 'permission-denied') {
                showToast("Erro de permissão ao carregar dados dos clientes para o mapa. Verifique as regras de segurança.", 'error', 10000);
            }
        }
    }

    function populateClientFilterDropdown(clients) {
        if (filterClientMap) { 
            filterClientMap.innerHTML = '<option value="">Todos os Clientes</option>';
            clients.sort((a, b) => a.name.localeCompare(b.name)).forEach(client => {
                filterClientMap.innerHTML += `<option value="${client.id}">${client.name}</option>`;
            });
        } else {
            console.warn("Elemento filterClientMap não encontrado para popular dropdown.");
        }
    }

    function filterAndRenderProperties() {
        const selectedClientId = filterClientMap.value;
        const selectedStatus = filterStatusMap.value; // 'all' ou 'active'

        let filteredProperties = allAgronomistPropertiesWithCoords;

        if (selectedClientId) {
            filteredProperties = filteredProperties.filter(prop => prop.clientId === selectedClientId);
        }

        if (selectedStatus !== 'all') { 
            if (selectedStatus === 'active') {
                filteredProperties = filteredProperties.filter(prop => prop.clientStatus === 'ativo');
            }
        }

        if (filteredProperties.length === 0) {
            mapContainer.innerHTML = '<p class="text-center text-gray-500 p-8">Nenhuma propriedade encontrada com os filtros selecionados.</p>';
            if (agronomistClientsLeafletMap) {
                agronomistClientsMapMarkers.clearLayers(); 
                agronomistClientsLeafletMap.setView([-14.235, -51.925], 4);
                agronomistClientsLeafletMap.invalidateSize();
            }
            return;
        }

        initializeAgronomistClientsMap(); // Garante que o mapa está pronto
        updateAgronomistClientsMap(filteredProperties);
    }


    function initializeAgronomistClientsMap() {
        if (!mapContainer) return;
        // Verifica se o Leaflet (L) está disponível antes de prosseguir
        if (typeof L === 'undefined' || !L.map) {
            console.error("Leaflet (L) não está definido. Não é possível inicializar o mapa.");
            return;
        }

        // Verifica se o mapa já existe no contêiner
        // Se o mapa já está no contêiner e é uma instância de L.Map, apenas retorna.
        if (agronomistClientsLeafletMap instanceof L.Map && agronomistClientsLeafletMap._container && agronomistClientsLeafletMap._container.id === 'agronomistClientsMap') {
            return;
        }

        // Se existe uma instância antiga do mapa, remove-a para evitar duplicação ou erros.
        if (agronomistClientsLeafletMap) {
            agronomistClientsLeafletMap.remove();
        }
        
        mapContainer.textContent = ''; // Limpa o conteúdo (incluindo o spinner)
        mapContainer.classList.add('leaflet-container'); // Adiciona a classe necessária para o Leaflet

        // Inicializa o mapa Leaflet
        agronomistClientsLeafletMap = L.map('agronomistClientsMap').setView([-14.235, -51.925], 4); // Centro do Brasil
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(agronomistClientsLeafletMap);

        // Inicializa o cluster de marcadores apenas uma vez com o mapa
        agronomistClientsMapMarkers = L.markerClusterGroup(); 
        agronomistClientsMapMarkers.addTo(agronomistClientsLeafletMap); 

        agronomistClientsLeafletMap.invalidateSize(); // Garante que o mapa se renderiza corretamente
        
        setupMapSpecificEventListeners(); // Configura listeners específicos do mapa
        
        console.log("Mapa de clientes do agrônomo inicializado com sucesso.");
    }

    function updateAgronomistClientsMap(properties) {
        // Garante que o mapa e o cluster de marcadores estão inicializados
        if (!agronomistClientsLeafletMap || !agronomistClientsMapMarkers) {
             console.warn("Mapa de clientes do agrônomo ou cluster de marcadores não está pronto no update.");
             return;
         }

        agronomistClientsMapMarkers.clearLayers(); // Limpa os marcadores existentes

        const latLngs = [];
        properties.forEach(property => {
            const { latitude, longitude } = property.coordenadas;
            if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
                const marker = L.marker([latitude, longitude]);
                let popupContent = `<b>${property.name}</b><br>`;
                popupContent += `Cliente: ${property.clientName}<br>`;
                if (property.area && property.area > 0) {
                    popupContent += `Área: ${property.area} ha<br>`;
                }
                popupContent += `<button class="start-visit-btn mt-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm" 
                                    data-client-id="${property.clientId}" 
                                    data-property-id="${property.id}"
                                    data-property-name="${property.name}"
                                    data-client-name="${property.clientName}"
                                    data-lat="${latitude}"
                                    data-lng="${longitude}">
                                    <i class="fas fa-play-circle mr-1"></i> Iniciar Visita
                                </button>`;
                popupContent += `<a href="property-details.html?clientId=${property.clientId}&propertyId=${property.id}&from=agronomo" target="_blank" class="text-blue-600 hover:underline mt-1 block">Ver Detalhes da Propriedade</a>`;
                marker.bindPopup(popupContent);
                agronomistClientsMapMarkers.addLayer(marker); 
                latLngs.push([latitude, longitude]);
            }
        });

        if (latLngs.length > 0) {
            const bounds = L.latLngBounds(latLngs);
            agronomistClientsLeafletMap.fitBounds(bounds, { padding: [50, 50] });
        }
        agronomistClientsLeafletMap.invalidateSize();
        console.log("Mapa de clientes do agrônomo atualizado com marcadores.");
    }

    function locateUser() {
        if (!navigator.geolocation) {
            showToast('Geolocalização não é suportada por este navegador.', 'error');
            return;
        }
        locateMeBtn.disabled = true;
        showToast('Obtendo sua localização...', 'info');
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            if (agronomistClientsLeafletMap) {
                agronomistClientsLeafletMap.setView([latitude, longitude], 15);
                L.circleMarker([latitude, longitude], {
                    radius: 6,
                    color: '#3388ff',
                    fillColor: '#3388ff',
                    fillOpacity: 0.5
                }).addTo(agronomistClientsLeafletMap).bindPopup('Sua localização atual.').openPopup();
                showToast('Localização encontrada!', 'success');
            }
            locateMeBtn.disabled = false;
        }, (error) => {
            console.error("Erro ao obter localização:", error);
            showToast(`Não foi possível obter localização: ${error.message}.`, 'error');
            locateMeBtn.disabled = false;
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    }

    async function startVisit(clientId, propertyId, propertyName, clientName, lat, lng) {
        if (currentVisitInProgress) {
            showToast("Já existe uma visita em andamento. Finalize-a primeiro!", 'info');
            return;
        }

        const visitData = {
            agronomistId: userId,
            clientId: clientId,
            propertyId: propertyId,
            clientName: clientName,
            propertyName: propertyName,
            checkInTime: serverTimestamp(), // Uso corrigido de serverTimestamp
            checkInCoords: new GeoPoint(lat, lng), // Uso corrigido de GeoPoint
            status: 'in_progress'
        };

        try {
            const docRef = await addDoc(collection(db, 'visits'), visitData); // Uso corrigido de addDoc e collection
            currentVisitInProgress = { id: docRef.id, ...visitData };
            showToast(`Visita a ${propertyName} (${clientName}) iniciada!`, 'success');
            
            showVisitPanel();
            updateVisitPanelInfo();

            if (agronomistClientsLeafletMap) { 
                agronomistClientsLeafletMap.closePopup();
            }

            console.log("Visita iniciada:", currentVisitInProgress);
        } catch (error) {
            console.error("Erro ao iniciar visita:", error);
            showToast(`Erro ao iniciar visita: ${error.message}`, 'error');
            if (error.code === 'permission-denied') {
                showToast("Erro de permissão ao iniciar visita. Verifique as regras de segurança para a coleção 'visits'.", 'error', 10000);
            }
        }
    }

    async function endVisit() {
        if (!currentVisitInProgress) {
            showToast("Nenhuma visita em andamento para finalizar.", 'error');
            return;
        }
        
        endVisitBtn.disabled = true;
        showToast("Finalizando visita...", 'info');

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            const checkOutCoords = new GeoPoint(latitude, longitude); // Uso corrigido de GeoPoint
            const checkOutTime = serverTimestamp(); // Uso corrigido de serverTimestamp
            
            try {
                const visitRef = doc(collection(db, 'visits'), currentVisitInProgress.id); // Uso corrigido de doc e collection
                await updateDoc(visitRef, { // Uso corrigido de updateDoc
                    checkOutTime: checkOutTime,
                    checkOutCoords: checkOutCoords,
                    status: 'completed'
                });
                showToast(`Visita a ${currentVisitInProgress.propertyName} finalizada!`, 'success');
                currentVisitInProgress = null;
                hideVisitPanel();
            } catch (error) {
                console.error("Erro ao finalizar visita:", error);
                showToast(`Erro ao finalizar visita: ${error.message}`, 'error');
                if (error.code === 'permission-denied') {
                    showToast("Erro de permissão ao finalizar visita. Verifique as regras de segurança.", 'error', 10000);
                }
            } finally {
                endVisitBtn.disabled = false;
            }
        }, (error) => {
            console.error("Erro ao obter localização para check-out:", error);
            showToast(`Não foi possível obter localização para finalizar visita: ${error.message}.`, 'error');
            endVisitBtn.disabled = false;
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    }

    async function addObservation() {
        if (!currentVisitInProgress) {
            showToast("Nenhuma visita em andamento para registrar observação.", 'error');
            closeModal(addObservationModal);
            return;
        }

        const text = observationText.value.trim();
        const imageUrl = observationImage.value.trim();

        if (!text && !imageUrl) {
            showToast("Preencha a observação ou adicione um link de imagem.", 'error');
            return;
        }

        showToast("Registrando observação...", 'info');
        saveObservationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            const observationCoords = new GeoPoint(latitude, longitude); // Uso corrigido de GeoPoint

            const observationData = {
                text: text || null,
                imageUrl: imageUrl || null,
                coords: observationCoords,
                timestamp: serverTimestamp() // Uso corrigido de serverTimestamp
            };

            try {
                await addDoc(collection(db, `visits/${currentVisitInProgress.id}/observations`), observationData); // Uso corrigido de addDoc e collection
                showToast("Observação registrada com sucesso!", 'success');
                observationText.value = '';
                observationImage.value = '';
                closeModal(addObservationModal);
            } catch (error) {
                console.error("Erro ao registrar observação:", error);
                showToast(`Erro ao registrar observação: ${error.message}`, 'error');
                if (error.code === 'permission-denied') {
                    showToast("Erro de permissão ao registrar observação. Verifique as regras de segurança.", 'error', 10000);
                }
            } finally {
                saveObservationBtn.disabled = false;
            }
        }, (error) => {
            console.error("Erro ao obter localização para observação:", error);
            showToast(`Não foi possível obter localização para observação: ${error.message}.`, 'error');
            saveObservationBtn.disabled = false;
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    }

    function showVisitPanel() {
        if (visitInProgressPanel) {
            visitInProgressPanel.classList.remove('hidden');
        }
    }

    function hideVisitPanel() {
        if (visitInProgressPanel) {
            visitInProgressPanel.classList.add('hidden');
            currentVisitInProgress = null;
        }
    }

    function updateVisitPanelInfo() {
        if (currentVisitInProgress) {
            currentVisitClientName.textContent = currentVisitInProgress.clientName;
            currentVisitPropertyName.textContent = currentVisitInProgress.propertyName;
        }
    }

    async function checkActiveVisit() {
        try {
            const snapshot = await getDocs(
                query(collection(db, 'visits'), 
                    where('agronomistId', '==', userId), 
                    where('status', '==', 'in_progress'), 
                    limit(1)) // Importar 'limit'
            );

            if (!snapshot.empty) {
                currentVisitInProgress = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                showVisitPanel();
                updateVisitPanelInfo();
                showToast("Visita em andamento retomada!", 'info');
            }
        } catch (error) {
            console.error("Erro ao verificar visita ativa:", error);
        }
    }

    // Função para configurar event listeners que NÃO dependem do agronomistClientsLeafletMap, APENAS uma vez
    let generalEventListenersSetup = false;
    function setupGeneralEventListeners() {
        if (generalEventListenersSetup) return;

        // Verifica se os elementos existem antes de adicionar os listeners
        if (filterClientMap) filterClientMap.addEventListener('change', filterAndRenderProperties);
        if (filterStatusMap) filterStatusMap.addEventListener('change', filterAndRenderProperties);
        if (locateMeBtn) locateMeBtn.addEventListener('click', locateUser);
        if (closeVisitPanelBtn) closeVisitPanelBtn.addEventListener('click', () => hideVisitPanel());
        if (addObservationBtn) addObservationBtn.addEventListener('click', () => openModal(addObservationModal));
        if (endVisitBtn) endVisitBtn.addEventListener('click', endVisit);
        if (closeObservationModalBtn) closeObservationModalBtn.addEventListener('click', () => closeModal(addObservationModal));
        if (saveObservationBtn) saveObservationBtn.addEventListener('click', addObservation);
        
        generalEventListenersSetup = true;
    }
    
    // Função para configurar listeners ESPECÍFICOS DO MAPA (após agronomistClientsLeafletMap ser inicializado)
    let mapSpecificEventListenersSetup = false;
    function setupMapSpecificEventListeners() {
        if (mapSpecificEventListenersSetup) return;

        if (agronomistClientsLeafletMap) {
            agronomistClientsLeafletMap.on('popupopen', function(e) {
                const popup = e.popup;
                // Certifica-se de que o popup._contentNode existe antes de tentar selecionar
                if (popup && popup._contentNode) {
                    const startVisitButton = popup._contentNode.querySelector('.start-visit-btn');
                    if (startVisitButton) {
                        startVisitButton.onclick = () => {
                            const { clientId, propertyId, propertyName, clientName, lat, lng } = startVisitButton.dataset;
                            startVisit(clientId, propertyId, propertyName, clientName, parseFloat(lat), parseFloat(lng));
                        };
                    }
                }
            });
        }
        mapSpecificEventListenersSetup = true;
    }

    // Chamada de inicialização ao carregar o módulo
    initializeMapaAgronomoPage();

}