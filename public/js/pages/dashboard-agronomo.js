// public/js/pages/dashboard-agronomo.js

import { db, auth } from '../config/firebase.js';
import { showSpinner, hideSpinner, showToast, openModal, closeModal } from '../services/ui.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';

export function initAgronomoDashboard(userId, userRole) {
    const mainContentArea = document.getElementById('main-content-area');
    const navButtons = document.querySelectorAll('nav a');

    // Elementos do modal de adicionar cliente
    const addClientModal = document.getElementById('addClientModal');
    // const openAddClientModalBtn = document.getElementById('openAddClientModalBtn'); // Será pego dinamicamente
    const closeAddClientModalBtn = document.getElementById('closeAddClientModalBtn');
    const addClientBtn = document.getElementById('addClientBtn');
    const newClientNameInput = document.getElementById('newClientName');

    // Elementos do modal de adicionar funcionário
    const addOperatorModal = document.getElementById('addOperatorModal');
    // const openAddOperatorModalBtn = document.getElementById('openAddOperatorModalBtn'); // Será pego dinamicamente
    const closeAddOperatorModalBtn = document.getElementById('closeAddOperatorModalBtn');
    const addOperatorForm = document.getElementById('addOperatorForm');
    const newOperatorNameInput = document.getElementById('newOperatorName');
    const newOperatorEmailInput = document.getElementById('newOperatorEmail');
    const newOperatorPasswordInput = document.getElementById('newOperatorPassword');
    const operatorClientSelect = document.getElementById('operatorClientSelect');

    // Elementos do modal de adicionar tarefa
    const addTaskModal = document.getElementById('addTaskModal');
    const closeAddTaskModalBtn = document.getElementById('closeAddTaskModalBtn');
    const addClientTaskBtn = document.getElementById('addClientTaskBtn');
    const modalTaskTitle = document.getElementById('modalTaskTitle');
    const modalTaskDescription = document.getElementById('modalTaskDescription');
    const modalTaskProperty = document.getElementById('modalTaskProperty');
    const modalTaskPlot = document.getElementById('modalTaskPlot');
    const modalTaskDate = document.getElementById('modalTaskDate');

    let currentView = 'dashboard'; // Visão inicial
    let currentClients = []; // Armazena os clientes do agrônomo
    let currentProperties = []; // Armazena as propriedades do cliente selecionado para o modal de tarefa
    let currentPlots = []; // Armazena os talhões da propriedade selecionada para o modal de tarefa

    // Função para renderizar o conteúdo da dashboard
    const renderDashboardContent = async () => {
        showSpinner(mainContentArea); // Mostra spinner antes de limpar
        mainContentArea.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow w-full mb-8">
                <h2 id="welcomeMessage" class="text-3xl font-bold text-gray-800 mb-1">Carregando...</h2>
                <p id="summaryMessage" class="text-gray-600">Carregando dados da dashboard.</p>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Ações Rápidas</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button id="openAddClientModalBtn" class="flex items-center justify-center p-4 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition-colors">
                        <i class="fas fa-user-plus mr-2"></i> Adicionar Cliente
                    </button>
                    <button id="openAddTaskModalBtn" class="flex items-center justify-center p-4 bg-green-500 text-white rounded-lg shadow hover:bg-green-600 transition-colors">
                        <i class="fas fa-tasks mr-2"></i> Atribuir Tarefa
                    </button>
                    <button id="openAddOperatorModalBtn" class="flex items-center justify-center p-4 bg-purple-500 text-white rounded-lg shadow hover:bg-purple-600 transition-colors">
                        <i class="fas fa-user-tie mr-2"></i> Adicionar Funcionário
                    </button>
                    <a href="mapa-agronomo.html" class="flex items-center justify-center p-4 bg-yellow-500 text-white rounded-lg shadow hover:bg-yellow-600 transition-colors">
                        <i class="fas fa-map-marked-alt mr-2"></i> Ver Mapa de Clientes
                    </a>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Meus Clientes</h3>
                    <div id="agronomoClientList" class="space-y-4">
                        <p class="text-gray-500 text-center py-4">Carregando clientes...</p>
                    </div>
                    <button id="viewAllClientsBtn" class="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Ver Todos os Clientes</button>
                </div>

                <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Tarefas Pendentes</h3>
                    <div id="agronomoPendingTasks" class="space-y-4">
                        <p class="text-gray-500 text-center py-4">Carregando tarefas...</p>
                    </div>
                    <button id="viewAllTasksBtn" class="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Ver Todas as Tarefas</button>
                </div>
            </div>
        `;
        // CORREÇÃO: Chamar setupDashboardEventListeners *depois* que o HTML é inserido
        setupDashboardEventListeners();
        await loadAgronomoDashboardData();
        hideSpinner(mainContentArea); // Esconde spinner após carregar e renderizar
    };

    const renderClientsContent = async () => {
        showSpinner(mainContentArea);
        mainContentArea.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Meus Clientes</h2>
                <button id="openAddClientModalBtn" class="px-4 py-2 text-white font-semibold rounded-lg mb-4" style="background-color: var(--brand-green);">
                    <i class="fas fa-user-plus mr-2"></i> Adicionar Novo Cliente
                </button>
                <button id="openAddOperatorModalBtn" class="px-4 py-2 bg-purple-500 text-white font-semibold rounded-lg shadow hover:bg-purple-600 transition-colors ml-2">
                    <i class="fas fa-user-tie mr-2"></i> Adicionar Funcionário
                </button>
                <div id="fullClientList" class="space-y-4">
                    <p class="text-gray-500 text-center py-4">Carregando clientes...</p>
                </div>
            </div>
        `;
        // CORREÇÃO: Chamar setupClientListEventListeners *depois* que o HTML é inserido
        setupClientListEventListeners();
        await loadFullClientList();
        hideSpinner(mainContentArea);
    };

    const renderProfileContent = async () => {
        showSpinner(mainContentArea);
        mainContentArea.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Meu Perfil</h2>
                <div id="profileDetails" class="space-y-3 text-gray-700">
                    <p><strong>Nome:</strong> <span id="profileName">Carregando...</span></p>
                    <p><strong>Email:</strong> <span id="profileEmail">Carregando...</span></p>
                    <p><strong>Função:</strong> <span id="profileRole">Carregando...</span></p>
                </div>
                <button id="editProfileBtn" class="mt-6 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Editar Perfil</button>
            </div>
        `;
        await loadProfileDetails();
        hideSpinner(mainContentArea);
    };

    const loadAgronomoDashboardData = async () => {
        try {
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userDocRef);
            
            // CORREÇÃO: Acessar os elementos SOMENTE depois que eles são renderizados em renderDashboardContent
            const welcomeMsgEl = document.getElementById('welcomeMessage');
            const summaryMsgEl = document.getElementById('summaryMessage');

            if (userDoc.exists()) {
                const userData = userDoc.data();
                if(welcomeMsgEl) welcomeMsgEl.textContent = `Bem-vindo(a), ${userData.name ? userData.name.split(' ')[0] : 'Agrônomo(a)'}!`;
                if(summaryMsgEl) summaryMsgEl.textContent = `Visão geral das suas atividades.`;
            }

            // Carregar clientes do agrônomo
            const clientsQuery = query(collection(db, 'clients'), where('agronomistId', '==', userId), orderBy('name'));
            const clientsSnapshot = await getDocs(clientsQuery);
            currentClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderClientsSummary(currentClients);

            // Carregar tarefas pendentes do agrônomo (para todos os seus clientes)
            await loadPendingTasksSummary(currentClients.map(c => c.id));

        } catch (error) {
            console.error("Erro ao carregar dados do dashboard do agrônomo:", error);
            showToast("Erro ao carregar dashboard. Recarregue a página.", "error");
        }
        // hideSpinner(mainContentArea) foi movido para o final de renderDashboardContent
    };

    const renderClientsSummary = (clients) => {
        const agronomoClientList = document.getElementById('agronomoClientList');
        agronomoClientList.innerHTML = '';
        if (clients.length === 0) {
            agronomoClientList.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum cliente cadastrado.</p>';
            return;
        }
        clients.slice(0, 3).forEach(client => { // Mostrar os 3 primeiros clientes
            agronomoClientList.innerHTML += `
                <div class="bg-gray-50 p-4 rounded-lg shadow-sm flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-lg text-gray-800">${client.name}</h4>
 <p class="text-sm text-gray-600">${client.propertyCount || 0} propriedades</p>
                     </div>
                    <a href="client-details.html?clientId=${client.id}" class="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm">Ver Detalhes</a>
                </div>
            `;
        });
    };

    const loadPendingTasksSummary = async (clientIds) => {
        const agronomoPendingTasks = document.getElementById('agronomoPendingTasks');
        agronomoPendingTasks.innerHTML = '';
        if (clientIds.length === 0) {
            agronomoPendingTasks.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma tarefa pendente.</p>';
            return;
        }

        let allPendingTasks = [];
        for (const clientId of clientIds) {
            const tasksQuery = query(
                collection(db, `clients/${clientId}/tasks`),
                where('isCompleted', '==', false),
                orderBy('dueDate')
            );
            const tasksSnapshot = await getDocs(tasksQuery);
            tasksSnapshot.forEach(doc => {
                allPendingTasks.push({ id: doc.id, clientId: clientId, clientName: currentClients.find(c => c.id === clientId)?.name, ...doc.data() });
            });
        }

        if (allPendingTasks.length === 0) {
            agronomoPendingTasks.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma tarefa pendente.</p>';
            return;
        }

        allPendingTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)); // Garantir ordenação
        allPendingTasks.slice(0, 3).forEach(task => { // Mostrar as 3 primeiras tarefas
            const dueDate = new Date(task.dueDate + 'T12:00:00'); // Adiciona T12:00:00 para evitar problemas de fuso horário
            const formattedDate = dueDate.toLocaleDateString('pt-BR');
            const isOverdue = dueDate < new Date() && !task.isCompleted;

            agronomoPendingTasks.innerHTML += `
                <div class="bg-gray-50 p-4 rounded-lg shadow-sm flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-lg text-gray-800">${task.title}</h4>
                        <p class="text-sm text-gray-600">Cliente: ${task.clientName}</p>
                        <p class="text-xs text-gray-500">Vencimento: ${formattedDate} ${isOverdue ? '<span class="text-red-500">(Atrasada)</span>' : ''}</p>
                    </div>
                    <a href="task-viewer.html?clientId=${task.clientId}&taskId=${task.id}" class="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm">Ver Detalhes</a>
                </div>
            `;
        });
    };

    const loadFullClientList = async () => {
        const fullClientListDiv = document.getElementById('fullClientList');
        showSpinner(fullClientListDiv);
        try {
            const clientsQuery = query(collection(db, 'clients'), where('agronomistId', '==', userId), orderBy('name'));
            const clientsSnapshot = await getDocs(clientsQuery);
            currentClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            fullClientListDiv.innerHTML = '';
            if (currentClients.length === 0) {
                fullClientListDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum cliente cadastrado.</p>';
                return;
            }

            currentClients.forEach(client => {
                fullClientListDiv.innerHTML += `
                    <div class="bg-gray-50 p-4 rounded-lg shadow-sm flex justify-between items-center">
                        <div>
                            <h4 class="font-bold text-lg text-gray-800">${client.name}</h4>
    <p class="text-sm text-gray-600">${client.propertyCount || 0} propriedades</p>
                            </div>
                        <a href="client-details.html?clientId=${client.id}" class="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm">Ver Detalhes</a>
                    </div>
                `;
            });
        } catch (error) {
            console.error("Erro ao carregar lista completa de clientes:", error);
            showToast("Erro ao carregar clientes.", "error");
        } finally {
            hideSpinner(fullClientListDiv);
        }
    };

    const setupEventListeners = () => {
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const view = button.dataset.view;
                navButtons.forEach(btn => btn.classList.remove('text-blue-600', 'font-semibold'));
                navButtons.forEach(btn => btn.classList.add('text-gray-600'));
                button.classList.add('text-blue-600', 'font-semibold');
                button.classList.remove('text-gray-600');

                // Ajuste para o botão de visita
                const visitButton = document.getElementById('navVisitBtnDashboardAgronomo');
                if (view === 'visit') {
                    visitButton.querySelector('div').classList.add('bg-blue-600');
                    visitButton.querySelector('div').classList.remove('bg-gray-600');
                    visitButton.classList.add('text-blue-600', 'font-semibold');
                    visitButton.classList.remove('text-gray-600');
                } else {
                    visitButton.querySelector('div').classList.remove('bg-blue-600');
                    visitButton.querySelector('div').classList.add('bg-gray-600');
                }
                
                currentView = view;
                if (view === 'dashboard') {
                    renderDashboardContent();
                } else if (view === 'clients') {
                    renderClientsContent();
                } else if (view === 'profile') {
                    renderProfileContent();
                } else if (view === 'agenda') {
                    window.location.href = 'agenda.html';
                } else if (view === 'visit') {
                    window.location.href = 'mapa-agronomo.html';
                }
            });
        });

        // Event listener para o botão de visita na navegação inferior
        document.getElementById('navVisitBtnDashboardAgronomo').addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'mapa-agronomo.html';
        });

        // Inicializa a view padrão (será chamada no final de initAgronomoDashboard)
        // renderDashboardContent(); 
    };

    const setupDashboardEventListeners = () => {
        // CORREÇÃO: Pegar o elemento depois que o HTML é renderizado
        const openAddClientModalBtn = document.getElementById('openAddClientModalBtn');
        const openAddTaskModalBtn = document.getElementById('openAddTaskModalBtn');
        const viewAllClientsBtn = document.getElementById('viewAllClientsBtn');
        const viewAllTasksBtn = document.getElementById('viewAllTasksBtn');
        const openAddOperatorModalBtn = document.getElementById('openAddOperatorModalBtn'); // NOVO: Botão de adicionar operador

        if (openAddClientModalBtn) openAddClientModalBtn.addEventListener('click', () => openModal(addClientModal));
        if (openAddTaskModalBtn) openAddTaskModalBtn.addEventListener('click', () => openAddTaskModal());
        if (viewAllClientsBtn) viewAllClientsBtn.addEventListener('click', () => {
            document.getElementById('navClientsBtnDashboardAgronomo').click();
        });
        if (viewAllTasksBtn) viewAllTasksBtn.addEventListener('click', () => {
            window.location.href = `agenda.html?agronomistId=${userId}`; // Redireciona para a agenda com filtro de tarefas do agrônomo
        });
        
        // NOVO: Event listeners para o modal de adicionar funcionário
        if (openAddOperatorModalBtn) openAddOperatorModalBtn.addEventListener('click', () => openAddOperatorModal());
    };

    const setupClientListEventListeners = () => {
        // CORREÇÃO: Pegar o elemento depois que o HTML é renderizado
        const openAddClientModalBtn = document.getElementById('openAddClientModalBtn');
        const openAddOperatorModalBtn = document.getElementById('openAddOperatorModalBtn'); // NOVO: Botão de adicionar operador

        if (openAddClientModalBtn) openAddClientModalBtn.addEventListener('click', () => openModal(addClientModal));
        // NOVO: Event listeners para o modal de adicionar funcionário (também na tela de clientes)
        if (openAddOperatorModalBtn) openAddOperatorModalBtn.addEventListener('click', () => openAddOperatorModal());
    };

    // Lógica do modal de adicionar cliente
    // CORREÇÃO: Adicionar verificação de existência para os elementos do modal
    if (closeAddClientModalBtn) {
        closeAddClientModalBtn.addEventListener('click', () => closeModal(addClientModal));
    }
    if (addClientBtn) {
        addClientBtn.addEventListener('click', async () => {
            const clientName = newClientNameInput.value.trim();
            if (!clientName) {
                showToast("O nome do cliente não pode ser vazio.", "error");
                return;
            }

            showSpinner(addClientModal);
            try {
                await addDoc(collection(db, 'clients'), {
                    name: clientName,
                    agronomistId: userId,
                     status: 'ativo',
                    isFavorite: false,
                    tier: 'standard',
                    enabledModules: {},
                    propertyCount: 0,
                    cultureCount: 0,
                    createdAt: serverTimestamp()
                });
                showToast("Cliente adicionado com sucesso!", "success");
                closeModal(addClientModal);
                newClientNameInput.value = '';
                if (currentView === 'dashboard') {
                    await loadAgronomoDashboardData();
                } else if (currentView === 'clients') {
                    await loadFullClientList();
                }
            } catch (error) {
                console.error("Erro ao adicionar cliente:", error);
                showToast("Erro ao adicionar cliente: " + error.message, "error");
            } finally {
                hideSpinner(addClientModal);
            }
        });
    }

    // Lógica do modal de adicionar tarefa
    // CORREÇÃO: Adicionar verificação de existência para os elementos do modal
    if (closeAddTaskModalBtn) {
        closeAddTaskModalBtn.addEventListener('click', () => closeModal(addTaskModal));
    }
    if (addClientTaskBtn) {
        addClientTaskBtn.addEventListener('click', async () => {
            const title = modalTaskTitle.value.trim();
            const description = modalTaskDescription.value.trim();
            const propertyId = modalTaskProperty.value;
            const plotId = modalTaskPlot.value;
            const dueDate = modalTaskDate.value; // Formato YYYY-MM-DD

            if (!title || !dueDate) {
                showToast("Título e Data de Realização são obrigatórios.", "error");
                return;
            }

            let targetClientId = null;
            if (propertyId) {
                const prop = currentProperties.find(p => p.id === propertyId);
                if (prop) {
                    targetClientId = prop.clientId;
                }
            } else if (currentClients.length > 0) {
                targetClientId = currentClients[0].id;
            }

            if (!targetClientId) {
                showToast("Não foi possível determinar o cliente para esta tarefa. Selecione uma propriedade.", "error");
                return;
            }

            showSpinner(addTaskModal);
            try {
                const newTask = {
                    title: title,
                    description: description,
                    dueDate: dueDate,
                    isCompleted: false,
                    createdAt: new Date(),
                    responsibleAgronomistId: userId, // O agrônomo que criou/atribuiu
                    propertyId: propertyId || null,
                    plotId: plotId || null,
                };

                await addDoc(collection(db, `clients/${targetClientId}/tasks`), newTask);
                showToast("Tarefa atribuída com sucesso!", "success");
                closeModal(addTaskModal);
                // Limpar formulário
                modalTaskTitle.value = '';
                modalTaskDescription.value = '';
                modalTaskProperty.value = '';
                modalTaskPlot.value = '';
                modalTaskDate.value = '';
                if (modalTaskPlot) modalTaskPlot.disabled = true;

                await loadPendingTasksSummary(currentClients.map(c => c.id)); // Recarrega as tarefas na dashboard
            } catch (error) {
                console.error("Erro ao adicionar tarefa:", error);
                showToast("Erro ao adicionar tarefa: " + error.message, "error");
            } finally {
                hideSpinner(addTaskModal);
            }
        });
    }

    async function openAddTaskModal() {
        // Popula o seletor de propriedades
        if (modalTaskProperty) modalTaskProperty.innerHTML = '<option value="">Nenhuma</option>';
        if (modalTaskPlot) modalTaskPlot.innerHTML = '<option value="">Nenhum</option>';
        if (modalTaskPlot) modalTaskPlot.disabled = true;
        
        currentProperties = []; // Limpa propriedades anteriores
        currentPlots = []; // Limpa talhões anteriores

        if (currentClients.length > 0) {
            for (const client of currentClients) {
                const propertiesQuery = query(collection(db, `clients/${client.id}/properties`), orderBy('name'));
                const propertiesSnapshot = await getDocs(propertiesQuery);
                propertiesSnapshot.forEach(doc => {
                    const propData = { id: doc.id, clientId: client.id, clientName: client.name, ...doc.data() };
                    currentProperties.push(propData);
                    if (modalTaskProperty) modalTaskProperty.innerHTML += `<option value="${propData.id}">${propData.name} (${client.name})</option>`;
                });
            }
        }

        // Listener para mudança na propriedade selecionada
        if (modalTaskProperty) {
            modalTaskProperty.onchange = async () => {
                const selectedPropertyId = modalTaskProperty.value;
                if (modalTaskPlot) modalTaskPlot.innerHTML = '<option value="">Nenhum</option>';
                if (modalTaskPlot) modalTaskPlot.disabled = true;
                currentPlots = []; // Limpa talhões anteriores

                if (selectedPropertyId) {
                    const selectedProperty = currentProperties.find(p => p.id === selectedPropertyId);
                    if (selectedProperty) {
                        const plotsQuery = query(collection(db, `clients/${selectedProperty.clientId}/properties/${selectedPropertyId}/plots`), orderBy('name'));
                        const plotsSnapshot = await getDocs(plotsQuery);
                        plotsSnapshot.forEach(doc => {
                            const plotData = { id: doc.id, ...doc.data() };
                            currentPlots.push(plotData);
                            if (modalTaskPlot) modalTaskPlot.innerHTML += `<option value="${plotData.id}">${plotData.name}</option>`;
                        });
                        if (modalTaskPlot) modalTaskPlot.disabled = false;
                    }
                }
            };
        }

        // Definir a data mínima para hoje
        if (modalTaskDate) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months start at 0!
            const dd = String(today.getDate()).padStart(2, '0');
            modalTaskDate.min = `${yyyy}-${mm}-${dd}`;
        }

        openModal(addTaskModal);
    }

    // NOVO: Lógica do modal de adicionar funcionário
    // CORREÇÃO: Adicionar verificação de existência para os elementos do modal
    if (closeAddOperatorModalBtn) {
        closeAddOperatorModalBtn.addEventListener('click', () => closeModal(addOperatorModal));
    }
    if (addOperatorForm) {
        addOperatorForm.addEventListener('submit', handleAddOperator);
    }

    async function openAddOperatorModal() {
        // Popula o seletor de clientes
        if (operatorClientSelect) operatorClientSelect.innerHTML = '<option value="">Selecione uma fazenda...</option>';
        if (currentClients.length > 0) {
            currentClients.forEach(client => {
                if (operatorClientSelect) operatorClientSelect.innerHTML += `<option value="${client.id}">${client.name}</option>`;
            });
            if (operatorClientSelect) operatorClientSelect.disabled = false;
        } else {
            if (operatorClientSelect) operatorClientSelect.innerHTML = '<option value="">Nenhum cliente disponível</option>';
            if (operatorClientSelect) operatorClientSelect.disabled = true;
        }
        openModal(addOperatorModal);
    }

    async function handleAddOperator(e) {
        e.preventDefault();
        const name = newOperatorNameInput.value.trim();
        const email = newOperatorEmailInput.value.trim();
        const password = newOperatorPasswordInput.value.trim();
        const farmClientId = operatorClientSelect.value;

        if (!name || !email || !password || !farmClientId) {
            showToast("Por favor, preencha todos os campos.", "error");
            return;
        }

        if (password.length < 6) {
            showToast("A senha deve ter pelo menos 6 caracteres.", "error");
            return;
        }

        showSpinner(addOperatorModal);
        try {
            // 1. Criar usuário no Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Salvar dados do usuário no Firestore com o papel 'operador' e o farmClientId
            await setDoc(doc(db, 'users', user.uid), {
                name: name,
                email: email,
                role: 'operador',
                farmClientId: farmClientId,
                createdAt: new Date(),
                createdByAgronomistId: userId // Opcional: registrar quem criou
            });

            showToast("Funcionário adicionado com sucesso!", "success");
            closeModal(addOperatorModal);
            // Limpar formulário
            if (addOperatorForm) addOperatorForm.reset();
            if (operatorClientSelect) operatorClientSelect.innerHTML = '<option value="">Carregando clientes...</option>'; // Reseta para carregar novamente
        } catch (error) {
            console.error("Erro ao adicionar funcionário:", error);
            let errorMessage = "Erro ao adicionar funcionário.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Este email já está em uso.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Formato de email inválido.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "A senha é muito fraca. Use pelo menos 6 caracteres.";
            }
            showToast(errorMessage, "error");
        } finally {
            hideSpinner(addOperatorModal);
        }
    }

    // Inicializa os event listeners e carrega o conteúdo inicial
    setupEventListeners();
    // CORREÇÃO: Chamar renderDashboardContent() para iniciar a dashboard
    renderDashboardContent();
}