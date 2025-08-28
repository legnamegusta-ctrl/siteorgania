// js/pages/client-list.js

// Importar as funções Firestore necessárias da API modular do v9
import { getFirestore, collection, query, where, orderBy, getDocs, doc, updateDoc, addDoc, serverTimestamp, onSnapshot } from '/vendor/firebase/9.6.0/firebase-firestore.js';
import { db } from '../config/firebase.js'; // db ainda é importado para consistência, mas getFirestore será usado localmente.
import { showToast, showSpinner, hideSpinner, openModal, closeModal } from '../services/ui.js';

export function initClientList(userId, userRole) {
    console.log("initClientList: Inicializando página da lista de clientes.");

    // Obtém a instância do Firestore V9
    const dbFirestore = getFirestore();

    // --- Elementos da Página ---
    const agronomistClientsList = document.getElementById('agronomistClientsListClientList');
    const clientSearchInput = document.getElementById('clientSearchInputClientList');
    const filterAllBtn = document.getElementById('filterAllBtnClientList');
    const filterFavBtn = document.getElementById('filterFavBtnClientList');
    const filterArchivedBtn = document.getElementById('filterArchivedBtnClientList');

    const syncSection = document.getElementById('sync-section-client-list');
    const syncSelectionCount = document.getElementById('sync-selection-count-client-list');
    const syncOfflineDataBtn = document.getElementById('syncOfflineDataBtnClientList');
    const syncStatus = document.getElementById('syncStatusClientList');

    // --- Modais ---
    const addClientModal = document.getElementById('addClientModalClientList');
    const showAddClientModalBtn = document.getElementById('showAddClientModalBtnClientList');
    const closeAddClientModalBtn = document.getElementById('closeAddClientModalBtnClientList');
    const addClientBtn = document.getElementById('addClientBtnClientList');
    const newClientNameInput = document.getElementById('newClientNameClientList');

    // Elementos da Bottom Navigation Bar (desta página) - Declarados uma única vez aqui
    const navHomeBtn = document.getElementById('navHomeBtnClientList');
    const navClientsBtn = document.getElementById('navClientsBtnClientList');
    const navVisitBtn = document.getElementById('navVisitBtnClientList');
    const navAgendaBtn = document.getElementById('navAgendaBtnClientList');
    const navProfileBtn = document.getElementById('navProfileBtnClientList');

    let allMyClients = [];
    let currentFilter = 'active';

    const loadAgronomistClients = () => {
        console.log("loadAgronomistClients: Iniciando carregamento de clientes do Firestore.");
        showSpinner(agronomistClientsList);

        // SINTAXE FIREBASE V9: collection, query, where, onSnapshot
        const clientsCollectionRef = collection(dbFirestore, 'clients');
        const clientsQuery = query(clientsCollectionRef, where('agronomistId', '==', userId));

        onSnapshot(clientsQuery, snapshot => {
            hideSpinner(agronomistClientsList);
            console.log("loadAgronomistClients: Snapshot de clientes recebido. Tamanho:", snapshot.size);
            allMyClients = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })); // Use docSnap para evitar conflito com 'doc' importado
            handleFilter(); // Aplica o filtro inicial ao carregar
        }, error => {
            console.error("Erro ao carregar clientes:", error);
            hideSpinner(agronomistClientsList);
            agronomistClientsList.innerHTML = `<p class="text-red-500 text-center py-4">Erro ao carregar clientes.</p>`;
        });
    };

    const renderClientList = (clientsToRender) => {
        console.log("renderClientList: Renderizando", clientsToRender.length, "clientes.");
        agronomistClientsList.innerHTML = '';
        if (clientsToRender.length === 0) {
            agronomistClientsList.innerHTML = `<p class="text-gray-500 text-center p-4">Nenhum cliente encontrado neste filtro.</p>`;
            return;
        }

        clientsToRender.forEach(client => {
            const checkboxHtml = client.status !== 'inativo' ? `<input type="checkbox" class="client-sync-checkbox h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" data-client-id="${client.id}">` : '';
            let actionButtons;
            if (client.status === 'inativo') {
                actionButtons = `<button class="unarchive-btn p-2 text-gray-400 hover:text-green-500 rounded-full" data-client-id="${client.id}" title="Reativar Cliente"><i class="fas fa-undo"></i></button>`;
            } else {
                const isFavoriteIcon = client.isFavorite ? `<i class="fas fa-star text-yellow-500"></i>` : `<i class="far fa-star text-gray-400"></i>`;
                actionButtons = `<button class="favorite-btn p-2 text-xl hover:bg-gray-200 rounded-full" data-client-id="${client.id}" data-is-favorite="${client.isFavorite}" title="Marcar como favorito">${isFavoriteIcon}</button><button class="archive-btn p-2 text-gray-400 hover:text-red-500 rounded-full" data-client-id="${client.id}" title="Arquivar Cliente"><i class="fas fa-archive"></i></button>`;
            }
            const clientCard = `
                <div class="client-card-item bg-white p-4 rounded-lg flex items-center gap-4 hover:bg-gray-50 transition-colors">
                    ${checkboxHtml}
                    <div class="grow client-card-body" style="cursor: pointer;" data-client-id="${client.id}">
                        <p class="font-bold text-gray-800">${client.name}</p>
                        <p class="text-sm text-gray-500">${client.status === 'inativo' ? 'Arquivado' : 'Clique para ver detalhes'}</p>
                    </div>
                    <div class="flex items-center gap-1">
                        ${actionButtons}
                    </div>
                </div>`;
            agronomistClientsList.innerHTML += clientCard;
        });
    };

    const handleFilter = () => {
        console.log("handleFilter: Aplicando filtro. Filtro atual:", currentFilter);
        const searchTerm = clientSearchInput.value.toLowerCase();
        let filteredClients;
        if (currentFilter === 'archived') {
            filteredClients = allMyClients.filter(c => c.status === 'inativo');
        } else {
            let activeClients = allMyClients.filter(c => c.status !== 'inativo');
            if (currentFilter === 'favorites') {
                filteredClients = activeClients.filter(c => c.isFavorite === true);
            } else {
                filteredClients = activeClients;
            }
        }
        if (searchTerm) {
            filteredClients = filteredClients.filter(c => c.name.toLowerCase().includes(searchTerm));
        }
        filteredClients.sort((a, b) => a.name.localeCompare(b.name));
        console.log("handleFilter: Clientes filtrados:", filteredClients.length);
        renderClientList(filteredClients);
    };

    const handleAddClient = async () => {
        const clientName = newClientNameInput.value.trim();
        if (!clientName) {
            showToast('O nome do cliente não pode estar vazio.', 'error');
            return;
        }
        try {
            // SINTAXE FIREBASE V9: addDoc para adicionar um documento a uma coleção
            await addDoc(collection(dbFirestore, 'clients'), {
                name: clientName,
                agronomistId: userId,
                createdAt: serverTimestamp(), // Usa serverTimestamp do v9
                isFavorite: false,
                status: 'ativo',
                tier: 'standard',
                enabledModules: {},
                propertyCount: 0,
                cultureCount: 0
            });
            closeModal(addClientModal);
            newClientNameInput.value = '';
            showToast('Cliente adicionado com sucesso!', 'success');
        } catch (error) {
            console.error("Erro ao adicionar cliente:", error);
            showToast('Ocorreu um erro ao salvar o cliente.', 'error');
        }
    };

    const archiveClient = async (clientId) => {
        if (!confirm("Tem certeza que deseja arquivar este cliente?")) return;
        try {
            // SINTAXE FIREBASE V9: updateDoc para atualizar um documento
            const clientDocRef = doc(dbFirestore, 'clients', clientId);
            await updateDoc(clientDocRef, { status: 'inativo' });
            showToast('Cliente arquivado.', 'info');
        } catch (error) {
            console.error("Erro ao arquivar cliente:", error);
            showToast('Ocorreu um erro ao arquivar o cliente.', 'error');
        }
    };

    const unarchiveClient = async (clientId) => {
        if (!confirm("Tem certeza que deseja reativar este cliente?")) return;
        try {
            // SINTAXE FIREBASE V9: updateDoc para atualizar um documento
            const clientDocRef = doc(dbFirestore, 'clients', clientId);
            await updateDoc(clientDocRef, { status: 'ativo' });
            showToast('Cliente reativado com sucesso!', 'success');
        } catch (error) {
            console.error("Erro ao reativar cliente:", error);
            showToast('Ocorreu um erro ao reativar o cliente.', 'error');
        }
    };

    const toggleFavorite = async (buttonElement) => {
        const clientId = buttonElement.dataset.clientId;
        const isCurrentlyFavorite = buttonElement.dataset.isFavorite === 'true';
        const newFavoriteState = !isCurrentlyFavorite;
        buttonElement.dataset.isFavorite = newFavoriteState;
        const icon = buttonElement.querySelector('i');
        icon.className = newFavoriteState ? 'fas fa-star text-yellow-500' : 'far fa-star text-gray-400';
        try {
            // SINTAXE FIREBASE V9: updateDoc para atualizar um documento
            const clientDocRef = doc(dbFirestore, 'clients', clientId);
            await updateDoc(clientDocRef, { isFavorite: newFavoriteState });
        } catch (error) {
            console.error("Erro ao favoritar cliente:", error);
        }
    };

    function updateSyncSelection() {
        const selectedCheckboxes = document.querySelectorAll('.client-sync-checkbox:checked');
        const count = selectedCheckboxes.length;
        if (count > 0) {
            syncSection.classList.remove('hidden');
            syncSelectionCount.textContent = `${count} cliente(s) selecionado(s).`;
            syncOfflineDataBtn.disabled = false;
        } else {
            syncSection.classList.add('hidden');
            syncOfflineDataBtn.disabled = true;
        }
    }

    async function syncSelectedClients() {
        const selectedCheckboxes = document.querySelectorAll('.client-sync-checkbox:checked');
        const clientIdsToSync = Array.from(selectedCheckboxes).map(cb => cb.dataset.clientId);
        if (clientIdsToSync.length === 0) {
            showToast("Nenhum cliente selecionado para sincronizar.", "info");
            return;
        }

        syncOfflineDataBtn.disabled = true;
        syncOfflineDataBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-2"></i>Sincronizando...';
        syncStatus.textContent = 'Iniciando sincronização...';

        try {
            for (let i = 0; i < clientIdsToSync.length; i++) {
                const clientId = clientIdsToSync[i];
                const clientName = allMyClients.find(c => c.id === clientId)?.name || `Cliente ${i + 1}`;
                syncStatus.textContent = `Sincronizando ${clientName} (${i + 1} de ${clientIdsToSync.length})...`;

                // SINTAXE FIREBASE V9
                const clientRef = doc(dbFirestore, 'clients', clientId);
                const propertiesQuery = query(collection(clientRef, 'properties')); // Use collection com ref
                const tasksQuery = query(collection(clientRef, 'tasks')); // Use collection com ref
                const salesQuery = query(collection(dbFirestore, 'sales'), where('clientId', '==', clientId), where('agronomistId', '==', userId));

                const [propertiesSnapshot, tasksSnapshot, salesSnapshot] = await Promise.all([
                    getDocs(propertiesQuery),
                    getDocs(tasksQuery),
                    getDocs(salesQuery)
                ]);

                // Nota: Para sincronização offline robusta, você precisaria de mais lógica aqui
                // para realmente armazenar esses dados localmente (IndexedDB, etc.)
                // As chamadas getDocs apenas trazem os dados, não os persistem offline automaticamente.
            }

            syncStatus.textContent = '';
            showToast(`${clientIdsToSync.length} cliente(s) sincronizado(s) com sucesso!`, 'success');

        } catch (error) {
            console.error("Erro durante a sincronização offline:", error);
            showToast("Ocorreu um erro durante a sincronização.", "error");
            syncStatus.textContent = 'Erro na sincronização.';
        } finally {
            syncOfflineDataBtn.disabled = false;
            syncOfflineDataBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Sincronizar Selecionados';
            selectedCheckboxes.forEach(cb => cb.checked = false);
            updateSyncSelection();
        }
    }

    const handleStartVisitFromClientList = () => {
        showToast("Funcionalidade de iniciar visita a partir da lista de clientes será implementada em breve.", "info");
    };

    function setupEventListeners() {
        // Filtros
        const filterButtons = [filterAllBtn, filterFavBtn, filterArchivedBtn];
        filterButtons.forEach(button => {
            if (button) {
                button.addEventListener('click', () => {
                    filterButtons.forEach(btn => btn.classList.remove('filter-active'));
                    button.classList.add('filter-active');
                    currentFilter = button.dataset.filter;
                    handleFilter();
                });
            }
        });

        if (clientSearchInput) clientSearchInput.addEventListener('input', handleFilter);

        // Modais e Ações
        if (showAddClientModalBtn) showAddClientModalBtn.addEventListener('click', () => openModal(addClientModal));
        if (closeAddClientModalBtn) closeAddClientModalBtn.addEventListener('click', () => closeModal(addClientModal));
        if (addClientBtn) addClientBtn.addEventListener('click', handleAddClient);

        // Ações da Lista de Clientes (delegação de eventos)
        if (agronomistClientsList) {
            agronomistClientsList.addEventListener('click', (e) => {
                if (e.target.classList.contains('client-sync-checkbox')) {
                    updateSyncSelection();
                    return;
                }
                const archiveButton = e.target.closest('.archive-btn');
                if (archiveButton) { archiveClient(archiveButton.dataset.clientId); return; }
                const unarchiveButton = e.target.closest('.unarchive-btn');
                if (unarchiveButton) { unarchiveClient(unarchiveButton.dataset.clientId); return; }
                const favoriteButton = e.target.closest('.favorite-btn');
                if (favoriteButton) { toggleFavorite(favoriteButton); return; }
                const clientCardBody = e.target.closest('.client-card-body');
                if (clientCardBody) {
                    window.location.href = `client-details.html?clientId=${clientCardBody.dataset.clientId}&from=agronomo`;
                }
            });
        }

        // Sincronização
        if (syncOfflineDataBtn) syncOfflineDataBtn.addEventListener('click', syncSelectedClients);

        // Event Listeners para a Bottom Navigation Bar
        const navHomeBtn = document.getElementById('navHomeBtnClientList');
        const navClientsBtn = document.getElementById('navClientsBtnClientList');
        const navVisitBtn = document.getElementById('navVisitBtnClientList');
        const navAgendaBtn = document.getElementById('navAgendaBtnClientList');
        const navProfileBtn = document.getElementById('navProfileBtnClientList');

        if (navHomeBtn) {
            navHomeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = `dashboard-agronomo.html`;
            });
        }
        if (navVisitBtn) {
            navVisitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleStartVisitFromClientList();
            });
        }
        if (navAgendaBtn) {
            navAgendaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = `dashboard-agronomo.html?view=agenda`;
            });
        }
        if (navProfileBtn) {
            navProfileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showToast("A seção de Perfil será implementada em breve.", "info");
            });
        }
    }

    // --- Inicialização ---
    loadAgronomistClients();
    if (filterAllBtn) filterAllBtn.classList.add('filter-active');

    setTimeout(setupEventListeners, 50);
}
