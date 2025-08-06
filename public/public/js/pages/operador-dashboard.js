// js/pages/operador-dashboard.js

import { db } from '../config/firebase.js';
import { showSpinner, hideSpinner, showToast, openModal, closeModal } from '../services/ui.js';
// Adicionado imports necessários para Firestore V9, incluindo 'limit'
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, limit } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

export function initOperadorDashboard(userId, userRole) {
    const welcomeMessage = document.getElementById('welcomeMessage');
    const summaryMessage = document.getElementById('summaryMessage');
    
    // Elementos dos botões de ação na página principal
    const openQuickActivityModalBtn = document.getElementById('openQuickActivityModalBtn');
    const openScheduleTaskModalBtn = document.getElementById('openScheduleTaskModalBtn');
    
    // Elementos do Registro Rápido de Atividade (Modal)
    const quickActivityModal = document.getElementById('quickActivityModal');
    const closeQuickActivityModalBtn = document.getElementById('closeQuickActivityModalBtn');
    const activityDescriptionInput = document.getElementById('activityDescription');
    const activityPropertySelect = document.getElementById('activityPropertySelect');
    const activityPlotSelect = document.getElementById('activityPlotSelect');
    const activityPhotoInput = document.getElementById('activityPhotoInput');
    const registerActivityBtn = document.getElementById('registerActivityBtn');

    // Elementos do Agendamento de Tarefas (NOVO MODAL)
    const scheduleTaskModal = document.getElementById('scheduleTaskModal');
    const closeScheduleTaskModalBtn = document.getElementById('closeScheduleTaskModalBtn');
    const taskTitleInput = document.getElementById('taskTitle');
    const taskDescriptionInput = document.getElementById('taskDescription');
    const taskDueDateInput = document.getElementById('taskDueDate');
    const taskPropertySelect = document.getElementById('taskPropertySelect');
    const taskPlotSelect = document.getElementById('taskPlotSelect');
    const scheduleTaskSubmitBtn = document.getElementById('scheduleTaskSubmitBtn');

    const filterStatusOperador = document.getElementById('filterStatusOperador');
    const filterPropertyOperador = document.getElementById('filterPropertyOperador');
    const filterPlotOperador = document.getElementById('filterPlotOperador');
    const operatorTasksList = document.getElementById('operatorTasksList');

    const operatorTaskModal = document.getElementById('operatorTaskModal');
    const modalTaskTitleDisplay = document.getElementById('modalTaskTitleDisplay');
    const modalTaskClientName = document.getElementById('modalTaskClientName');
    const modalTaskPropertyName = document.getElementById('modalTaskPropertyName');
    const modalTaskPlotName = document.getElementById('modalTaskPlotName');
    const modalTaskType = document.getElementById('modalTaskType');
    const modalTaskDueDate = document.getElementById('modalTaskDueDate');
    const modalTaskDescription = document.getElementById('modalTaskDescription');
    const modalTaskStatus = document.getElementById('modalTaskStatus');
    const closeOperatorTaskModalBtn = document.getElementById('closeOperatorTaskModalBtn');
    const completeOperatorTaskBtn = document.getElementById('completeOperatorTaskBtn');

    let allOperatorTasks = [];
    let currentOperatorProperties = []; // Para popular o filtro de propriedades
    let currentOperatorPlots = [];     // Para popular o filtro de talhões
    let farmClientId = null; // Mover farmClientId para um escopo acessível globalmente na função
    let farmClientName = 'N/A';
    let currentUserData = null;


    const loadOperadorDashboard = async () => {
        if (!userId) {
            if (welcomeMessage) welcomeMessage.textContent = 'Erro: Usuário não identificado.';
            return;
        }

        if (operatorTasksList) showSpinner(operatorTasksList);

        try {
            const userDocRef = doc(collection(db, 'users'), userId);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                currentUserData = userData; // Salva os dados do usuário para uso posterior
                if (welcomeMessage) welcomeMessage.textContent = `Bem-vindo(a), ${userData.name ? userData.name.split(' ')[0] : 'Operador(a)'}!`;
                farmClientId = userData.farmClientId; // Atribui o valor aqui
            } else {
                if (summaryMessage) summaryMessage.textContent = 'Dados do usuário não encontrados no Firestore.';
                if (operatorTasksList) hideSpinner(operatorTasksList);
                if (operatorTasksList) operatorTasksList.innerHTML = '<p class="text-red-500 text-center py-4">Erro: Dados do usuário não encontrados.</p>';
                return;
            }
            
            if (!farmClientId) {
                if (summaryMessage) summaryMessage.textContent = 'Você não está vinculado a nenhuma fazenda. Por favor, contate o administrador.';
                if (operatorTasksList) hideSpinner(operatorTasksList);
                if (operatorTasksList) operatorTasksList.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma tarefa atribuída. Contate seu gestor.</p>';
                return;
            }

            // Busca nome do cliente da fazenda
            const clientDoc = await getDoc(doc(collection(db, 'clients'), farmClientId));
            if (clientDoc.exists()) {
                farmClientName = clientDoc.data().name;
            }

            // Buscar todas as propriedades da fazenda vinculada para os filtros E para os modais
            await fetchAndPopulateAllPropertySelects(farmClientId);

            // Carregar e exibir as tarefas iniciais (pendentes por padrão)
            await fetchAndDisplayTasks(farmClientId);

            setupEventListeners(farmClientId);

        } catch (error) {
            console.error("Erro ao carregar o painel do operador:", error);
            if (operatorTasksList) hideSpinner(operatorTasksList);
            if (welcomeMessage) welcomeMessage.textContent = 'Erro ao carregar';
            if (summaryMessage) summaryMessage.textContent = 'Não foi possível buscar suas tarefas.';
            showToast("Erro ao carregar o painel. Recarregue a página.", "error");
        }
    };
    
    // NOVA FUNÇÃO: Busca propriedades e popula todos os selects de uma vez
    async function fetchAndPopulateAllPropertySelects(farmClientId) {
        try {
            const propertiesQuery = query(collection(db, `clients/${farmClientId}/properties`), orderBy('name'));
            const propertiesSnapshot = await getDocs(propertiesQuery);
            currentOperatorProperties = propertiesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

            // Popula todos os selects de propriedade
            const allPropertySelects = [filterPropertyOperador, activityPropertySelect, taskPropertySelect];
            allPropertySelects.forEach(selectEl => {
                if (selectEl) {
                    const defaultOptionText = selectEl.id === 'filterPropertyOperador' ? 'Todas as Propriedades' : 'Selecione a Propriedade';
                    selectEl.innerHTML = `<option value="">${defaultOptionText}</option>`;
                    currentOperatorProperties.forEach(prop => {
                        selectEl.innerHTML += `<option value="${prop.id}">${prop.name}</option>`;
                    });
                }
            });

            // Adiciona listeners aos selects de propriedade para popular os de talhão
            setupPropertySelectListeners(farmClientId);

        } catch (error) {
            console.error("Erro ao popular selects de propriedade:", error);
            showToast("Erro ao carregar propriedades.", "error");
        }
    }
    
    // NOVA FUNÇÃO: Adiciona os listeners para os selects de propriedade
    function setupPropertySelectListeners(farmClientId) {
        if (filterPropertyOperador && !filterPropertyOperador._hasFilterListener) {
            filterPropertyOperador.addEventListener('change', async () => {
                const selectedPropId = filterPropertyOperador.value;
                await populatePlotFilter(farmClientId, selectedPropId);
                await fetchAndDisplayTasks(farmClientId);
            });
            filterPropertyOperador._hasFilterListener = true;
        }

        if (activityPropertySelect && !activityPropertySelect._hasActivityListener) {
            activityPropertySelect.addEventListener('change', async () => {
                const selectedPropId = activityPropertySelect.value;
                await populateActivityPlotSelect(farmClientId, selectedPropId);
            });
            activityPropertySelect._hasActivityListener = true;
        }

        if (taskPropertySelect && !taskPropertySelect._hasTaskListener) {
            taskPropertySelect.addEventListener('change', async () => {
                const selectedPropId = taskPropertySelect.value;
                await populateTaskPlotSelect(farmClientId, selectedPropId);
            });
            taskPropertySelect._hasTaskListener = true;
        }

        // Listeners para os outros filtros (status e plot)
        if (filterStatusOperador && !filterStatusOperador._hasStatusListener) {
            filterStatusOperador.addEventListener('change', () => fetchAndDisplayTasks(farmClientId));
            filterStatusOperador._hasStatusListener = true;
        }
        if (filterPlotOperador && !filterPlotOperador._hasPlotListener) {
            filterPlotOperador.addEventListener('change', () => fetchAndDisplayTasks(farmClientId));
            filterPlotOperador._hasPlotListener = true;
        }
    }

    // Popula o seletor de talhões no modal de Registro Rápido
    async function populateActivityPlotSelect(farmClientId, propertyId) {
        if (!activityPlotSelect) return;
        activityPlotSelect.innerHTML = '<option value="">Nenhum</option>';
        activityPlotSelect.disabled = true;
        if (!propertyId) return;
        try {
            const plotsQuery = query(collection(db, `clients/${farmClientId}/properties/${propertyId}/plots`), orderBy('name'));
            const plotsSnapshot = await getDocs(plotsQuery);
            plotsSnapshot.forEach(docSnap => {
                activityPlotSelect.innerHTML += `<option value="${docSnap.id}">${docSnap.data().name}</option>`;
            });
            activityPlotSelect.disabled = false;
        } catch (error) {
            console.error("Erro ao popular seletor de talhão para registro de atividade:", error);
            showToast("Erro ao carregar talhões para registro.", "error");
        }
    }

    // Popula o seletor de talhões no modal de Agendamento de Tarefa
    async function populateTaskPlotSelect(farmClientId, propertyId) {
        if (!taskPlotSelect) return;
        taskPlotSelect.innerHTML = '<option value="">Selecione o Talhão</option>';
        taskPlotSelect.disabled = true;
        if (!propertyId) return;
        try {
            const plotsQuery = query(collection(db, `clients/${farmClientId}/properties/${propertyId}/plots`), orderBy('name'));
            const plotsSnapshot = await getDocs(plotsQuery);
            plotsSnapshot.forEach(docSnap => {
                taskPlotSelect.innerHTML += `<option value="${docSnap.id}">${docSnap.data().name}</option>`;
            });
            taskPlotSelect.disabled = false;
        } catch (error) {
            console.error("Erro ao popular seletor de talhão para agendamento de tarefa:", error);
            showToast("Erro ao carregar talhões para agendamento.", "error");
        }
    }


    async function populatePlotFilter(farmClientId, propertyId) {
        if (!filterPlotOperador) return;
        filterPlotOperador.innerHTML = '<option value="">Todos os Talhões</option>';
        filterPlotOperador.disabled = true;
        currentOperatorPlots = [];

        if (!propertyId) return;

        try {
            const plotsQuery = query(collection(db, `clients/${farmClientId}/properties/${propertyId}/plots`), orderBy('name'));
            const plotsSnapshot = await getDocs(plotsQuery);

            plotsSnapshot.forEach(docSnap => {
                currentOperatorPlots.push({ id: docSnap.id, name: docSnap.data().name });
                filterPlotOperador.innerHTML += `<option value="${docSnap.id}">${docSnap.data().name}</option>`;
            });
            filterPlotOperador.disabled = false;

        } catch (error) {
            console.error("Erro ao popular filtro de talhão:", error);
            showToast("Não foi possível carregar os talhões.", "error");
        }
    }

    async function fetchAndDisplayTasks(farmClientId) {
        if (operatorTasksList) showSpinner(operatorTasksList);

        const selectedStatus = filterStatusOperador ? filterStatusOperador.value : 'pending';
        const selectedProperty = filterPropertyOperador ? filterPropertyOperador.value : '';
        // CORREÇÃO: Corrigido o nome da variável
        const selectedPlot = filterPlotOperador ? filterPlotOperador.value : '';

        let tasksQuery = query(
            collection(db, `clients/${farmClientId}/tasks`),
            orderBy('dueDate')
        );

        if (selectedStatus === 'pending') {
            tasksQuery = query(tasksQuery, where('isCompleted', '==', false));
        } else if (selectedStatus === 'completed') {
            tasksQuery = query(tasksQuery, where('isCompleted', '==', true));
        }
        
        if (selectedProperty) {
            tasksQuery = query(tasksQuery, where('propertyId', '==', selectedProperty));
        }
        if (selectedPlot) {
            tasksQuery = query(tasksQuery, where('plotId', '==', selectedPlot));
        }
        
        try {
            const snapshot = await getDocs(tasksQuery);
            let tasks = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

            allOperatorTasks = tasks;
            renderTasks(tasks);

        } catch (error) {
            console.error("Erro ao buscar e exibir tarefas do operador:", error);
            showToast("Erro ao carregar suas tarefas.", "error");
            if (operatorTasksList) operatorTasksList.innerHTML = '<p class="text-red-500 text-center py-4">Erro ao carregar tarefas.</p>';
        } finally {
            if (operatorTasksList) hideSpinner(operatorTasksList);
        }
    }

    async function renderTasks(tasksToRender) {
        if (!operatorTasksList) return;
        operatorTasksList.innerHTML = '';
        if (tasksToRender.length === 0) {
            operatorTasksList.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma tarefa encontrada com os filtros selecionados.</p>';
            return;
        }

        // Mapear nomes de propriedades e talhões para exibição
        const propertyNamesMap = new Map(currentOperatorProperties.map(p => [p.id, p.name]));
        
        const allPlotsPromises = currentOperatorProperties.map(prop => 
            getDocs(query(collection(db, `clients/${farmClientId}/properties/${prop.id}/plots`)))
        );
        const allPlotsSnapshots = await Promise.all(allPlotsPromises);
        let fullPlotNamesMap = new Map();
        allPlotsSnapshots.forEach(snapshot => {
            snapshot.forEach(docSnap => {
                fullPlotNamesMap.set(docSnap.id, docSnap.data().name);
            });
        });

        for (const task of tasksToRender) {
            const dueDate = new Date(task.dueDate + 'T12:00:00');
            const formattedDate = dueDate.toLocaleDateString('pt-BR');
            const isOverdue = !task.isCompleted && dueDate < new Date();
            
            const propertyName = task.propertyId ? propertyNamesMap.get(task.propertyId) || 'Desconhecida' : 'N/A';
            const plotName = task.plotId ? fullPlotNamesMap.get(task.plotId) || 'Desconhecido' : 'N/A';
            
            const priority = task.priority || 'Normal';
            let priorityColorClass = '';
            if (priority === 'Alta') {
                priorityColorClass = 'text-red-600 font-semibold';
            } else if (priority === 'Média') {
                priorityColorClass = 'text-yellow-600';
            }

            const showExecuteButton = !task.isCompleted && task.status === 'Pendente';
            const executeButtonClass = showExecuteButton ? '' : 'hidden';
            
            operatorTasksList.innerHTML += `
                <div class="bg-white p-4 rounded-lg shadow-md border border-gray-200 task-item" data-task-id="${task.id}" data-is-completed="${task.isCompleted}" data-task-status="${task.status}">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-bold text-lg ${task.isCompleted ? 'line-through text-gray-500' : 'text-gray-800'}">${task.title}</h4>
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${task.isCompleted ? 'bg-green-100 text-green-800' : (task.status === 'Em Andamento' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800')}">
                            ${task.isCompleted ? 'Concluída' : (task.status || 'Pendente')}
                        </span>
                    </div>
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                        <div><span class="font-semibold">Propriedade:</span> ${propertyName}</div>
                        <div><span class="font-semibold">Talhão:</span> ${plotName}</div>
                        <div><span class="font-semibold">Vencimento:</span> ${formattedDate} ${isOverdue ? '<span class="text-red-500">(Atrasada)</span>' : ''}</div>
                        <div><span class="font-semibold">Prioridade:</span> <span class="${priorityColorClass}">${priority}</span></div>
                    </div>
                    <p class="text-gray-700 text-sm mb-3">${task.description || 'Nenhuma descrição.'}</p>
                    <div class="flex justify-end gap-2">
                        <button class="px-3 py-1 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 text-sm execute-task-btn ${executeButtonClass}">
                            <i class="fas fa-play-circle mr-1"></i> Executar
                        </button>
                        <button class="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm view-task-details-btn">
                            <i class="fas fa-eye mr-1"></i> Ver Detalhes
                        </button>
                    </div>
                </div>
            `;
        }
    }

    async function handleRegisterActivity() {
        const description = activityDescriptionInput ? activityDescriptionInput.value.trim() : '';
        const propertyId = activityPropertySelect ? activityPropertySelect.value : '';
        const plotId = activityPlotSelect ? activityPlotSelect.value : '';
        const photoLinks = activityPhotoInput ? activityPhotoInput.value.trim().split('\n').filter(link => link) : [];

        if (!description) {
            showToast("A descrição da atividade é obrigatória.", "error");
            return;
        }
        if (!farmClientId) {
            showToast("Erro: Operador não vinculado a uma fazenda.", "error");
            return;
        }
        if (!propertyId || !plotId) {
            showToast("Selecione uma propriedade E um talhão para registrar a atividade.", "error");
            return;
        }

        if (registerActivityBtn) {
            registerActivityBtn.disabled = true;
            registerActivityBtn.textContent = 'Registrando...';
        }

        try {
            const registeredByName = currentUserData.name || 'Operador Desconhecido';

            let cultureId = null;
            const culturesQuery = query(collection(db, `clients/${farmClientId}/properties/${propertyId}/plots/${plotId}/culturas`), where('status', '==', 'ativo'), orderBy('startDate', 'desc'), limit(1));
            const culturesSnapshot = await getDocs(culturesQuery);
            if (!culturesSnapshot.empty) {
                cultureId = culturesSnapshot.docs[0].id;
            } else {
                showToast("Não foi encontrada uma cultura ativa para o talhão selecionado. Atividade não registrada.", "error");
                return;
            }

            const newManagement = {
                date: new Date().toISOString().split('T')[0],
                type: 'Atividade Geral',
                description: description,
                propertyId: propertyId,
                plotId: plotId,
                cultureId: cultureId,
                imageUrls: photoLinks,
                cost: 0,
                registeredBy: registeredByName,
                registeredById: userId,
                createdAt: serverTimestamp(),
                status: 'Concluída'
            };

            const managementCollectionRef = collection(db, `clients/${farmClientId}/properties/${propertyId}/plots/${plotId}/culturas/${cultureId}/managements`);
            await addDoc(managementCollectionRef, newManagement);
            
            showToast("Atividade registrada com sucesso!", "success");

            if (activityDescriptionInput) activityDescriptionInput.value = '';
            if (activityPropertySelect) activityPropertySelect.value = '';
            if (activityPlotSelect) activityPlotSelect.value = '';
            if (activityPhotoInput) activityPhotoInput.value = '';
            if (activityPlotSelect) activityPlotSelect.disabled = true;
            closeModal(quickActivityModal);

            await fetchAndDisplayTasks(farmClientId); 

        } catch (error) {
            console.error("Erro ao registrar atividade:", error);
            showToast("Erro ao registrar atividade: " + error.message, "error");
        } finally {
            if (registerActivityBtn) {
                registerActivityBtn.disabled = false;
                registerActivityBtn.textContent = 'Registrar Atividade';
            }
        }
    }

    async function handleScheduleTask() {
        const title = taskTitleInput ? taskTitleInput.value.trim() : '';
        const description = taskDescriptionInput ? taskDescriptionInput.value.trim() : '';
        const dueDate = taskDueDateInput ? taskDueDateInput.value : '';
        const propertyId = taskPropertySelect ? taskPropertySelect.value : '';
        const plotId = taskPlotSelect ? taskPlotSelect.value : '';

        if (!title || !dueDate || !propertyId || !plotId) {
            showToast("Título, data de vencimento, propriedade e talhão são obrigatórios para agendar uma tarefa.", "error");
            return;
        }
        if (!farmClientId) {
            showToast("Erro: Operador não vinculado a uma fazenda.", "error");
            return;
        }

        if (scheduleTaskSubmitBtn) {
            scheduleTaskSubmitBtn.disabled = true;
            scheduleTaskSubmitBtn.textContent = 'Agendando...';
        }

        try {
            const assignedByName = currentUserData.name || 'Operador Desconhecido';
            const newTask = {
                title: title,
                description: description,
                dueDate: dueDate,
                propertyId: propertyId,
                plotId: plotId,
                isCompleted: false,
                status: 'Pendente',
                assignedToId: userId,
                assignedToName: assignedByName,
                createdAt: serverTimestamp(),
                category: 'Geral',
                priority: 'Normal'
            };

            await addDoc(collection(db, `clients/${farmClientId}/tasks`), newTask);
            
            showToast("Tarefa agendada com sucesso!", "success");

            if (taskTitleInput) taskTitleInput.value = '';
            if (taskDescriptionInput) taskDescriptionInput.value = '';
            if (taskDueDateInput) taskDueDateInput.value = '';
            if (taskPropertySelect) taskPropertySelect.value = '';
            if (taskPlotSelect) taskPlotSelect.value = '';
            if (taskPlotSelect) taskPlotSelect.disabled = true;
            closeModal(scheduleTaskModal);

            await fetchAndDisplayTasks(farmClientId);

        } catch (error) {
            console.error("Erro ao agendar tarefa:", error);
            showToast("Erro ao agendar tarefa: " + error.message, "error");
        } finally {
            if (scheduleTaskSubmitBtn) {
                scheduleTaskSubmitBtn.disabled = false;
                scheduleTaskSubmitBtn.textContent = 'Agendar Tarefa';
            }
        }
    }


    function setupEventListeners(farmClientId) {
        if (operatorTasksList && !operatorTasksList._hasClickEvent) {
            operatorTasksList.addEventListener('click', (e) => {
                const viewDetailsBtn = e.target.closest('.view-task-details-btn');
                const executeTaskBtn = e.target.closest('.execute-task-btn');
                if (viewDetailsBtn) {
                    const taskId = viewDetailsBtn.closest('.task-item').dataset.taskId;
                    const task = allOperatorTasks.find(t => t.id === taskId);
                    if (task) {
                        openOperatorTaskModal(task, farmClientId);
                    }
                } else if (executeTaskBtn) {
                    const taskId = executeTaskBtn.closest('.task-item').dataset.taskId;
                    const task = allOperatorTasks.find(t => t.id === taskId);
                    if (task) {
                        handleExecuteTask(task, farmClientId);
                    }
                }
            });
            operatorTasksList._hasClickEvent = true;
        }

        if (closeOperatorTaskModalBtn && !closeOperatorTaskModalBtn._hasClickEvent) {
            closeOperatorTaskModalBtn.addEventListener('click', () => closeModal(operatorTaskModal));
            closeOperatorTaskModalBtn._hasClickEvent = true;
        }
        
        if (openQuickActivityModalBtn && !openQuickActivityModalBtn._hasClickListener) {
            openQuickActivityModalBtn.addEventListener('click', () => openModal(quickActivityModal));
            openQuickActivityModalBtn._hasClickListener = true;
        }
        if (closeQuickActivityModalBtn && !closeQuickActivityModalBtn._hasClickListener) {
            closeQuickActivityModalBtn.addEventListener('click', () => closeModal(quickActivityModal));
            closeQuickActivityModalBtn._hasClickListener = true;
        }
        if (registerActivityBtn && !registerActivityBtn._hasClickListener) {
            registerActivityBtn.addEventListener('click', handleRegisterActivity);
            registerActivityBtn._hasClickListener = true;
        }

        if (openScheduleTaskModalBtn && !openScheduleTaskModalBtn._hasClickListener) {
            openScheduleTaskModalBtn.addEventListener('click', () => openModal(scheduleTaskModal));
            openScheduleTaskModalBtn._hasClickListener = true;
        }
        if (closeScheduleTaskModalBtn && !closeScheduleTaskModalBtn._hasClickListener) {
            closeScheduleTaskModalBtn.addEventListener('click', () => closeModal(scheduleTaskModal));
            closeScheduleTaskModalBtn._hasClickListener = true;
        }
        if (scheduleTaskSubmitBtn && !scheduleTaskSubmitBtn._hasClickListener) {
            scheduleTaskSubmitBtn.addEventListener('click', handleScheduleTask);
            scheduleTaskSubmitBtn._hasClickListener = true;
        }
    }

    async function handleExecuteTask(task, farmClientId) {
        if (task.isCompleted || task.status === 'Em Andamento') {
            showToast("Esta tarefa já está em andamento ou concluída.", "info");
            return;
        }

        if (confirm(`Deseja marcar a tarefa "${task.title}" como "Em Andamento"?`)) {
            showSpinner(operatorTasksList);
            try {
                const taskRef = doc(collection(db, `clients/${farmClientId}/tasks`), task.id);
                await updateDoc(taskRef, { status: 'Em Andamento' });
                showToast('Tarefa marcada como "Em Andamento"!', 'info');
                await fetchAndDisplayTasks(farmClientId);
            } catch (error) {
                console.error("Erro ao marcar tarefa como 'Em Andamento':", error);
                showToast("Erro ao iniciar tarefa: " + error.message, "error");
            } finally {
                hideSpinner(operatorTasksList);
            }
        }
    }

    async function openOperatorTaskModal(task, farmClientId) {
        if (modalTaskTitleDisplay) modalTaskTitleDisplay.textContent = task.title || 'Detalhes da Tarefa';
        if (modalTaskClientName) modalTaskClientName.textContent = farmClientName;
        if (modalTaskPropertyName) modalTaskPropertyName.textContent = task.propertyId ? (currentOperatorProperties.find(p => p.id === task.propertyId)?.name || 'Desconhecida') : 'N/A';
        
        const allPlotsPromises = currentOperatorProperties.map(prop => 
            getDocs(query(collection(db, `clients/${farmClientId}/properties/${prop.id}/plots`)))
        );
        const allPlotsSnapshots = await Promise.all(allPlotsPromises);
        let fullPlotNamesMap = new Map();
        allPlotsSnapshots.forEach(snapshot => {
            snapshot.forEach(docSnap => {
                fullPlotNamesMap.set(docSnap.id, docSnap.data().name);
            });
        });
        if (modalTaskPlotName) modalTaskPlotName.textContent = task.plotId ? (fullPlotNamesMap.get(task.plotId) || 'Desconhecido') : 'N/A';
        
        if (modalTaskType) modalTaskType.textContent = task.type || 'Geral';
        if (modalTaskDueDate) modalTaskDueDate.textContent = new Date(task.dueDate + 'T12:00:00').toLocaleDateString('pt-BR');
        if (modalTaskDescription) modalTaskDescription.textContent = task.description || 'Nenhuma descrição.';
        if (modalTaskStatus) modalTaskStatus.textContent = task.isCompleted ? 'Concluída' : (task.status || 'Pendente');
        
        if (completeOperatorTaskBtn) {
            if (task.isCompleted) {
                completeOperatorTaskBtn.classList.add('hidden');
            } else {
                completeOperatorTaskBtn.classList.remove('hidden');
                if (completeOperatorTaskBtn._handleClick) {
                    completeOperatorTaskBtn.removeEventListener('click', completeOperatorTaskBtn._handleClick);
                }
                completeOperatorTaskBtn._handleClick = async () => {
                    showSpinner(operatorTaskModal);
                    try {
                        const taskRef = doc(collection(db, `clients/${farmClientId}/tasks`), task.id);
                        await updateDoc(taskRef, { isCompleted: true, status: 'Concluída' });
                        showToast('Tarefa marcada como concluída!', 'success');
                        closeModal(operatorTaskModal);
                        await fetchAndDisplayTasks(farmClientId);
                    } catch (error) {
                        console.error("Erro ao marcar tarefa como concluída:", error);
                        showToast("Erro ao concluir tarefa: " + error.message, "error");
                    } finally {
                        hideSpinner(operatorTaskModal);
                    }
                };
                completeOperatorTaskBtn.addEventListener('click', completeOperatorTaskBtn._handleClick);
            }
        }
        openModal(operatorTaskModal);
    }

    loadOperadorDashboard();
}