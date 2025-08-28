// js/pages/dashboard-cliente.js

import { db } from '../config/firebase.js';
import { showSpinner, hideSpinner, showToast, openModal, closeModal } from '../services/ui.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc, limit, collectionGroup } from '/vendor/firebase/9.6.0/firebase-firestore.js';

export function initClienteDashboard(userId, userRole) {
    const welcomeMessage = document.getElementById('welcomeMessage');
    const summaryMessage = document.getElementById('summaryMessage');
    const propertySelect = document.getElementById('propertySelect');
    const kpiCards = document.getElementById('kpiCards');
    const totalAreaStat = document.getElementById('totalAreaStat');
    const activePlotsStat = document.getElementById('activePlotsStat');
  const completedTasksStat = document.getElementById('completedTasksStat');
    const pendingTasksStat = document.getElementById('pendingTasksStat');
    const overdueTasksStat = document.getElementById('overdueTasksStat');
    const farmActivities = document.getElementById('farmActivities');
    const activitiesList = document.getElementById('activitiesList');
    const statusFilter = document.getElementById('statusFilter');
     const plotFilter = document.getElementById('plotFilter');
    const activityDetailsModal = document.getElementById('activityDetailsModal');
    const imageLightboxModal = document.getElementById('imageLightboxModal');
    const lightboxImage = document.getElementById('lightboxImage');
    const closeLightboxBtn = document.getElementById('closeLightboxBtn');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    let allClientProperties = [];
    let selectedPropertyId = null;
    let currentClientId = null;
    let allUsersCache = {};
    let allActivitiesCache = {};
     let allActivities = [];

    const loadClientDashboard = async () => {
        if (activitiesList) showSpinner(activitiesList);
        console.log('Cliente Dashboard: Iniciando carregamento do painel.');
        try {
            const clientQuery = query(collection(db, 'clients'), where('clientAuthUid', '==', userId), limit(1));
            const clientSnapshot = await getDocs(clientQuery);
            if (clientSnapshot.empty) {
                console.log('Cliente Dashboard: Nenhum documento de cliente encontrado para o UID:', userId);
                if (activitiesList) hideSpinner(activitiesList);
                if (welcomeMessage) welcomeMessage.textContent = 'Bem-vindo(a)!';
                if (summaryMessage) summaryMessage.textContent = 'Nenhuma propriedade associada à sua conta foi encontrada.';
                if (activitiesList) activitiesList.innerHTML = '<p class="text-gray-500 text-center col-span-full py-4">Nenhuma propriedade ativa encontrada.</p>';
                if (propertySelect) propertySelect.innerHTML = '<option value="">Nenhuma propriedade encontrada</option>';
                updateKpiCards(null, null, null);
                return;
            }
            const clientDoc = clientSnapshot.docs[0];
            const clientData = clientDoc.data();
            currentClientId = clientDoc.id;
            console.log('Cliente Dashboard: Cliente encontrado. ID:', currentClientId, 'Dados:', clientData);
            if (welcomeMessage) welcomeMessage.textContent = `Bem-vindo(a), ${clientData.name.split(' ')[0]}!`;
            await loadAllUsersForCache();
            await fetchAndPopulateProperties(currentClientId);
            setupTabListeners();
        } catch (error) {
            console.error("Erro ao carregar o painel do cliente:", error);
            if (activitiesList) hideSpinner(activitiesList);
            if (welcomeMessage) welcomeMessage.textContent = 'Erro ao carregar';
            if (summaryMessage) summaryMessage.textContent = 'Não foi possível buscar seus dados.';
        }
    };

    async function loadAllUsersForCache() {
        try {
            const agronomosQuery = query(collection(db, 'users'), where('role', '==', 'agronomo'));
            const agronomosSnapshot = await getDocs(agronomosQuery);
            agronomosSnapshot.forEach(docSnap => {
                allUsersCache[docSnap.id] = docSnap.data().name || `Agrônomo ${docSnap.id.substring(0,5)}`;
            });
            const operadoresQuery = query(collection(db, 'users'), where('role', '==', 'operador'));
            const operadoresSnapshot = await getDocs(operadoresQuery);
            operadoresSnapshot.forEach(docSnap => {
                allUsersCache[docSnap.id] = docSnap.data().name || `Operador ${docSnap.id.substring(0,5)}`;
            });
            console.log('Cliente Dashboard: Cache de usuários carregado:', allUsersCache);
        } catch (error) {
            console.error("Erro ao carregar cache de usuários:", error);
            showToast("Erro ao carregar dados de usuários.", "error");
        }
    }

    async function fetchAndPopulateProperties(clientId) {
        if (!propertySelect) return;
        try {
            const propertiesQuery = query(collection(db, `clients/${clientId}/properties`), where('status', '==', 'ativo'), orderBy('name'));
            const propertiesSnapshot = await getDocs(propertiesQuery);
            allClientProperties = propertiesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            if (propertySelect) propertySelect.innerHTML = '<option value="">-- Selecione uma propriedade --</option>';
            if (allClientProperties.length === 0) {
                if (propertySelect) propertySelect.innerHTML = '<option value="">Nenhuma propriedade ativa</option>';
                if (summaryMessage) summaryMessage.textContent = 'Você não possui propriedades ativas associadas à sua conta.';
                if (activitiesList) activitiesList.innerHTML = '<p class="text-gray-500 text-center col-span-full py-4">Nenhuma propriedade ativa encontrada.</p>';
                updateKpiCards(null, null, null);
                return;
            }
            allClientProperties.forEach(prop => {
                const option = document.createElement('option');
                option.value = prop.id;
                option.textContent = prop.name;
                if (propertySelect) propertySelect.appendChild(option);
            });
            if (allClientProperties.length > 0) {
                selectedPropertyId = allClientProperties[0].id;
                if (propertySelect) propertySelect.value = selectedPropertyId;
                await updateDashboardForSelectedProperty(clientId, selectedPropertyId);
            }
            if (propertySelect && !propertySelect._hasEventListener) {
                propertySelect.addEventListener('change', async (event) => {
                    selectedPropertyId = event.target.value;
                    await updateDashboardForSelectedProperty(clientId, selectedPropertyId);
                });
                propertySelect._hasEventListener = true;
            }
        } catch (error) {
            console.error("Erro ao carregar propriedades do cliente:", error);
            showToast("Erro ao carregar suas propriedades.", "error");
            if (propertySelect) propertySelect.innerHTML = '<option value="">Erro ao carregar propriedades</option>';
        }
    }

    async function updateDashboardForSelectedProperty(clientId, propertyId) {
        if (!propertyId) {
            if (summaryMessage) summaryMessage.textContent = 'Selecione uma propriedade para ver os detalhes.';
            if (activitiesList) activitiesList.innerHTML = '<p class="text-gray-500 text-center py-4">Selecione uma propriedade para ver as movimentações.</p>';
            updateKpiCards(null, null, null);
            return;
        }
        if (activitiesList) showSpinner(activitiesList);
        try {
            const propertyDocRef = doc(collection(db, `clients/${clientId}/properties`), propertyId);
            const propertyDoc = await getDoc(propertyDocRef);
            if (!propertyDoc.exists()) {
                if (summaryMessage) summaryMessage.textContent = 'Propriedade não encontrada.';
                if (activitiesList) activitiesList.innerHTML = '<p class="text-red-500 text-center py-4">Propriedade não encontrada.</p>';
                updateKpiCards(null, null, null);
                return;
            }
            const propertyData = propertyDoc.data();
            if (summaryMessage) summaryMessage.textContent = `Você está visualizando os dados da propriedade "${propertyData.name}".`;
            await updateKpiCards(clientId, propertyId, propertyData);
            await fetchAndDisplayActivities(clientId, propertyId);
        } catch (error) {
            console.error("Erro ao atualizar dashboard para a propriedade selecionada:", error);
            showToast("Erro ao carregar dados da propriedade.", "error");
            if (summaryMessage) summaryMessage.textContent = 'Erro ao carregar dados da propriedade.';
            if (activitiesList) activitiesList.innerHTML = '<p class="text-red-500 text-center py-4">Erro ao carregar movimentações.</p>';
        } finally {
            if (activitiesList) hideSpinner(activitiesList);
        }
    }

    async function updateKpiCards(clientId, propertyId, propertyData) {
        if (!kpiCards) return;
        showSpinner(kpiCards);
        if (totalAreaStat) totalAreaStat.textContent = '...';
        if (activePlotsStat) activePlotsStat.textContent = '...';
       if (completedTasksStat) completedTasksStat.textContent = '...';
        if (pendingTasksStat) pendingTasksStat.textContent = '...';
         if (overdueTasksStat) overdueTasksStat.textContent = '...';
        if (!clientId || !propertyId || !propertyData) {
            if (totalAreaStat) totalAreaStat.textContent = '0 ha';
            if (activePlotsStat) activePlotsStat.textContent = '0';
             if (completedTasksStat) completedTasksStat.textContent = '0';
            if (pendingTasksStat) pendingTasksStat.textContent = '0';
            if (overdueTasksStat) overdueTasksStat.textContent = '0';
            hideSpinner(kpiCards);
            return;
        }
        try {
            let totalArea = 0;
            const plotsQuery = query(collection(db, `clients/${clientId}/properties/${propertyId}/plots`), where('status', '==', 'ativo'));
            const plotsSnapshot = await getDocs(plotsQuery);
            const activePlotsCount = plotsSnapshot.size;
            plotsSnapshot.forEach(docSnap => {
                totalArea += docSnap.data().area || 0;
            });
            if (totalAreaStat) totalAreaStat.textContent = `${totalArea.toFixed(2)} ha`;
            if (activePlotsStat) activePlotsStat.textContent = activePlotsCount;
             const tasksQuery = query(collection(db, `clients/${clientId}/tasks`),
                                      where('propertyId', '==', propertyId));
            const tasksSnapshot = await getDocs(tasksQuery);
            let completedCount = 0;
            let pendingCount = 0;
            let overdueCount = 0;
            const todayStr = new Date().toISOString().split('T')[0];
            tasksSnapshot.forEach(docSnap => {
                const task = docSnap.data();
                if (task.isCompleted) {
                    completedCount++;
                } else if (task.dueDate && task.dueDate < todayStr) {
                    overdueCount++;
                } else {
                    pendingCount++;
                }
            });
            if (completedTasksStat) completedTasksStat.textContent = completedCount;
            if (pendingTasksStat) pendingTasksStat.textContent = pendingCount;
            if (overdueTasksStat) overdueTasksStat.textContent = overdueCount;

        } catch (error) {
            console.error("Erro ao atualizar KPIs:", error);
            if (totalAreaStat) totalAreaStat.textContent = 'Erro';
            if (activePlotsStat) activePlotsStat.textContent = 'Erro';
            if (completedTasksStat) completedTasksStat.textContent = 'Erro';
            if (pendingTasksStat) pendingTasksStat.textContent = 'Erro';
            if (overdueTasksStat) overdueTasksStat.textContent = 'Erro';
            showToast("Erro ao carregar os indicadores.", "error");
        } finally {
            hideSpinner(kpiCards);
        }
    }

    async function fetchAndDisplayActivities(clientId, propertyId) {
        if (!activitiesList) return;
        activitiesList.innerHTML = '';
        showSpinner(activitiesList);
       allActivities = [];
        allActivitiesCache = {};
        console.log('Cliente Dashboard: Buscando e exibindo atividades para Propriedade:', propertyId);
        try {
            const plotsQuery = query(collection(db, `clients/${clientId}/properties/${propertyId}/plots`), where('status', '==', 'ativo'));
            const plotsSnapshot = await getDocs(plotsQuery);
            populatePlotFilter(plotsSnapshot);
            if (plotsSnapshot.empty) {
                console.log('Cliente Dashboard: Nenhuma talhão ativo encontrado para esta propriedade.');
            }
            const plotNamesMap = new Map();
            plotsSnapshot.docs.forEach(docSnap => plotNamesMap.set(docSnap.id, docSnap.data().name));
            for (const plotDocSnap of plotsSnapshot.docs) {
                const plotName = plotDocSnap.data().name;
                const plotId = plotDocSnap.id;
                console.log('Cliente Dashboard: Processando talhão:', plotName, plotId);
                const culturesQuery = query(collection(db, `clients/${clientId}/properties/${propertyId}/plots/${plotId}/culturas`), where('status', '==', 'ativo'));
                const culturesSnapshot = await getDocs(culturesQuery);
                if (culturesSnapshot.empty) {
                    console.log('Cliente Dashboard: Nenhuma cultura ativa encontrada para o talhão:', plotName);
                }
                for (const cultureDocSnap of culturesSnapshot.docs) {
                    const cultureId = cultureDocSnap.id; 
                    const culturePath = `clients/${clientId}/properties/${propertyId}/plots/${plotId}/culturas/${cultureId}`;
                    console.log('Cliente Dashboard: Processando cultura para talhão:', cultureDocSnap.data().cropName, cultureId);
                    const analysesQuery = query(collection(db, `${culturePath}/analyses`), orderBy('date', 'desc'));
                    const analysesSnapshot = await getDocs(analysesQuery);
                    if (analysesSnapshot.empty) {
                        console.log('Cliente Dashboard: Nenhuma análise encontrada para cultura:', cultureId);
                    }
                    analysesSnapshot.forEach(docSnap => {
                        const analysisData = docSnap.data();
                        const responsibleName = allUsersCache[analysisData.registeredById] || analysisData.registeredBy || 'Desconhecido';
                        const activity = {
                            id: docSnap.id,
                            type: 'Análise de Solo',
                            status: 'Concluída',
                            local: plotName,
                            date: analysisData.date,
                            description: analysisData.agronomistInterpretation || 'Análise de solo realizada.',
                            imageUrls: [],
                            responsible: responsibleName,
                            dataSource: 'analysis',
                            clientId: clientId,
                            propertyId: propertyId,
                            plotId: plotId,
                            cultureId: cultureId
                        };
                        allActivities.push(activity);
                        allActivitiesCache[activity.id] = activity;
                    });
                    const managementsQuery = query(collection(db, `${culturePath}/managements`), orderBy('date', 'desc'));
                    const managementsSnapshot = await getDocs(managementsQuery);
                    if (managementsSnapshot.empty) {
                        console.log('Cliente Dashboard: Nenhuma manejo encontrado para cultura:', cultureId);
                    }
                    managementsSnapshot.forEach(docSnap => {
                        const management = docSnap.data();
                        const responsibleName = allUsersCache[management.registeredById] || management.registeredBy || 'Desconhecido';
                        const activity = {
                            id: docSnap.id,
                            type: management.type ? management.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Manejo',
                            status: management.status || 'Concluída',
                            local: plotName,
                            date: management.date,
                            description: management.description || 'Detalhes não informados.',
                            imageUrls: management.imageUrls || [],
                            responsible: responsibleName,
                            dataSource: 'management',
                            clientId: clientId,
                            propertyId: propertyId,
                            plotId: plotId,
                            cultureId: cultureId
                        };
                        allActivities.push(activity);
                        allActivitiesCache[activity.id] = activity;
                    });
                }
            }
  const tasksQuery = query(collection(db, `clients/${clientId}/tasks`),
                                     where('propertyId', '==', propertyId),
                                     orderBy('dueDate', 'desc'));
            const tasksSnapshot = await getDocs(tasksQuery);
            const todayStr = new Date().toISOString().split('T')[0];
            if (tasksSnapshot.empty) {
                console.log('Cliente Dashboard: Nenhuma tarefa encontrada para o cliente na propriedade:', propertyId);
            }
            tasksSnapshot.forEach(docSnap => {
                const task = docSnap.data();
                let responsibleName = allUsersCache[task.responsibleAgronomistId] || 'Desconhecido';
                const plotNameForTask = task.plotId ? plotNamesMap.get(task.plotId) || 'Talhão Desconhecido' : 'N/A';
                const status = task.isCompleted ? 'Concluída' : (task.dueDate && task.dueDate < todayStr ? 'Atrasada' : 'Pendente');
                const activity = {
                    id: docSnap.id,
                    type: `Tarefa: ${task.title}`,
                    status: status,
                    local: plotNameForTask,
                    date: task.dueDate,
                    description: task.description || 'Tarefa registrada.',
                    imageUrls: task.imageUrls || [],
                    responsible: responsibleName,
                    dataSource: 'task',
                    clientId: clientId,
                    propertyId: propertyId,
                    plotId: task.plotId,
                    cultureId: task.cultureId || null,
                    originalTask: task                };
                allActivities.push(activity);
                allActivitiesCache[activity.id] = activity;
            });
            allActivities.sort((a, b) => new Date(b.date + 'T12:00:00') - new Date(a.date + 'T12:00:00'));
            console.log('Cliente Dashboard: Todas as atividades coletadas:', allActivities.length, allActivities);
            hideSpinner(activitiesList);
            if (allActivities.length === 0) {
                activitiesList.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma movimentação encontrada para esta propriedade.</p>';
                return;
            }
applyFilters();
        } catch (error) {
            console.error("Erro ao carregar e exibir movimentações:", error);
            hideSpinner(activitiesList);
            activitiesList.innerHTML = '<p class="text-red-500 text-center py-4">Erro ao carregar movimentações na lavoura.</p>';
        }
    }

function renderActivities(list) {
            activitiesList.innerHTML = '';
        if (list.length === 0) {
            activitiesList.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma movimentação encontrada para o filtro selecionado.</p>';
            return;
        }
        list.forEach(activity => {
            const activityDate = activity.date ? new Date(activity.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A';
            const photoCount = activity.imageUrls ? activity.imageUrls.length : 0;
            const photoHtml = photoCount > 0 ? `<span class="inline-flex items-center text-gray-600 text-sm ml-2"><i class="fas fa-camera mr-1"></i>${photoCount} fotos</span>` : '';
            let statusColorClass = 'bg-gray-100 text-gray-800';
            if (activity.status === 'Concluída') {
                statusColorClass = 'bg-green-100 text-green-800';
            } else if (activity.status === 'Atrasada') {
                statusColorClass = 'bg-red-100 text-red-800';
            } else if (activity.status === 'Pendente') {
                statusColorClass = 'bg-yellow-100 text-yellow-800';
            }
            activitiesList.innerHTML += `
                <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div class="flex-grow">
                        <div class="flex items-center mb-2">
                            <h4 class="text-lg font-bold text-gray-800 mr-3">${activity.type}</h4>
                            <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColorClass}">${activity.status}</span>
                            ${photoHtml}
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                            <div><span class="font-semibold">Local:</span> ${activity.local}</div>
                            <div><span class="font-semibold">Data:</span> ${activityDate}</div>
                            <div class="col-span-full"><span class="font-semibold">Responsável:</span> ${activity.responsible}</div>
                        </div>
                        <p class="text-gray-700">${activity.description}</p>
                    </div>
                    <a class="mt-4 sm:mt-0 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm flex items-center justify-center"
                       href="activity-details.html?clientId=${activity.clientId}&propertyId=${activity.propertyId}&plotId=${activity.plotId || ''}&cultureId=${activity.cultureId || ''}&dataSource=${activity.dataSource}&activityId=${activity.id}">
                        <i class="fas fa-eye mr-2"></i>Ver Detalhes
                   </a>
                </div>
            `;
        });
    }

function populatePlotFilter(plotsSnapshot) {
        if (!plotFilter) return;
        plotFilter.innerHTML = '<option value="all">Todos os Talhões</option>';
        plotsSnapshot.forEach(docSnap => {
            const option = document.createElement('option');
            option.value = docSnap.id;
            option.textContent = docSnap.data().name;
            plotFilter.appendChild(option);
        });
        plotFilter.value = 'all';
    }

    function applyFilters() {
        if (!activitiesList) return;
        const status = statusFilter ? statusFilter.value : 'all';
        const plotId = plotFilter ? plotFilter.value : 'all';
        const filtered = allActivities.filter(activity => {
            const statusMatch =
                status === 'all' ||
                (status === 'completed' && activity.status === 'Concluída') ||
                (status === 'pending' && activity.status === 'Pendente') ||
                (status === 'overdue' && activity.status === 'Atrasada');
            const plotMatch = plotId === 'all' || activity.plotId === plotId;
            return statusMatch && plotMatch;
        });
        renderActivities(filtered);
    }

    if (statusFilter && !statusFilter._hasListener) {
        statusFilter.addEventListener('change', applyFilters);
        statusFilter._hasListener = true;
    }
    if (plotFilter && !plotFilter._hasListener) {
        plotFilter.addEventListener('change', applyFilters);
        plotFilter._hasListener = true;
    }
        // NOVA FUNÇÃO: Preenche o modal de detalhes com o objeto de atividade já carregado
    async function openActivityDetailsModal(activity) {
        console.log("openActivityDetailsModal: Iniciando preenchimento do modal com o objeto:", activity);
        
        const activityDetailsModal = document.getElementById('activityDetailsModal');
        const activityModalTitle = document.getElementById('activityModalTitle');
        const activityModalType = document.getElementById('activityModalType');
        const activityModalLocation = document.getElementById('activityModalLocation');
        const activityModalDate = document.getElementById('activityModalDate');
        const activityModalResponsible = document.getElementById('activityModalResponsible'); 
        const activityModalStatus = document.getElementById('activityModalStatus');
        const activityModalDescription = document.getElementById('activityModalDescription');
        const activityModalPhotos = document.getElementById('activityModalPhotos');
        const imageLightboxModal = document.getElementById('imageLightboxModal');
        const lightboxImage = document.getElementById('lightboxImage');
        const closeLightboxBtn = document.getElementById('closeLightboxBtn');

        if (!activityDetailsModal || !activityModalTitle || !activityModalType || !activityModalLocation || !activityModalDate || !activityModalResponsible || !activityModalStatus || !activityModalDescription || !activityModalPhotos || !imageLightboxModal || !lightboxImage) {
            console.error("openActivityDetailsModal: Um ou mais elementos do modal não foram encontrados. Abortando.");
            showToast("Erro: Componentes da interface não carregados corretamente. Recarregue a página.", "error");
            if (activityDetailsModal) {
                hideSpinner(activityDetailsModal);
                closeModal(activityDetailsModal);
            }
            return;
        }

        // Limpa o conteúdo antes de preencher
        if (activityModalTitle) activityModalTitle.textContent = '';
        if (activityModalType) activityModalType.textContent = '';
        if (activityModalLocation) activityModalLocation.textContent = '';
        if (activityModalDate) activityModalDate.textContent = '';
        if (activityModalResponsible) activityModalResponsible.textContent = '';
        if (activityModalStatus) activityModalStatus.textContent = '';
        if (activityModalDescription) activityModalDescription.textContent = '';
        if (activityModalPhotos) activityModalPhotos.innerHTML = '';
        
        showSpinner(activityDetailsModal);
        
        try {
            if (!activity) {
                console.warn("openActivityDetailsModal: Objeto de atividade é nulo.");
                if (activityModalTitle) activityModalTitle.textContent = 'Atividade Não Encontrada';
                if (activityModalDescription) activityModalDescription.textContent = 'Detalhes da atividade não puderam ser carregados.';
                return;
            }
            
            if (activity.dataSource === 'analysis') {
                if (activityModalTitle) activityModalTitle.textContent = 'Detalhes da Análise de Solo';
                if (activityModalType) activityModalType.textContent = 'Análise de Solo';
                if (activityModalDescription) activityModalDescription.textContent = activity.description;
                if (activityModalPhotos) activityModalPhotos.innerHTML = '<p class="text-gray-500 text-sm col-span-full">Nenhuma foto disponível para análises.</p>';
            } else if (activity.dataSource === 'management') {
                if (activityModalTitle) activityModalTitle.textContent = `Detalhes do Manejo: ${activity.type}`;
                if (activityModalType) activityModalType.textContent = activity.type;
                if (activityModalDescription) activityModalDescription.textContent = activity.description;
                if (activityModalPhotos) {
                    if (activity.imageUrls && activity.imageUrls.length > 0) {
                        activity.imageUrls.forEach(url => {
                            const imgContainer = document.createElement('div');
                            imgContainer.className = 'w-full h-24 sm:h-32 bg-gray-200 rounded-md overflow-hidden cursor-pointer';
                            imgContainer.innerHTML = `<img src="${url}" alt="Foto da atividade" class="w-full h-full object-cover activity-modal-photo" data-full-src="${url}">`;
                            activityModalPhotos.appendChild(imgContainer);
                        });
                        activityModalPhotos.querySelectorAll('.activity-modal-photo').forEach(img => {
                            img.addEventListener('click', (e) => openLightbox(e.target.dataset.fullSrc));
                        });
                    } else {
                        activityModalPhotos.innerHTML = '<p class="text-gray-500 text-sm col-span-full">Nenhuma foto disponível.</p>';
                    }
                }
            } else if (activity.dataSource === 'task') {
                const originalTask = activity.originalTask;
                const propertyNamesMap = new Map(allClientProperties.map(p => [p.id, p.name]));
                const plotsQuery = query(collection(db, `clients/${originalTask.clientId}/properties/${originalTask.propertyId}/plots`));
                const plotsSnapshot = await getDocs(plotsQuery);
                const plotNamesMap = new Map(plotsSnapshot.docs.map(docSnap => [docSnap.id, docSnap.data().name]));

                if (activityModalTitle) activityModalTitle.textContent = originalTask.title;
                if (activityModalType) activityModalType.textContent = originalTask.type || 'Geral';
                if (activityModalLocation) {
                    const propName = originalTask.propertyId ? propertyNamesMap.get(originalTask.propertyId) : 'N/A';
                    const plotName = originalTask.plotId ? plotNamesMap.get(originalTask.plotId) : 'N/A';
                    activityModalLocation.textContent = `Propriedade: ${propName} | Talhão: ${plotName}`;
                }
                if (activityModalDate) activityModalDate.textContent = originalTask.dueDate ? new Date(originalTask.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A';
                if (activityModalResponsible) {
                    const responsibleName = allUsersCache[originalTask.responsibleAgronomistId] || 'Desconhecido';
                    activityModalResponsible.textContent = responsibleName;
                }
                if (activityModalStatus) activityModalStatus.textContent = originalTask.isCompleted ? 'Concluída' : originalTask.status || 'Pendente';
                if (activityModalDescription) activityModalDescription.textContent = originalTask.description || 'Nenhuma descrição.';

                if (activityModalPhotos) {
                     if (originalTask.imageUrls && originalTask.imageUrls.length > 0) {
                        activity.imageUrls.forEach(url => {
                            const imgContainer = document.createElement('div');
                            imgContainer.className = 'w-full h-24 sm:h-32 bg-gray-200 rounded-md overflow-hidden cursor-pointer';
                            imgContainer.innerHTML = `<img src="${url}" alt="Foto da tarefa" class="w-full h-full object-cover activity-modal-photo" data-full-src="${url}">`;
                            activityModalPhotos.appendChild(imgContainer);
                        });
                        activityModalPhotos.querySelectorAll('.activity-modal-photo').forEach(img => {
                            img.addEventListener('click', (e) => openLightbox(e.target.dataset.fullSrc));
                        });
                    } else {
                        activityModalPhotos.innerHTML = '<p class="text-gray-500 text-sm col-span-full">Nenhuma foto disponível.</p>';
                    }
                }
            } else {
                // Preenchimento para atividades de análise/manejo (lógica original)
                if (activityModalTitle) activityModalTitle.textContent = `Detalhes do Evento: ${activity.type}`;
                if (activityModalType) activityModalType.textContent = activity.type;
                if (activityModalDescription) activityModalDescription.textContent = activity.description;
                if (activityModalLocation) activityModalLocation.textContent = activity.local || 'N/A';
                if (activityModalDate) activityModalDate.textContent = activity.date ? new Date(activity.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A';
                if (activityModalResponsible) activityModalResponsible.textContent = activity.responsible || 'Desconhecido';
                if (activityModalStatus) activityModalStatus.textContent = activity.status || 'N/A';
                
                if (activityModalPhotos) {
                    if (activity.imageUrls && activity.imageUrls.length > 0) {
                        activity.imageUrls.forEach(url => {
                            const imgContainer = document.createElement('div');
                            imgContainer.className = 'w-full h-24 sm:h-32 bg-gray-200 rounded-md overflow-hidden cursor-pointer';
                            imgContainer.innerHTML = `<img src="${url}" alt="Foto da atividade" class="w-full h-full object-cover activity-modal-photo" data-full-src="${url}">`;
                            activityModalPhotos.appendChild(imgContainer);
                        });
                        activityModalPhotos.querySelectorAll('.activity-modal-photo').forEach(img => {
                            img.addEventListener('click', (e) => openLightbox(e.target.dataset.fullSrc));
                        });
                    } else {
                        activityModalPhotos.innerHTML = '<p class="text-gray-500 text-sm col-span-full">Nenhuma foto disponível.</p>';
                    }
                }
            }
            
        } catch (error) {
            console.error("Erro fatal ao carregar detalhes da atividade:", error);
            if (activityModalTitle) activityModalTitle.textContent = 'Erro ao Carregar';
            if (activityModalDescription) activityModalDescription.innerHTML = `<p class="text-red-500">Erro: ${error.message}</p>`;
            if (activityModalPhotos) activityModalPhotos.innerHTML = '';
            showToast("Erro ao carregar detalhes da atividade.", "error");
        } finally {
            hideSpinner(activityDetailsModal);
            openModal(activityDetailsModal);
        }
    }
    
    // Lógica para Lightbox
    const openLightbox = (src) => {
        const lightboxImage = document.getElementById('lightboxImage');
        const imageLightboxModal = document.getElementById('imageLightboxModal');
        if (lightboxImage) lightboxImage.src = src;
        openModal(imageLightboxModal);
    };

    const closeLightbox = () => {
        const imageLightboxModal = document.getElementById('imageLightboxModal');
        const lightboxImage = document.getElementById('lightboxImage');
        closeModal(imageLightboxModal);
        if (lightboxImage) lightboxImage.src = '';
    };

    // Event Listeners Gerais
    if (closeLightboxBtn) closeLightboxBtn.addEventListener('click', closeLightbox);
    if (imageLightboxModal) imageLightboxModal.addEventListener('click', (e) => {
        if (e.target === imageLightboxModal) {
            closeLightbox();
        }
    });
    if (document.getElementById('closeActivityDetailsModalBtn')) {
        document.getElementById('closeActivityDetailsModalBtn').addEventListener('click', () => closeModal(document.getElementById('activityDetailsModal')));
    }

    // Lógica de controle de abas
    function setupTabListeners() {
        tabButtons.forEach(button => {
            if (!button._hasTabListener) {
                button.addEventListener('click', () => {
                    const targetId = button.dataset.tabTarget;
                    tabContents.forEach(content => content.classList.add('hidden'));
                    
                    tabButtons.forEach(btn => {
                        btn.classList.remove('active-tab', 'border-green-600', 'text-green-600');
                        btn.classList.add('text-gray-500', 'border-transparent', 'hover:border-gray-300');
                    });
                    button.classList.add('active-tab', 'border-green-600', 'text-green-600');
                    button.classList.remove('text-gray-500', 'border-transparent', 'hover:border-gray-300');
                    document.getElementById(`${targetId}-content`).classList.remove('hidden');
                });
                button._hasTabListener = true;
            }
        });
        if (tabButtons.length > 0) {
            tabButtons[0].click();
        }
    }

    loadClientDashboard();
}
