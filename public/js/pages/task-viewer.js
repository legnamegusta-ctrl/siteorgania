// js/pages/task-viewer.js

import { db } from '../config/firebase.js';
import { showSpinner, hideSpinner } from '../services/ui.js';
// Adicionado imports necessários para Firestore V9
import { collection, query, where, orderBy, getDocs, doc, getDoc, collectionGroup } from '/vendor/firebase/9.6.0/firebase-firestore.js';

export function initTaskViewer(userId, userRole) {
    const filterAgronomist = document.getElementById('filterAgronomist');
    const filterClient = document.getElementById('filterClient');
    const filterStatus = document.getElementById('filterStatus');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const tasksResultList = document.getElementById('tasksResultList');

    let allClients = [];
    let allAgronomists = [];

    // Capturar parâmetros da URL para exibir uma tarefa específica (se houver)
    const params = new URLSearchParams(window.location.search);
    const taskIdFromUrl = params.get('taskId');
    const viewDetailsFromUrl = params.get('view') === 'details'; // Indica se é para ver detalhes de uma única tarefa

    const fetchTasks = async () => {
        showSpinner(tasksResultList);

        const selectedAgronomist = filterAgronomist.value;
        const selectedClient = filterClient.value;
        const selectedStatus = filterStatus.value;

        // Se uma tarefa específica foi solicitada pela URL, prioriza a busca por ela
        if (taskIdFromUrl && viewDetailsFromUrl) {
            if (!taskIdFromUrl) { // Adicionado verificação explícita para taskIdFromUrl
                tasksResultList.innerHTML = '<p class="text-red-500 text-center">ID da tarefa não fornecido na URL.</p>';
                hideSpinner(tasksResultList);
                return;
            }

            try {
                // Obter clientId da URL (se existir)
                const clientIdFromUrl = params.get('clientId');
                if (!clientIdFromUrl) {
                    tasksResultList.innerHTML = '<p class="text-red-500 text-center">ID do cliente não fornecido na URL para buscar a tarefa.</p>';
                    hideSpinner(tasksResultList);
                    return;
                }

                // CORREÇÃO: Usando collection() para a subcoleção 'tasks' dentro do cliente
                const taskDocRef = doc(collection(db, `clients/${clientIdFromUrl}/tasks`), taskIdFromUrl);
                const taskDoc = await getDoc(taskDocRef);
                if (taskDoc.exists()) {
                    let task = { id: taskDoc.id, ...taskDoc.data() };
                    // Precisamos buscar os nomes do cliente, propriedade e talhão para exibir
                    const clientDoc = await getDoc(doc(collection(db, 'clients'), task.clientId));
                    
                    // CORREÇÃO: Verificar se propertyId e plotId existem antes de tentar buscar
                    let propertyDoc = null;
                    if (task.propertyId) {
                        propertyDoc = await getDoc(doc(collection(db, `clients/${task.clientId}/properties`), task.propertyId));
                    }
                    
                    let plotDoc = null;
                    if (task.propertyId && task.plotId) { // plotId só faz sentido se propertyId também existir
                        plotDoc = await getDoc(doc(collection(db, `clients/${task.clientId}/properties/${task.propertyId}/plots`), task.plotId));
                    }

                    task.clientName = clientDoc.exists() ? clientDoc.data().name : 'Desconhecido';
                    task.propertyName = propertyDoc && propertyDoc.exists() ? propertyDoc.data().name : 'N/A';
                    task.plotName = plotDoc && plotDoc.exists() ? plotDoc.data().name : 'N/A';

                    renderSingleTaskDetails(task); // Função para renderizar uma única tarefa
                } else {
                    tasksResultList.innerHTML = '<p class="text-gray-500 text-center">Tarefa não encontrada.</p>';
                }
            } catch (error) {
                console.error("Erro ao buscar tarefa específica:", error);
                tasksResultList.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar detalhes da tarefa.</p>';
            } finally {
                hideSpinner(tasksResultList);
            }
            return; // Termina a função aqui se for para exibir uma única tarefa
        }


        // Lógica para carregar múltiplas tarefas (filtros)
        // CORREÇÃO: Usando collectionGroup() e query() para v9
        let tasksQuery; 

        if (userRole === 'admin') {
            tasksQuery = query(collectionGroup(db, 'tasks')); // Collection Group para ADMIN
        } else if (userRole === 'agronomo') {
            tasksQuery = query(collectionGroup(db, 'tasks')); // Começa como Collection Group para todos
            // Adiciona filtro para tarefas onde o Agrônomo é responsável (se o campo existe na task)
            tasksQuery = query(tasksQuery, where('responsibleAgronomistId', '==', userId));
        } else {
            // Se for outro papel (cliente, operador) e chegar aqui, não deveria.
            // Esta página (task-viewer.html) é primariamente para admin/agronomo.
            // Clientes e Operadores visualizam tarefas em seus próprios dashboards.
            tasksResultList.innerHTML = '<p class="text-red-500 text-center">Acesso não autorizado para visualizar todas as tarefas.</p>';
            hideSpinner(tasksResultList);
            return;
        }


        if (selectedStatus !== 'all') {
            const isCompleted = selectedStatus === 'completed';
            tasksQuery = query(tasksQuery, where('isCompleted', '==', isCompleted));
        }

        try {
            const snapshot = await getDocs(tasksQuery); // Execute a query

            hideSpinner(tasksResultList);
            
            let tasks = snapshot.docs.map(docSnap => {
                const pathParts = docSnap.ref.path.split('/');
                const clientId = pathParts[pathParts.indexOf('clients') + 1]; // Extrai clientId do caminho
                return { id: docSnap.id, clientId, ...docSnap.data() };
            });

            // Os filtros de Agronomo e Cliente no frontend são mantidos.
            // O filtro de Agronomo já foi movido para a query Collection Group acima para o agronomo logado.
            // Se o Agronomo logado está vendo TUDO, não precisa mais do filtro:
            /*
            if (selectedAgronomist) {
                const clientsOfAgronomist = allClients.filter(c => c.agronomistId === selectedAgronomist).map(c => c.id);
                tasks = tasks.filter(task => clientsOfAgronomist.includes(task.clientId));
            }
            */
            if (selectedClient) {
                tasks = tasks.filter(task => task.clientId === selectedClient);
            }

            tasks.sort((a, b) => new Date(b.dueDate + 'T12:00:00') - new Date(a.dueDate + 'T12:00:00')); // Ordenar por data

            renderTasks(tasks);

        } catch (error) {
            console.error("Erro ao buscar tarefas (Collection Group):", error);
            hideSpinner(tasksResultList);
            if (error.code === 'failed-precondition') {
                tasksResultList.innerHTML = `<div class="text-center p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700"><p class="font-bold">Ação Necessária</p><p class="text-sm">Um índice do banco de dados precisa ser criado para esta combinação de filtros. Verifique o console de depuração (F12) e clique no link para criar o índice. Após alguns minutos, recarregue a página.</p></div>`;
            } else {
                tasksResultList.innerHTML = '<p class="text-red-500 text-center">Ocorreu um erro ao buscar as tarefas.</p>';
            }
        }
    }; // <-- ESTAVA FALTANDO ESTA CHAVE DE FECHAMENTO PARA fetchTasks


    const renderTasks = (tasks) => {
        tasksResultList.innerHTML = '';
        if (tasks.length === 0) {
            tasksResultList.innerHTML = '<p class="text-gray-500 text-center">Nenhuma tarefa encontrada com os filtros selecionados.</p>';
            return;
        }

        tasks.forEach(task => {
            const client = allClients.find(c => c.id === task.clientId);
            const agronomist = allAgronomists.find(a => a.id === client?.agronomistId);

            const clientName = client ? client.name : 'Cliente desconhecido';
            const agronomistName = agronomist ? agronomist.name : 'Agrônomo desconhecido';
            const isCompleted = task.isCompleted;
            const dueDate = new Date(task.dueDate + 'T12:00:00');
            const formattedDate = dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
            
            const taskItem = `<div class="border-b last:border-0 p-4 ${isCompleted ? 'bg-gray-50 opacity-70' : 'bg-white'}"><div class="flex justify-between items-center"><p class="font-bold text-lg ${isCompleted ? 'line-through text-gray-500' : 'text-gray-800'}">${task.title}</p><span class="text-sm font-semibold ${isCompleted ? 'text-green-600' : 'text-orange-600'}">${isCompleted ? 'Concluída' : 'Pendente'}</span></div><p class="text-sm text-gray-600 mt-1">${task.description || ''}</p><div class="flex justify-between items-center mt-3 text-xs text-gray-500"><span><i class="fas fa-user mr-1"></i>Cliente: ${clientName}</span><span><i class="fas fa-leaf mr-1"></i>Agrônomo: ${agronomistName}</span><span><i class="fas fa-calendar-alt mr-1"></i>Data: ${formattedDate}</span></div></div>`;
            tasksResultList.innerHTML += taskItem;
        });
    };

    const renderSingleTaskDetails = async (task) => { // Tornar async para buscar nomes
        tasksResultList.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Detalhes da Tarefa</h3>
                <div class="space-y-3 text-gray-700 text-base">
                    <p><strong>Título:</strong> ${task.title}</p>
                    <p><strong>Cliente:</strong> ${task.clientName}</p>
                    <p><strong>Propriedade:</strong> ${task.propertyName}</p>
                    <p><strong>Talhão:</strong> ${task.plotName}</p>
                    <p><strong>Data de Vencimento:</strong> ${new Date(task.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    <p><strong>Status:</strong> <span class="${task.isCompleted ? 'text-green-600' : 'text-orange-600'} font-semibold">${task.isCompleted ? 'Concluída' : 'Pendente'}</span></p>
                    <p><strong>Descrição:</strong> ${task.description || 'Nenhuma descrição.'}</p>
                    <p><strong>Atribuída por Agrônomo:</strong> ${allAgronomists.find(a => a.id === task.responsibleAgronomistId)?.name || 'Desconhecido'}</p>
                </div>
                <div class="mt-6">
                    <button onclick="window.history.back()" class="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Voltar</button>
                </div>
            </div>
        `;
    };

    const populateFilters = async () => {
        // CORREÇÃO: Usando collection(db, 'users')
        const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'agronomo')));
        allAgronomists = usersSnapshot.docs.map(docSnap => ({ id: docSnap.id, name: docSnap.data().name || `Agrônomo ${docSnap.id.substring(0,5)}` })); // Renomear doc para docSnap
        allAgronomists.sort((a, b) => a.name.localeCompare(b.name));
        allAgronomists.forEach(agro => {
            if (filterAgronomist) filterAgronomist.innerHTML += `<option value="${agro.id}">${agro.name}</option>`;
        });

        // CORREÇÃO: Usando collection(db, 'clients')
        const clientsSnapshot = await getDocs(collection(db, 'clients'));
        allClients = clientsSnapshot.docs.map(docSnap => ({ id: docSnap.id, name: docSnap.data().name, agronomistId: docSnap.data().agronomistId })); // Renomear doc para docSnap
        allClients.sort((a, b) => a.name.localeCompare(b.name));
        allClients.forEach(client => {
            if (filterClient) filterClient.innerHTML += `<option value="${client.id}">${client.name}</option>`;
        });
    };

    const initialize = async () => {
        // Se for para ver detalhes de uma única tarefa, não precisamos popular os filtros ou ter listeners de filtro
        if (taskIdFromUrl && viewDetailsFromUrl) {
            if (filterAgronomist && filterAgronomist.closest('.grid')) {
                filterAgronomist.closest('.grid').style.display = 'none';
            }
            if (clearFiltersBtn) {
                clearFiltersBtn.style.display = 'none';
            }
            // Não popular filtros se for visualização de uma única tarefa
            // No entanto, renderSingleTaskDetails usa allAgronomists, então precisamos carregá-los.
            await populateFilters(); // Carrega Agrônomos e Clientes (para os nomes no modal)
        } else {
            // Apenas popula os filtros se não for para exibir uma única tarefa
            await populateFilters();
            if (filterAgronomist) filterAgronomist.addEventListener('change', fetchTasks);
            if (filterClient) filterClient.addEventListener('change', fetchTasks);
            if (filterStatus) filterStatus.addEventListener('change', fetchTasks);
            
            if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => {
                if (filterAgronomist) filterAgronomist.value = '';
                if (filterClient) filterClient.value = '';
                if (filterStatus) filterStatus.value = 'pending';
                fetchTasks();
            });
        }
        
        fetchTasks(); // Inicia a busca de tarefas (seja uma única ou a lista filtrada)
    };

    initialize();
}
