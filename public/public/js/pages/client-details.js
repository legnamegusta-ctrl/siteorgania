// js/pages/client-details.js

// IMPORTADO: 'db' (instância do Firestore v9) de firebase.js
import { db } from '../config/firebase.js';
// Importa as funções Firestore necessárias da API modular do v9
import { collection, query, where, orderBy, getDocs, doc, updateDoc, addDoc, serverTimestamp, onSnapshot, GeoPoint, deleteField, writeBatch, increment, getDoc, limit } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { showToast, showSpinner, hideSpinner, openModal, closeModal } from '../services/ui.js';

export function initClientDetails(userId, userRole) {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    const from = params.get('from') || 'agronomo';

    // --- Elementos da Página ---
    const clientNameHeader = document.getElementById('clientNameHeader');
    const backBtn = document.getElementById('backBtn');
    const summaryCards = document.getElementById('summaryCards');
    const propertiesListDiv = document.getElementById('propertiesList');
    const clientTasksList = document.getElementById('clientTasksList');
    const salesHistoryList = document.getElementById('salesHistoryList');

    // --- Botões de Ação ---
    const showSaleModalBtn = document.getElementById('showSaleModalBtn');
    const showAddPropertyModalBtn = document.getElementById('showAddPropertyModalBtn');
    const showAddTaskModalBtn = document.getElementById('showAddTaskModalBtn');

    // --- Modais ---
    const addPropertyModal = document.getElementById('addPropertyModal');
    const closeAddPropertyModalBtn = addPropertyModal.querySelector('#closeAddPropertyModalBtn');
    const savePropertyBtn = addPropertyModal.querySelector('#addPropertyBtn');
    const newPropertyNameInput = addPropertyModal.querySelector('#newPropertyName');

    const addTaskModal = document.getElementById('addTaskModal');
    const closeAddTaskModalBtn = addTaskModal.querySelector('#closeAddTaskModalBtn');
    const addClientTaskBtn = addTaskModal.querySelector('#addClientTaskBtn');
    const modalTaskTitle = addTaskModal.querySelector('#modalTaskTitle');
    const modalTaskDescription = addTaskModal.querySelector('#modalTaskDescription');
    const modalTaskDate = addTaskModal.querySelector('#modalTaskDate');
    const modalTaskProperty = addTaskModal.querySelector('#modalTaskProperty');
    const modalTaskPlot = document.getElementById('modalTaskPlot'); // Obtido diretamente do DOM

    const saleModal = document.getElementById('saleModal');
    const closeSaleModalBtn = saleModal.querySelector('#closeSaleModalBtn');
    const addSaleItemBtn = saleModal.querySelector('#addSaleItemBtn');
    const saveSaleBtn = saleModal.querySelector('#saveSaleBtn');
    const saleItemsContainer = saleModal.querySelector('#saleItemsContainer');

    const mapModal = document.getElementById('mapModal');
    const openMapModalBtn = document.getElementById('openMapModalBtn');
    const closeMapModalBtn = document.getElementById('closeMapModalBtn');
    const cancelMapSelectionBtn = document.getElementById('cancelMapSelectionBtn');
    const confirmMapSelectionBtn = document.getElementById('confirmMapSelectionBtn');
    const getUserLocationBtn = document.getElementById('getUserLocationBtn');
    const coordinatesDisplay = document.getElementById('coordinatesDisplay');
    const removeLocationBtn = document.getElementById('removeLocationBtn');

    // NOVO: Elementos da Bottom Navigation Bar (desta página)
    const navHomeBtn = document.getElementById('navHomeBtnClientDetails');
    const navClientsBtn = document.getElementById('navClientsBtnClientDetails');
    const navVisitBtn = document.getElementById('navVisitBtnClientDetails');
    const navAgendaBtn = document.getElementById('navAgendaBtnClientDetails');
    const navProfileBtn = document.getElementById('navProfileBtnClientDetails');

    // --- Variáveis de Estado ---
    let clientProperties = [];
    let clientDataCache = {};
    let fertilizerFormulas = [];
    let loggedInUserData = {};
    let map = null;
    let marker = null;
    let tempCoordinates = null;
    let currentEditingPropertyId = null;

    if (!clientId) {
        if(clientNameHeader) clientNameHeader.textContent = "Cliente não encontrado";
        return;
    }

    // CORRIGIDO: Agora usa a instância 'db' diretamente para criar a referência
    const clientDocRef = doc(db, 'clients', clientId); // 'db' já é a instância v9 do Firestore

    async function initializePage() {
        const backUrl = from === 'admin' ? 'dashboard-admin.html' : 'dashboard-agronomo.html';
        if (backBtn) backBtn.href = backUrl;
        if(showSaleModalBtn) showSaleModalBtn.disabled = true;

        // Adicionando Leaflet CSS e JS aqui, pois client-details.html também o utiliza.
        // No entanto, é melhor adicionar esses links diretamente no <head> do client-details.html
        // para garantir que estejam disponíveis antes que o JavaScript tente inicializar o mapa.
        // Se já fez essa correção no HTML, pode ignorar esta parte.
        if (typeof L === 'undefined') {
            const leafletCss = document.createElement('link');
            leafletCss.rel = 'stylesheet';
            leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            leafletCss.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            leafletCss.crossOrigin = '';
            document.head.appendChild(leafletCss);

            const leafletJs = document.createElement('script');
            leafletJs.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            leafletJs.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
            leafletJs.crossOrigin = '';
            document.head.appendChild(leafletJs);

            await new Promise(resolve => leafletJs.onload = resolve); // Espera o Leaflet carregar
        }

        await Promise.all([ loadFertilizerFormulas(), loadLoggedInUserData() ]);

        loadClientData();
        loadProperties();
        loadClientTasks(); // <--- CHAMA AQUI
        loadSalesHistory();
        addEventListeners();
    }

    async function loadLoggedInUserData() {
        try {
            // CORREÇÃO: Usando collection() e doc() para v9
            const userDocRef = doc(collection(db, 'users'), userId);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                loggedInUserData = { id: userDoc.id, ...userDoc.data() };
            } else { throw new Error("Documento do usuário logado não encontrado."); }
        } catch (error) {
            console.error("Erro fatal ao carregar dados do usuário:", error);
            showToast(`Erro crítico: ${error.message}. Ações podem ser limitadas.`, "error");
        }
    }

    function loadClientData() {
        // A sintaxe do onSnapshot para um único documento (docRef) está correta para v9
        onSnapshot(clientDocRef, docSnap => {
            if (docSnap.exists()) {
                clientDataCache = { id: docSnap.id, ...docSnap.data() };
                if (clientNameHeader) clientNameHeader.textContent = clientDataCache.name;
                renderSummaryCards(clientDataCache);
                if(showSaleModalBtn) showSaleModalBtn.disabled = false;
            } else { if (clientNameHeader) clientNameHeader.textContent = "Cliente não encontrado"; }
        }, error => {
            console.error("Erro ao carregar dados do cliente:", error);
            if (clientNameHeader) clientNameHeader.textContent = "Erro ao carregar";
        });
    }

    async function loadFertilizerFormulas() {
        try {
            const formulasQuery = query(collection(db, 'fertilizer_formulas'), orderBy('order')); // USANDO 'db' DIRETAMENTE
            const snapshot = await getDocs(formulasQuery);
            fertilizerFormulas = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        } catch (error) {
            console.error("Erro ao carregar formulações:", error);
            showToast("Erro ao carregar as formulações de fertilizantes.", 'error');
        }
    }

    function loadProperties() {
        if (!propertiesListDiv) return;
        showSpinner(propertiesListDiv);
        const propertiesQuery = query(collection(clientDocRef, 'properties'), where('status', '==', 'ativo'));
        onSnapshot(propertiesQuery, snapshot => {
            hideSpinner(propertiesListDiv);
            propertiesListDiv.innerHTML = '';
            if(snapshot.empty) {
                propertiesListDiv.innerHTML = '<p class="text-gray-500 text-center p-4">Nenhuma propriedade cadastrada.</p>';
                clientProperties = [];
                populatePropertyDropdown();
                return;
            }
            const sortedDocs = snapshot.docs.sort((a, b) => a.data().name.localeCompare(b.data().name));
            clientProperties = sortedDocs.map(docSnap => ({ id: docSnap.id, name: docSnap.data().name }));
            populatePropertyDropdown();
            sortedDocs.forEach(docSnap => {
                const property = { id: docSnap.id, ...docSnap.data() };
                const destinationUrl = `property-details.html?clientId=${clientId}&propertyId=${property.id}&from=${from}`;
                propertiesListDiv.innerHTML += `
                    <div class="property-card-item p-4 rounded-lg flex justify-between items-center border-b last:border-0 hover:bg-gray-50">
                        <div class="flex-grow flex items-center gap-2 cursor-pointer" data-action="view-property" data-client-id="${clientId}" data-property-id="${property.id}">
                            <h4 class="font-bold text-lg text-gray-800">${property.name}</h4>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button class="edit-property-btn p-2 text-blue-600 hover:text-blue-800 rounded-full" data-property-id="${property.id}" title="Editar Propriedade">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <i class="fas fa-chevron-right text-gray-400"></i>
                        </div>
                    </div>`;
            });
        }, error => {
            console.error("Erro ao carregar propriedades:", error);
            hideSpinner(propertiesListDiv);
            propertiesListDiv.innerHTML = '<p class="text-red-500 text-center p-4">Erro ao carregar propriedades.</p>';
        });
    }

    function loadClientTasks() {
        if (!clientTasksList) return;
        showSpinner(clientTasksList);
        const tasksQuery = query(collection(clientDocRef, 'tasks'), orderBy('dueDate', 'desc'));
        onSnapshot(tasksQuery, snapshot => {
            hideSpinner(clientTasksList);
            const pendingTasks = snapshot.docs.filter(docSnap => !docSnap.data().isCompleted);
            const pendingTasksStatEl = document.getElementById('pendingTasksStat');
            if (pendingTasksStatEl) pendingTasksStatEl.textContent = pendingTasks.length;
            if (snapshot.empty) {
                clientTasksList.innerHTML = '<p class="text-gray-500 text-center text-sm py-2">Nenhuma tarefa planejada.</p>';
                return;
            }
            clientTasksList.innerHTML = '';
            // Iterar sobre todas as tarefas no snapshot, e aplicar estilo se estiver concluída
            snapshot.docs.forEach(docSnap => {
                const task = { id: docSnap.id, ...docSnap.data() };
                const isCompleted = task.isCompleted;
                const dueDate = new Date(task.dueDate + 'T12:00:00');
                const formattedDate = dueDate.toLocaleDateString('pt-BR');
                const isOverdue = !isCompleted && dueDate < new Date();
                clientTasksList.innerHTML += `<div class="flex items-center p-2 rounded-md ${isCompleted ? 'bg-gray-100' : ''}"><input type="checkbox" class="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500" ${isCompleted ? 'checked' : ''} disabled><div class="ml-3 flex-grow"><p class="font-medium ${isCompleted ? 'line-through text-gray-500' : 'text-gray-800'}">${task.title}</p><span class="text-sm ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-500'}">Vencimento: ${formattedDate}</span></div></div>`;
            });
        }, error => {
            console.error("Erro ao carregar tarefas:", error);
            hideSpinner(clientTasksList);
            clientTasksList.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar tarefas.</p>';
        });
    }

    function loadSalesHistory() {
        if (!salesHistoryList) return;
        showSpinner(salesHistoryList);
        const salesQuery = query(collection(clientDocRef, 'sales'), orderBy('createdAt', 'desc'));
        onSnapshot(salesQuery, snapshot => {
            hideSpinner(salesHistoryList);
            salesHistoryList.innerHTML = '';
            if (snapshot.empty) {
                salesHistoryList.innerHTML = '<p class="text-gray-500 text-center">Nenhuma venda registrada.</p>';
                return;
            }
            snapshot.forEach(docSnap => {
                const sale = { id: docSnap.id, ...docSnap.data() };
                const saleDate = sale.createdAt ? sale.createdAt.toDate().toLocaleDateString('pt-BR') : 'Processando...';
                const itemsHtml = sale.items.map(item => `<li>${item.tonnage} ton - ${item.formulaName}</li>`).join('');
                const statusColors = { pending_approval: 'bg-yellow-100 text-yellow-800', approved: 'bg-blue-100 text-blue-800', rejected: 'bg-red-100 text-red-800', completed: 'bg-green-100 text-green-800' };
                const statusClass = statusColors[sale.status] || 'bg-gray-100 text-gray-800';
                salesHistoryList.innerHTML += `<div class="border rounded-lg p-4"><div class="flex justify-between items-center"><p class="font-bold text-lg text-gray-800">Venda em ${saleDate}</p><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${sale.status.replace(/_/g, ' ').toUpperCase()}</span></div><p class="text-sm text-gray-500">Registrado por: ${sale.registeredBy}</p><ul class="list-disc list-inside mt-2 text-sm text-gray-700">${itemsHtml}</ul></div>`;
            });
        }, error => {
            console.error("Erro ao carregar histórico de vendas:", error);
            hideSpinner(salesHistoryList);
            salesHistoryList.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar vendas.</p>';
        });
    }

    function renderSummaryCards(clientData) {
        if (!summaryCards) return;
        summaryCards.innerHTML = `<div class="bg-white p-5 rounded-lg shadow"><p class="text-sm font-medium text-gray-500">Propriedades</p><p class="text-2xl font-bold text-gray-800">${clientData.propertyCount || 0}</p></div><div class="bg-white p-5 rounded-lg shadow"><p class="text-sm font-medium text-gray-500">Culturas Ativas</p><p class="text-2xl font-bold text-gray-800">${clientData.cultureCount || 0}</p></div><div class="bg-white p-5 rounded-lg shadow"><p class="text-sm font-medium text-gray-500">Tarefas Pendentes</p><p id="pendingTasksStat" class="text-2xl font-bold text-gray-800">--</p></div>`;
    }

    function createSaleItemElement() {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'sale-item p-3 border rounded-md space-y-2 relative';
        const fixedFormulas = fertilizerFormulas.filter(f => f.isFixed);
        const customFormulas = fertilizerFormulas.filter(f => !f.isFixed);
        let optionsHtml = '<option value="">-- Selecione --</option>';
        if (fixedFormulas.length > 0) { optionsHtml += `<optgroup label="Fórmulas Fixas">${fixedFormulas.map(f => `<option value="${f.name}">${f.name}</option>`).join('')}</optgroup>`; }
        if (customFormulas.length > 0) { optionsHtml += `<optgroup label="Fórmulas Personalizadas">${customFormulas.map(f => `<option value="${f.name}">${f.name}</option>`).join('')}</optgroup>`; }
        optionsHtml += '<optgroup label="Outra"><option value="outra">Outra (digitar)...</option></optgroup>';
        itemDiv.innerHTML = `<button type="button" class="remove-sale-item-btn absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs" title="Remover item">&times;</button><div class="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label class="block text-sm font-medium text-gray-700">Formulação</label><select class="formula-select mt-1 w-full p-2 border border-gray-300 rounded-md">${optionsHtml}</select></div><div><label class="block text-sm font-medium text-gray-700">Toneladas</label><input type="number" step="0.1" class="tonnage-input mt-1 w-full p-2 border border-gray-300 rounded-md" placeholder="0.0"></div></div><div class="custom-formula-container hidden"><label class="block text-sm font-medium text-gray-700">Nome da Formulação</label><input type="text" class="custom-formula-input mt-1 w-full p-2 border border-gray-300 rounded-md" placeholder="Digite a formulação"></div>`;
        saleItemsContainer.appendChild(itemDiv);
    }

    function saveSale() {
        if (!clientDataCache || !clientDataCache.agronomistId) {
            showToast("Aguarde. Os dados do cliente ainda estão carregando.", "error");
            return;
        }
        const saleItems = saleItemsContainer.querySelectorAll('.sale-item');
        if (saleItems.length === 0) { showToast("Adicione pelo menos uma formulação à venda.", 'error'); return; }

        saveSaleBtn.disabled = true;
        saveSaleBtn.textContent = 'Salvando...';

        const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'), orderBy('__name__'), limit(1)); // USANDO 'db' DIRETAMENTE
        getDocs(adminQuery).then(adminSnapshot => {
            if (adminSnapshot.empty) { throw new Error("Nenhum usuário administrador encontrado."); }
            const adminId = adminSnapshot.docs[0].id;
            const registeredByName = loggedInUserData.name || 'Usuário do Sistema';
            const saleData = {
                createdAt: serverTimestamp(), // Uso corrigido de serverTimestamp
                agronomistId: clientDataCache.agronomistId,
                registeredBy: registeredByName,
                status: 'pending_approval',
                clientId: clientId,
                clientName: clientDataCache.name,
                items: []
            };
            let isValid = true;
            saleItems.forEach(item => {
                const formulaSelect = item.querySelector('.formula-select');
                const tonnageInput = item.querySelector('.tonnage-input');
                let formulaName = formulaSelect.value;
                if(formulaName === 'outra') { formulaName = item.querySelector('.custom-formula-input').value.trim(); }
                const tonnage = parseFloat(tonnageInput.value);
                if (!formulaName || isNaN(tonnage) || tonnage <= 0) { isValid = false; }
                saleData.items.push({ formulaName, tonnage });
            });
            if (!isValid) { throw new Error("Verifique os itens da venda."); }

            const notificationData = {
                recipientId: adminId,
                message: `Nova venda para ${clientDataCache.name} (por ${registeredByName}) aguarda aprovação.`,
                link: `dashboard-admin.html`,
                isRead: false,
                createdAt: serverTimestamp(), // Uso corrigido de serverTimestamp
                type: 'sale_approval'
            };

            const batch = writeBatch(db); // USANDO 'db' DIRETAMENTE
            const saleRef = doc(collection(clientDocRef, 'sales'));
            const notificationRef = doc(collection(db, 'notifications')); // USANDO 'db' DIRETAMENTE
            batch.set(saleRef, saleData);
            batch.set(notificationRef, notificationData);

            batch.commit().catch(error => {
                console.error("Erro ao sincronizar venda:", error);
                showToast("Falha ao sincronizar a venda com o servidor.", "error");
            });

            closeModal(saleModal);
            showToast("Venda salva localmente. Sincronizando...", 'success');
            saveSaleBtn.disabled = false;
            saveSaleBtn.textContent = 'Salvar Venda';

        }).catch(error => {
            console.error("Erro ao salvar venda:", error);
            showToast(error.message || "Ocorreu um erro ao registrar a venda.", 'error');
            saveSaleBtn.disabled = false;
            saveSaleBtn.textContent = 'Salvar Venda';
        });
    }

    async function openPropertyModal(propertyId = null) {
        currentEditingPropertyId = propertyId;
        newPropertyNameInput.value = '';
        coordinatesDisplay.textContent = '';
        tempCoordinates = null;
        if (marker) {
            marker.remove();
            marker = null;
        }

        if (propertyId) {
            const propertyDocRef = doc(collection(clientDocRef, 'properties'), propertyId);
            const propertyDoc = await getDoc(propertyDocRef);
            if (propertyDoc.exists()) {
                const propertyData = propertyDoc.data();
                newPropertyNameInput.value = propertyData.name;
                if (propertyData.coordenadas) {
                    tempCoordinates = { lat: propertyData.coordenadas.latitude, lng: propertyData.coordenadas.longitude };
                    coordinatesDisplay.textContent = `Lat: ${tempCoordinates.lat.toFixed(5)}, Lng: ${tempCoordinates.lng.toFixed(5)}`;
                }
            }
        }
        if (removeLocationBtn) {
            removeLocationBtn.classList.toggle('hidden', !tempCoordinates || !propertyId);
        }

        openModal(addPropertyModal);
    }

    async function handleSaveProperty() {
        const name = newPropertyNameInput.value.trim();
        if (!name) { showToast("O nome da propriedade é obrigatório.", 'error'); return; }

        savePropertyBtn.disabled = true;
        savePropertyBtn.textContent = 'Salvando...';

        try {
            let propertyData = {
                name: name,
                status: 'ativo',
                clientId: clientId,
            };
        
            // Se estamos editando uma propriedade
            if (currentEditingPropertyId) {
                // Se tempCoordinates é null, significa que a localização foi removida
                if (!tempCoordinates) {
                    propertyData.coordenadas = deleteField();
                } else {
                    // Se tempCoordinates tem valor, a localização foi definida/alterada
                    propertyData.coordenadas = new GeoPoint(tempCoordinates.lat, tempCoordinates.lng); // Uso corrigido de GeoPoint
                }

                const propertyDocRef = doc(collection(clientDocRef, 'properties'), currentEditingPropertyId);
                await updateDoc(propertyDocRef, propertyData); // updateDoc suporta deleteField
                showToast("Propriedade atualizada com sucesso!", 'success');

            } else { // Se estamos CRIANDO uma NOVA propriedade
                if (tempCoordinates) {
                    // Se tempCoordinates tem valor, adiciona a localização ao novo documento
                    propertyData.coordenadas = new GeoPoint(tempCoordinates.lat, tempCoordinates.lng); // Uso corrigido de GeoPoint
                }
                // Se tempCoordinates é null, o campo 'coordenadas' simplesmente NÃO é incluído no novo documento,
                // evitando o erro 'deleteField com set()'

                propertyData.createdAt = serverTimestamp(); // Adiciona timestamp de criação para novos documentos - Uso corrigido de serverTimestamp
                
                const batch = writeBatch(db);
                const propertyRef = doc(collection(clientDocRef, 'properties'));
                batch.set(propertyRef, propertyData); // set() para novas criações
                batch.update(clientDocRef, { propertyCount: increment(1) }); 

                await batch.commit();
                showToast("Propriedade salva localmente. Sincronizando...", 'success');
            }
        } catch (error) {
            console.error("Erro ao salvar propriedade:", error);
            showToast("Falha ao salvar a propriedade.", "error");
        } finally {
            // Este bloco finally está associado ao try/catch externo da função.
            // Ele será executado independentemente do sucesso ou falha da operação de salvamento.
            newPropertyNameInput.value = '';
            coordinatesDisplay.textContent = '';
            tempCoordinates = null;
            currentEditingPropertyId = null;
            if (map) {
                // map.remove(); // Garante que o mapa é removido se não for mais necessário - Removido para revisão, pois pode impedir reabrir o mapa
                map = null;
            }
            closeModal(addPropertyModal);
            savePropertyBtn.disabled = false;
            savePropertyBtn.textContent = 'Salvar Propriedade';
        }
    }

    function handleRemoveLocation() {
        if (!confirm("Tem certeza que deseja remover a localização desta propriedade?")) {
            return;
        }
        tempCoordinates = null;
        coordinatesDisplay.textContent = 'Localização removida.';
        if (marker) {
            marker.remove();
            marker = null;
        }
        if (removeLocationBtn) {
            removeLocationBtn.classList.add('hidden');
        }
        showToast("Localização removida, clique em Salvar para confirmar.", "info");
    }

    function handleAddTask() {
        const title = modalTaskTitle.value.trim();
        const dueDate = modalTaskDate.value;
        if (!title || !dueDate) {
            showToast("O título e a data da tarefa são obrigatórios.", 'error');
            return;
        }
        addClientTaskBtn.disabled = true;
        addClientTaskBtn.textContent = 'Salvando...';
        const taskData = {
            title: title,
            description: modalTaskDescription.value.trim() || null,
            dueDate: dueDate,
            propertyId: modalTaskProperty.value || null,
            plotId: modalTaskPlot.value || null,
            isCompleted: false,
            createdAt: serverTimestamp() // Uso corrigido de serverTimestamp
        };
        addDoc(collection(clientDocRef, 'tasks'), taskData).catch(error => {
            console.error("Erro ao sincronizar tarefa:", error);
            showToast("Falha ao sincronizar a nova tarefa.", 'error');
        });
        showToast("Tarefa salva localmente. Sincronizando...", "success");
        closeModal(addTaskModal);
        addTaskModal.querySelector('form').reset();
        addClientTaskBtn.disabled = false;
        addClientTaskBtn.textContent = 'Salvar Tarefa';
    }

    function populatePropertyDropdown() {
        modalTaskProperty.innerHTML = '<option value="">Nenhuma</option>';
        clientProperties.forEach(prop => {
            modalTaskProperty.innerHTML += `<option value="${prop.id}">${prop.name}</option>`;
        });
    }

    async function populatePlotDropdown(propertyId) {
        modalTaskPlot.innerHTML = '<option value="">Nenhum</option>';
        modalTaskPlot.disabled = true;
        if (!propertyId) return;
        try {
            const plotsQuery = query(collection(clientDocRef, 'properties', propertyId, 'plots'));
            const snapshot = await getDocs(plotsQuery);
            if (!snapshot.empty) {
                snapshot.docs.forEach(docSnap => {
                    modalTaskPlot.innerHTML += `<option value="${docSnap.id}">${docSnap.data().name}</option>`;
                });
                modalTaskPlot.disabled = false;
            }
        }
        catch (error) {
            console.error("Erro ao carregar talhões:", error);
        }
    }

    function initializeMapForSelection() {
        // CORREÇÃO: Adicionando verificação para garantir que L (Leaflet) está definido
        if (typeof L === 'undefined') {
            console.error("Leaflet (L) não está definido ao tentar inicializar o mapa. Certifique-se de que o script Leaflet foi carregado.");
            showToast("Erro: A biblioteca de mapas não carregou. Por favor, recarregue a página.", "error");
            return;
        }

        // Se o mapa já existe e está vinculado ao #mapContainer, invalida o tamanho e retorna.
        if (map instanceof L.Map && map._container && map._container.id === 'mapContainer') {
            map.invalidateSize();
            return;
        }

        // Se existe uma instância antiga do mapa, remove-a para evitar duplicação ou erros.
        if (map) {
            map.remove();
        }

        map = L.map('mapContainer').setView([-14.235, -51.925], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        map.on('click', function(e) {
            const { lat, lng } = e.latlng;
            tempCoordinates = { lat, lng };
            if (marker) {
                marker.setLatLng(e.latlng);
            } else {
                marker = L.marker(e.latlng).addTo(map);
            }
        });
    }

    function useCurrentLocation() {
        if (!navigator.geolocation) {
            showToast('Geolocalização não é suportada por este navegador.', 'error');
            return;
        }
        getUserLocationBtn.disabled = true;
        showToast('Obtendo sua localização...', 'info');
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            const latLng = [latitude, longitude];
            tempCoordinates = { lat: latitude, lng: longitude };
            if (map) {
                if (marker) {
                    marker.setLatLng(latLng);
                } else {
                    marker = L.marker(latLng).addTo(map);
                }
                map.setView(latLng, 16);
            } else {
                console.warn("Mapa não inicializado ao tentar usar localização atual.");
                showToast("Erro: Mapa não está pronto.", "error");
            }
            getUserLocationBtn.disabled = false;
        }, () => {
            showToast('Não foi possível obter sua localização.', 'error');
            getUserLocationBtn.disabled = false;
        });
    }

    function addEventListeners() {
        if (showSaleModalBtn) showSaleModalBtn.addEventListener('click', () => { saleItemsContainer.innerHTML = ''; createSaleItemElement(); openModal(saleModal); });
        if (closeSaleModalBtn) closeSaleModalBtn.addEventListener('click', () => closeModal(saleModal));
        if (addSaleItemBtn) addSaleItemBtn.addEventListener('click', createSaleItemElement);
        if (saveSaleBtn) saveSaleBtn.addEventListener('click', saveSale);
        if (saleItemsContainer) {
            saleItemsContainer.addEventListener('change', e => { if (e.target.classList.contains('formula-select')) { const customContainer = e.target.closest('.sale-item').querySelector('.custom-formula-container'); customContainer.classList.toggle('hidden', e.target.value !== 'outra'); } });
            saleItemsContainer.addEventListener('click', e => { if (e.target.closest('.remove-sale-item-btn')) { e.target.closest('.sale-item').remove(); } });
        }

        if (showAddPropertyModalBtn) showAddPropertyModalBtn.addEventListener('click', () => {
            currentEditingPropertyId = null; // Garante que é uma nova propriedade
            newPropertyNameInput.value = '';
            coordinatesDisplay.textContent = '';
            tempCoordinates = null;
            if (marker) {
                marker.remove();
                marker = null;
            }
            openModal(addPropertyModal);
        });
        if (closeAddPropertyModalBtn) closeAddPropertyModalBtn.addEventListener('click', () => closeModal(addPropertyModal));
        if (savePropertyBtn) savePropertyBtn.addEventListener('click', handleSaveProperty);
        if (showAddTaskModalBtn) showAddTaskModalBtn.addEventListener('click', () => openModal(addTaskModal));
        if (closeAddTaskModalBtn) closeAddTaskModalBtn.addEventListener('click', () => closeModal(addTaskModal));
        if (addClientTaskBtn) addClientTaskBtn.addEventListener('click', handleAddTask);
        if (modalTaskProperty) modalTaskProperty.addEventListener('change', (e) => populatePlotDropdown(e.target.value));

        if (openMapModalBtn) { // Verifica se o botão existe antes de adicionar o listener
            openMapModalBtn.addEventListener('click', () => {
                openModal(mapModal);
                setTimeout(() => {
                    initializeMapForSelection();
                    // Se estiver editando e já houver coordenadas, centralize o mapa nelas
                    if (tempCoordinates) {
                        map.setView([tempCoordinates.lat, tempCoordinates.lng], 15);
                        if (!marker) { // Adiciona marcador se não houver um
                           marker = L.marker([tempCoordinates.lat, tempCoordinates.lng]).addTo(map);
                        }
                    }
                }, 100);
            });
        }
        if (closeMapModalBtn) closeMapModalBtn.addEventListener('click', () => closeModal(mapModal));
        if (cancelMapSelectionBtn) cancelMapSelectionBtn.addEventListener('click', () => closeModal(mapModal));
        if (confirmMapSelectionBtn) confirmMapSelectionBtn.addEventListener('click', () => {
            if (tempCoordinates) {
                coordinatesDisplay.textContent = `Lat: ${tempCoordinates.lat.toFixed(5)}, Lng: ${tempCoordinates.lng.toFixed(5)}`;
            }
            closeModal(mapModal);
        });
        if (getUserLocationBtn) getUserLocationBtn.addEventListener('click', useCurrentLocation);
        if (removeLocationBtn) removeLocationBtn.addEventListener('click', handleRemoveLocation); // Adiciona listener para remover localização

        if (propertiesListDiv) {
            propertiesListDiv.addEventListener('click', (e) => {
                const editButton = e.target.closest('.edit-property-btn');
                const viewPropertyDiv = e.target.closest('[data-action="view-property"]');

                if (editButton) {
                    e.stopPropagation();
                    const propId = editButton.dataset.propertyId;
                    openPropertyModal(propId);
                } else if (viewPropertyDiv) {
                    const propId = viewPropertyDiv.dataset.propertyId;
                    window.location.href = `property-details.html?clientId=${clientId}&propertyId=${propId}&from=${from}`;
                }
            });
        }
    }

    initializePage();
}