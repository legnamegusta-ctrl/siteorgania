// public/js/pages/agenda.js

import { db, auth } from '../config/firebase.js';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc, getDoc, updateDoc, collectionGroup } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { showSpinner, hideSpinner, showToast } from '../services/ui.js';
import { setupNotifications } from '../services/notifications.js';

console.log('agenda.js carregado');

let currentUser = null;
let calendar = null;
let activeClientFilter = null;
let unsubscribeTasks = null;

// Declara variáveis para os elementos DOM, mas NÃO inicializá-las aqui.
// Elas serão inicializadas dentro da função initAgenda.
let clientSearchInput;
let clientSuggestionsDiv;
let activeClientFilterDiv;
let clientNameDisplay;
let clearClientFilterBtn;
let backBtn;
let filterTasksSelect;

// A função initAgenda é o ponto de entrada para esta página.
// Ela é chamada por auth.js APÓS o DOMContentLoaded e após a autenticação.
export async function initAgenda(uid, userRole) {
    console.log('initAgenda: Usuário logado. UID:', uid, 'Papel:', userRole);
    currentUser = { uid, userRole };
    showSpinner();

    // Inicializa os elementos DOM aqui dentro da função, garantindo que eles já existem.
    clientSearchInput = document.getElementById('clientSearchInput');
    clientSuggestionsDiv = document.getElementById('clientSuggestions');
    activeClientFilterDiv = document.getElementById('activeClientFilter');
    clientNameDisplay = document.getElementById('clientNameDisplay');
    clearClientFilterBtn = document.getElementById('clearClientFilterBtn');
    backBtn = document.getElementById('backBtn');
    filterTasksSelect = document.getElementById('filterTasksSelect');

    // Garante que o usuário está autenticado e o papel está definido antes de prosseguir
    if (!currentUser || !currentUser.userRole) {
        console.error('initAgenda: Usuário não autenticado ou papel não definido.');
        hideSpinner();
        window.location.href = 'index.html';
        return;
    }

    // Configura os eventos dos elementos DOM
    setupAgendaEventListeners();

    if (currentUser.userRole === 'agronomo' || currentUser.userRole === 'admin') {
        console.log('Usuário é agrônomo ou admin. Inicializando agenda.');
        checkCalendarElementAndInit();
        setupClientSearch();
    } else if (currentUser.userRole === 'cliente') {
        console.log('Usuário é cliente. Adaptando visualização.');
        if (clientSearchInput) clientSearchInput.classList.add('hidden');
        if (activeClientFilterDiv) activeClientFilterDiv.classList.add('hidden');
        if (filterTasksSelect) filterTasksSelect.classList.add('hidden');
        await setActiveClientFilter(currentUser.uid, 'Minhas Propriedades');
        checkCalendarElementAndInit();
    } else {
        console.error('initAgenda: Papel de usuário desconhecido:', currentUser.userRole);
        showToast('Erro: Papel de usuário desconhecido.', 'error');
        hideSpinner();
        return;
    }

    hideSpinner();
}

// Mova todos os event listeners para uma função que é chamada APÓS os elementos estarem prontos
function setupAgendaEventListeners() {
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            history.back();
        });
    }

    if (filterTasksSelect) {
        filterTasksSelect.addEventListener('change', loadTasksForCalendar);
    }

    if (clientSearchInput) {
        clientSearchInput.addEventListener('input', debounceSearchClients);
    }

    if (clearClientFilterBtn) {
        clearClientFilterBtn.addEventListener('click', () => {
            activeClientFilter = null;
            activeClientFilterDiv.classList.add('hidden');
            clientNameDisplay.textContent = '';
            loadTasksForCalendar();
        });
    }

    document.addEventListener('click', (event) => {
        if (clientSuggestionsDiv && !clientSuggestionsDiv.contains(event.target) && clientSearchInput && !clientSearchInput.contains(event.target)) {
            clientSuggestionsDiv.classList.add('hidden');
        }
    });
}


async function checkCalendarElementAndInit() {
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
        console.log('initAgenda: Elemento #calendar encontrado. Inicializando FullCalendar.');

        if (calendar) {
            calendar.destroy();
        }

        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'pt-br',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            },
            buttonText: {
                today: 'Hoje',
                month: 'Mês',
                week: 'Semana',
                day: 'Dia',
                list: 'Lista'
            },
            events: async (fetchInfo, successCallback, failureCallback) => {
                showSpinner();
                try {
                    const tasks = await fetchTasksForCalendar(fetchInfo.start, fetchInfo.end);
                    successCallback(tasks);
                } catch (error) {
                    console.error('Erro ao buscar eventos do calendário:', error);
                    showToast('Erro ao carregar tarefas: ' + error.message, 'error');
                    failureCallback(error);
                } finally {
                    hideSpinner();
                }
            },
            eventClick: function(info) {
                showTaskModal(info.event);
            },
            dateClick: function(info) {
                showAddTaskModal(info.dateStr);
            }
        });
        calendar.render();
    } else {
        console.log('initAgenda: Elemento #calendar não encontrado. Tentando novamente em 100ms.');
        setTimeout(checkCalendarElementAndInit, 100);
    }
}

function showTaskModal(event) {
    const modal = document.getElementById('taskModal');
    const modalTitle = document.getElementById('taskModalTitle');
    const modalDescription = document.getElementById('taskModalDescription');
    const modalClient = document.getElementById('taskModalClient');
    const modalProperty = document.getElementById('taskModalProperty');
    const modalPlot = document.getElementById('taskModalPlot');
    const modalDate = document.getElementById('taskModalDate');
    const modalStatus = document.getElementById('taskModalStatus');
    const modalType = document.getElementById('taskModalType');
    const completeTaskBtn = document.getElementById('completeTaskBtn');
    const editTaskBtn = document.getElementById('editTaskBtn');
    const deleteTaskBtn = document.getElementById('deleteTaskBtn');

    if (modal && modalTitle && modalDescription && modalClient && modalProperty && modalPlot && modalDate && modalStatus && modalType && completeTaskBtn && editTaskBtn && deleteTaskBtn) {
        modalTitle.textContent = event.title;
        modalDescription.textContent = event.extendedProps.description || 'Nenhuma descrição.';
        modalClient.textContent = event.extendedProps.clientName || 'N/A';
        modalProperty.textContent = event.extendedProps.propertyName || 'N/A';
        modalPlot.textContent = event.extendedProps.plotName || 'N/A';
        modalDate.textContent = event.start ? new Date(event.start).toLocaleString() : 'N/A';
        modalStatus.textContent = event.extendedProps.status || 'N/A';
        modalType.textContent = event.extendedProps.type || 'N/A';

        if (event.extendedProps.status === 'Pendente') {
            completeTaskBtn.classList.remove('hidden');
            completeTaskBtn.onclick = async () => {
                showSpinner();
                try {
                    const taskRef = doc(db, 'tasks', event.id);
                    await updateDoc(taskRef, { status: 'Concluída' });
                    showToast('Tarefa marcada como concluída!', 'success');
                    modal.classList.add('hidden');
                } catch (error) {
                    console.error('Erro ao concluir tarefa:', error);
                    showToast('Erro ao concluir tarefa: ' + error.message, 'error');
                } finally {
                    hideSpinner();
                }
            };
        } else {
            completeTaskBtn.classList.add('hidden');
        }

        editTaskBtn.onclick = () => {
            window.location.href = `task-viewer.html?taskId=${event.id}&edit=true`;
        };

        deleteTaskBtn.onclick = async () => {
            if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
                showSpinner();
                try {
                    // await deleteDoc(doc(db, 'tasks', event.id));
                    showToast('Tarefa excluída com sucesso!', 'success');
                    modal.classList.add('hidden');
                } catch (error) {
                    console.error('Erro ao excluir tarefa:', error);
                    showToast('Erro ao excluir tarefa: ' + error.message, 'error');
                } finally {
                    hideSpinner();
                }
            }
        };


        modal.classList.remove('hidden');
    } else {
        console.error('Um ou mais elementos do modal de tarefa não foram encontrados.');
        showToast('Erro ao exibir detalhes da tarefa.', 'error');
    }
}

function showAddTaskModal(dateStr) {
    const modal = document.getElementById('addTaskModal');
    const taskDateInput = document.getElementById('addTaskDate');
    const saveTaskBtn = document.getElementById('saveTaskBtn');
    const taskTypeSelect = document.getElementById('addTaskType');
    const taskTitleInput = document.getElementById('addTaskTitle');
    const taskDescriptionInput = document.getElementById('addTaskDescription');

    if (modal && taskDateInput && saveTaskBtn && taskTypeSelect && taskTitleInput && taskDescriptionInput) {
        taskDateInput.value = dateStr;
        modal.classList.remove('hidden');

        saveTaskBtn.onclick = async () => {
            const type = taskTypeSelect.value;
            const title = taskTitleInput.value;
            const description = taskDescriptionInput.value;

            if (!type || !title || !dateStr) {
                showToast('Por favor, preencha todos os campos obrigatórios (Tipo, Título, Data).', 'error');
                return;
            }

            showSpinner();
            try {
                const newTask = {
                    title: title,
                    description: description,
                    type: type,
                    date: new Date(dateStr),
                    status: 'Pendente',
                    responsibleId: currentUser.uid,
                    clientId: activeClientFilter ? activeClientFilter.id : null,
                    clientName: activeClientFilter ? activeClientFilter.data().name : null,
                    createdAt: new Date()
                };

                // await addDoc(collection(db, 'tasks'), newTask);
                showToast('Tarefa adicionada com sucesso!', 'success');
                modal.classList.add('hidden');
                taskTitleInput.value = '';
                taskDescriptionInput.value = '';
                taskTypeSelect.value = '';
            } catch (error) {
                console.error('Erro ao adicionar tarefa:', error);
                showToast('Erro ao adicionar tarefa: ' + error.message, 'error');
            } finally {
                hideSpinner();
            }
        };
    } else {
        console.error('Um ou mais elementos do modal de adicionar tarefa não foram encontrados.');
        showToast('Erro ao exibir modal de adicionar tarefa.', 'error');
    }
}


document.querySelectorAll('.close-modal-btn').forEach(button => {
    button.addEventListener('click', (event) => {
        event.target.closest('.modal').classList.add('hidden');
    });
});


async function fetchTasksForCalendar(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);

    let tasksQuery;
    const tasksCollection = collection(db, 'tasks');

    if (currentUser.userRole === 'admin') {
        tasksQuery = query(
            tasksCollection,
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc')
        );
    } else if (currentUser.userRole === 'agronomo') {
        tasksQuery = query(
            tasksCollection,
            where('responsibleId', '==', currentUser.uid),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc')
        );
    } else if (currentUser.userRole === 'cliente' && activeClientFilter && activeClientFilter.id) {
        tasksQuery = query(
            tasksCollection,
            where('clientId', '==', activeClientFilter.id),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc')
        );
    } else {
        return [];
    }

    if (activeClientFilter && activeClientFilter.id && (currentUser.userRole === 'agronomo' || currentUser.userRole === 'admin')) {
        tasksQuery = query(tasksQuery, where('clientId', '==', activeClientFilter.id));
    }


    if (filterTasksSelect && filterTasksSelect.value && filterTasksSelect.value !== 'all') {
        tasksQuery = query(tasksQuery, where('status', '==', filterTasksSelect.value));
    }

    if (unsubscribeTasks) {
        unsubscribeTasks();
    }

    return new Promise((resolve, reject) => {
        unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
            const tasks = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: data.title,
                    start: data.date.toDate(),
                    extendedProps: {
                        description: data.description,
                        status: data.status,
                        type: data.type,
                        clientId: data.clientId,
                        clientName: data.clientName,
                        propertyId: data.propertyId,
                        propertyName: data.propertyName,
                        plotId: data.plotId,
                        plotName: data.plotName,
                        responsibleId: data.responsibleId
                    },
                    color: data.status === 'Concluída' ? '#4CAF50' :
                        data.status === 'Pendente' ? '#FFC107' :
                            '#2196F3'
                };
            });
            console.log('Tarefas carregadas para o calendário:', tasks);
            resolve(tasks);
        }, (error) => {
            console.error('Erro em tempo real ao carregar tarefas:', error);
            reject(error);
        });
    });
}

function loadTasksForCalendar() {
    if (calendar) {
        calendar.refetchEvents();
    }
}

async function setupClientSearch() {
    if (currentUser.userRole === 'cliente') {
        if (clientSearchInput) clientSearchInput.classList.add('hidden');
        if (clientSuggestionsDiv) clientSuggestionsDiv.classList.add('hidden');
        if (activeClientFilterDiv) activeClientFilterDiv.classList.add('hidden');
        return;
    }

    console.log('setupClientSearch: Configurando busca de clientes.');
    if (!clientSearchInput || !clientSuggestionsDiv || !activeClientFilterDiv || !clientNameDisplay || !clearClientFilterBtn) {
        console.warn('Elementos de busca de cliente não encontrados. A funcionalidade pode não funcionar.');
        return;
    }

    let searchTimeout;

    clientSearchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const searchTerm = clientSearchInput.value.trim();
            if (searchTerm.length > 2) {
                await searchClients(searchTerm);
            } else {
                clientSuggestionsDiv.innerHTML = '';
                clientSuggestionsDiv.classList.add('hidden');
            }
        }, 300);
    });

    async function searchClients(searchTerm) {
        showSpinner();
        try {
            const clientsRef = collection(db, 'clients');
            const q = query(
                clientsRef,
                orderBy('name'),
                where('name', '>=', searchTerm),
                where('name', '<=', searchTerm + '\uf8ff')
            );
            const querySnapshot = await getDocs(q);

            clientSuggestionsDiv.innerHTML = '';
            if (querySnapshot.empty) {
                clientSuggestionsDiv.innerHTML = '<p class="px-4 py-2 text-gray-500">Nenhum cliente encontrado.</p>';
                clientSuggestionsDiv.classList.remove('hidden');
                return;
            }

            querySnapshot.forEach(doc => {
                const client = doc.data();
                const item = document.createElement('div');
                item.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200 text-sm';
                item.textContent = client.name;
                item.addEventListener('click', () => {
                    setActiveClientFilter(doc.id, client.name);
                    clientSuggestionsDiv.classList.add('hidden');
                });
                clientSuggestionsDiv.appendChild(item);
            });
            clientSuggestionsDiv.classList.remove('hidden');

        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
            showToast('Erro ao buscar clientes: ' + error.message, 'error');
        } finally {
            hideSpinner();
        }
    }


    document.addEventListener('click', (event) => {
        if (clientSuggestionsDiv && !clientSuggestionsDiv.contains(event.target) && clientSearchInput && !clientSearchInput.contains(event.target)) {
            clientSuggestionsDiv.classList.add('hidden');
        }
    });

    clearClientFilterBtn.addEventListener('click', () => {
        activeClientFilter = null;
        activeClientFilterDiv.classList.add('hidden');
        clientNameDisplay.textContent = '';
        loadTasksForCalendar();
    });
}

async function setActiveClientFilter(clientId, clientName) {
    console.log('setActiveClientFilter: Definindo cliente ativo:', clientName, '(', clientId, ')');
    showSpinner();
    try {
        const clientDocRef = doc(db, 'clients', clientId);
        const clientDocSnap = await getDoc(clientDocRef);
        if (clientDocSnap.exists()) {
            activeClientFilter = clientDocSnap;
            clientNameDisplay.textContent = clientName;
            activeClientFilterDiv.classList.remove('hidden');
            clientSearchInput.value = '';
            loadTasksForCalendar();
        } else {
            console.error('Cliente selecionado não encontrado:', clientId);
            showToast('Erro: Cliente não encontrado.', 'error');
            activeClientFilter = null;
            activeClientFilterDiv.classList.add('hidden');
            clientNameDisplay.textContent = '';
        }
    } catch (error) {
        console.error('Erro ao definir filtro de cliente ativo:', error);
        showToast('Erro ao definir filtro de cliente: ' + error.message, 'error');
    } finally {
        hideSpinner();
    }
}