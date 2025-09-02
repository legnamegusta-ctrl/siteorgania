// js/pages/dashboard-admin.js

import { db, auth } from '../config/firebase.js';
import { showToast, showSpinner, hideSpinner, openModal, closeModal } from '../services/ui.js';
import { initProductionOrders } from './ordens-producao.js';
import { initFormulasAdmin } from './formulas-admin.js';
// CORREÇÃO: Adicionado 'onSnapshot', 'writeBatch', e 'collectionGroup' ao import do firebase/firestore
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, writeBatch, onSnapshot, collectionGroup, setDoc, Timestamp } from '/vendor/firebase/9.6.0/firebase-firestore.js';
import { createUserWithEmailAndPassword } from '/vendor/firebase/9.6.0/firebase-auth.js';
export function initAdminDashboard(userId, userRole) {
    // --- CONTROLE DAS ABAS ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // --- Flags de inicialização ---
    let isDashboardTabInitialized = false;
    let isClientesTabInitialized = false;
    let isProducaoTabInitialized = false;
    let isFerramentasTabInitialized = false;
    let isAgronomosTabInitialized = false;

    // --- Variáveis de Estado Globais ---
    let allAgronomists = [];
    let currentEditingClientId = null;

    // ===================================================================
    // ||                    LÓGICA DE CONTROLE DAS ABAS                ||
    // ===================================================================

    const switchTab = (targetId) => {
        tabContents.forEach(content => content.classList.add('hidden'));
        tabButtons.forEach(button => button.classList.remove('active-tab'));
        document.getElementById(`${targetId}-content`).classList.remove('hidden');
        document.querySelector(`[data-tab-target="${targetId}"]`).classList.add('active-tab');

        switch (targetId) {
            case 'dashboard': if (!isDashboardTabInitialized) initDashboardTab(); break;
            case 'clientes': if (!isClientesTabInitialized) initClientesTab(); break;
            case 'producao': if (!isProducaoTabInitialized) initProducaoTab(userId, userRole); break;
            case 'ferramentas': if (!isFerramentasTabInitialized) initFerramentasTab(userId, userRole); break;
            case 'agronomos': if (!isAgronomosTabInitialized) initAgronomosTab(); break;
        }
    };

    tabButtons.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tabTarget)));

    // ===================================================================
    // ||                    INICIALIZADORES DE CADA ABA                ||
    // ===================================================================

    /**
     * ABA 1: DASHBOARD (KPIs e Gráficos)
     */
    async function initDashboardTab() {
        isDashboardTabInitialized = true;
        // ... (Lógica do Dashboard não foi alterada e permanece a mesma)
        const totalClientsStat = document.getElementById('totalClientsStat');
        const totalAgronomosStat = document.getElementById('totalAgronomosStat');
        const totalAnalysesStat = document.getElementById('totalAnalysesStat');
        const totalSalesStat = document.getElementById('totalSalesStat');
        const kpiCards = document.getElementById('kpiCards');
        
        try {
            // CORREÇÃO: Usando doc() e onSnapshot para v9
            onSnapshot(doc(db, 'stats', 'globalStats'), docSnap => {
                if (docSnap.exists() && totalAnalysesStat) {
                    totalAnalysesStat.textContent = docSnap.data().totalAnalyses || 0;
                }
            });

            // CORREÇÃO: Usando collection() e getDocs() para v9
            const [clientsSnapshot, usersSnapshot, salesSnapshot] = await Promise.all([
                getDocs(collection(db, 'clients')),
                getDocs(collection(db, 'users')),
                // CORREÇÃO: Usando collectionGroup() e query() para v9
                getDocs(query(collectionGroup(db, 'sales'), where('status', 'in', ['approved', 'completed'])))
            ]);

            const clientsData = clientsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            if (totalClientsStat) totalClientsStat.textContent = clientsData.length;

            const agronomos = usersSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})).filter(u => u.role === 'agronomo');
            if (totalAgronomosStat) totalAgronomosStat.textContent = agronomos.length;

            const totalTonnage = salesSnapshot.docs.reduce((sum, doc) => sum + (doc.data().items || []).reduce((itemSum, item) => itemSum + (item.tonnage || 0), 0), 0);
            if(totalSalesStat) totalSalesStat.textContent = totalTonnage.toFixed(2);

            renderClientsByAgronomoChart(clientsData, agronomos);
            renderNewClientsByMonthChart(clientsData);

        } catch (error) {
            console.error("Erro ao carregar analytics:", error);
            if (kpiCards) kpiCards.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar dados.</p>';
        }

        function renderClientsByAgronomoChart(clients, agronomos) {
            const ctx = document.getElementById('clientsByAgronomoChart');
            if (!ctx) return;
            const brandColors = ['#3a7d44', '#f59e0b', '#5a3a22', '#f97316', '#6b7280', '#14b8a6'];
            const data = { labels: [], datasets: [{ label: 'Clientes', data: [], backgroundColor: brandColors, hoverOffset: 4 }] };
            const clientsByAgronomo = {};
            agronomos.forEach(agronomo => { clientsByAgronomo[agronomo.name || `Agrônomo ${agronomo.id.substring(0, 5)}`] = 0; });
            clientsByAgronomo['Sem Agrônomo'] = 0;
            clients.forEach(c => {
                const agronomoDoc = agronomos.find(u => u.id === c.agronomistId);
                const agronomoName = agronomoDoc ? (agronomoDoc.name || `Agrônomo ${agronomoDoc.id.substring(0, 5)}`) : 'Sem Agrônomo';
                if (clientsByAgronomo[agronomoName] !== undefined) { clientsByAgronomo[agronomoName]++; }
            });
            for (const [agronomoName, count] of Object.entries(clientsByAgronomo)) {
                if (count > 0) { data.labels.push(agronomoName); data.datasets[0].data.push(count); }
            }
            new Chart(ctx, { type: 'doughnut', data: data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } } });
        }

        function renderNewClientsByMonthChart(clients) {
            const ctx = document.getElementById('newClientsByMonthChart');
            if (!ctx) return;
            const clientsByMonth = {};
            clients.forEach(client => {
                if (client.createdAt && client.createdAt.toDate) {
                    const date = client.createdAt.toDate();
                    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
                    clientsByMonth[monthYear] = (clientsByMonth[monthYear] || 0) + 1;
                }
            });
            const sortedMonths = Object.keys(clientsByMonth).sort((a, b) => {
                const [m1, y1] = a.split('/');
                const [m2, y2] = b.split('/');
                return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
            });
            const data = { labels: sortedMonths, datasets: [{ label: 'Novos Clientes', data: sortedMonths.map(month => clientsByMonth[month]), backgroundColor: 'rgba(58, 125, 68, 0.8)', borderColor: 'rgba(58, 125, 68, 1)', borderWidth: 1 }] };
            new Chart(ctx, { type: 'bar', data: data, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
        }
    }

    /**
     * ABA 2: PRODUÇÃO (Ordens de Produção)
     */
    function initProducaoTab(currentUserId, currentUserRole) {
        isProducaoTabInitialized = true;
        const container = document.getElementById('production-orders-container');
        container.innerHTML = `
            <div class="mb-6 flex justify-center border-b">
                <button id="filter-in-progress" class="filter-btn filter-active px-6 py-2 text-sm font-semibold text-gray-800 border-b-2 border-green-600">Em Andamento</button>
                <button id="filter-completed" class="filter-btn px-6 py-2 text-sm font-semibold text-gray-500 border-b-2 border-transparent hover:border-gray-300">Concluídas</button>
            </div>
            <div id="orders-list" class="space-y-6"></div>
        `;
        initProductionOrders(currentUserId, currentUserRole);
    }

    /**
     * ABA 3: FERRAMENTAS (Gestão de Formulações)
     */
    function initFerramentasTab(currentUserId, currentUserRole) {
        isFerramentasTabInitialized = true;
        const container = document.getElementById('formulas-admin-container');
        container.innerHTML = `
            <div class="space-y-8">
                <div class="bg-white p-6 rounded-lg shadow">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Fórmulas Fixas</h3>
                    <p class="text-sm text-gray-500 mb-4">Estas são as formulações padrão do sistema. Elas podem ser editadas, mas não excluídas.</p>
                    <div id="fixedFormulasList" class="space-y-3"></div>
                </div>
                <div class="bg-white p-6 rounded-lg shadow">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-gray-800">Fórmulas Personalizadas</h3>
                        <button id="showAddFormulaModalBtn" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 text-sm">
                            <i class="fas fa-plus mr-2"></i>Adicionar Fórmula
                        </button>
                    </div>
                    <p class="text-sm text-gray-500 mb-4">Formulas adicionadas para necessidades específicas.</p>
                    <div id="customFormulasList" class="space-y-3"></div>
                </div>
            </div>
        `;
        initFormulasAdmin(currentUserId, currentUserRole);
    }

    /**
     * ABA 4: AGRÔNOMOS (Listagem e Relatórios)
     */
    function initAgronomosTab() {
        isAgronomosTabInitialized = true;
        const listEl = document.getElementById('adminAgronomistsList');
        const contentEl = document.getElementById('agronomos-content');
        const startInput = document.getElementById('reportStartDate');
        const endInput = document.getElementById('reportEndDate');

        async function renderAgronomists() {
            if (!listEl) return;
            showSpinner(listEl);
            try {
                const snapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'agronomo'), orderBy('name')));
                listEl.innerHTML = '';
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    listEl.innerHTML += `<tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${data.name || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${data.email || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-right"><button class="btn btn-secondary text-xs" data-action="download-report" data-agronomist-id="${docSnap.id}" data-agronomist-name="${data.name || 'agronomo'}"><i class="fas fa-file-pdf mr-1"></i>Relatório</button></td>
                    </tr>`;
                });
            } catch (error) {
                console.error('Erro ao carregar agrônomos:', error);
                listEl.innerHTML = '<tr><td colspan="3" class="text-center text-red-500 py-4">Erro ao carregar agrônomos.</td></tr>';
            } finally {
                hideSpinner(listEl);
            }
        }

        async function downloadVisitsReport(agronomistId, agronomistName) {
            try {
                let q = query(collectionGroup(db, 'visits'), where('authorId', '==', agronomistId));
                const startVal = startInput?.value;
                const endVal = endInput?.value;
                if (startVal) q = query(q, where('date', '>=', Timestamp.fromDate(new Date(startVal))));
                if (endVal) q = query(q, where('date', '<=', Timestamp.fromDate(new Date(endVal))));
                const snap = await getDocs(q);
                const { jsPDF } = window.jspdf;
                const docPdf = new jsPDF();
                docPdf.setFontSize(14);
                docPdf.text(`Relatório de visitas - ${agronomistName}`, 10, 10);
                let y = 20;
                let count = 0;
                snap.forEach((d) => {
                    const data = d.data();
                    if (data.authorId !== agronomistId && data.agronomistId !== agronomistId) return;
                    const dateStr = data.date?.toDate ? data.date.toDate().toLocaleDateString('pt-BR') : '';
                    const summary = data.summary || data.notes || '';
                    docPdf.text(`${++count}. ${dateStr} - ${summary}`, 10, y);
                    y += 8;
                    if (y > 280) { docPdf.addPage(); y = 20; }
                });
                docPdf.save(`visitas-${agronomistName}.pdf`);
            } catch (error) {
                console.error('Erro ao gerar relatório:', error);
                showToast('Erro ao gerar relatório de visitas.', 'error');
            }
        }

        async function downloadVisitsReportFixed(agronomistId, agronomistName) {
            try {
                // Busca em múltiplas origens para cobrir diferentes esquemas
                const queries = [
                    // Top-level 'visits' por authorId e agronomistId
                    getDocs(query(collection(db, 'visits'), where('authorId', '==', agronomistId))),
                    getDocs(query(collection(db, 'visits'), where('agronomistId', '==', agronomistId))),
                    // Subcoleções 'visits' (ex.: leads/{id}/visits) por authorId e agronomistId
                    getDocs(query(collectionGroup(db, 'visits'), where('authorId', '==', agronomistId))),
                    getDocs(query(collectionGroup(db, 'visits'), where('agronomistId', '==', agronomistId)))
                ];
                let snapshots = [];
                try {
                    snapshots = await Promise.all(queries);
                } catch (cgErr) {
                    // Se collectionGroup não estiver indexado/permitido, ignora e segue com o que retornou
                    console.warn('Aviso: falha ao consultar collectionGroup(visits). Prosseguindo com top-level apenas.', cgErr);
                    snapshots = await Promise.all([
                        getDocs(query(collection(db, 'visits'), where('authorId', '==', agronomistId))),
                        getDocs(query(collection(db, 'visits'), where('agronomistId', '==', agronomistId)))
                    ]);
                }

                const startVal = startInput?.value ? new Date(startInput.value) : null;
                const endVal = endInput?.value ? new Date(endInput.value) : null;
                if (endVal) endVal.setHours(23, 59, 59, 999);

                const seen = new Set();
                const visits = [];
                const pushVisit = (docSnap) => {
                    const data = docSnap.data();
                    // Garante vínculo com agrônomo
                    if (data.authorId !== agronomistId && data.agronomistId !== agronomistId) return;

                    // Resolve data
                    let dateObj = null;
                    if (data.date?.toDate) dateObj = data.date.toDate();
                    else if (data.checkInTime?.toDate) dateObj = data.checkInTime.toDate();
                    else if (typeof data.at === 'string') {
                        const dAt = new Date(data.at);
                        if (!isNaN(dAt)) dateObj = dAt;
                    } else if (data.createdAt?.toDate) {
                        dateObj = data.createdAt.toDate();
                    }

                    if (startVal && dateObj && dateObj < startVal) return;
                    if (endVal && dateObj && dateObj > endVal) return;

                    const dateStr = dateObj ? dateObj.toLocaleDateString('pt-BR') : '';
                    const who = data.clientName || data.leadName || '';
                    const whereTxt = data.propertyName || data.locationName || '';
                    const summary = data.summary || data.notes || data.outcome || '';
                    const line = [dateStr, who, whereTxt, summary].filter(Boolean).join(' - ');

                    const key = docSnap.ref?.path || `${docSnap.id}:${dateStr}:${summary}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    visits.push({ date: dateObj || new Date(0), line });
                };

                snapshots.forEach((snap) => snap.forEach(pushVisit));

                // Carrega clientes e leads do agrônomo para incluir no relatório
                let clients = [];
                let leads = [];
                try {
                    const clientsSnap = await getDocs(
                        query(collection(db, 'clients'), where('agronomistId', '==', agronomistId))
                    );
                    clients = clientsSnap.docs.map((d) => ({
                        name: d.data().name || '-',
                        notes: d.data().notes || ''
                    }));
                } catch (err) {
                    console.warn('Aviso: não foi possível carregar clientes para o relatório.', err);
                }

                try {
                    const leadsSnap = await getDocs(
                        query(collection(db, 'leads'), where('agronomistId', '==', agronomistId))
                    );
                    leads = leadsSnap.docs.map((d) => ({
                        name: d.data().name || '-',
                        notes: d.data().notes || ''
                    }));
                } catch (err) {
                    console.warn('Aviso: não foi possível carregar leads para o relatório.', err);
                }

                visits.sort((a, b) => a.date - b.date);

                if (!visits.length && !clients.length && !leads.length) {
                    showToast('Nenhum dado encontrado para os filtros selecionados.', 'info');
                    return;
                }

                const { jsPDF } = window.jspdf;
                const docPdf = new jsPDF();
                docPdf.setFontSize(14);
                docPdf.text(`Relatório de visitas - ${agronomistName}`, 10, 10);
                let y = 20;

                if (clients.length) {
                    docPdf.setFontSize(12);
                    docPdf.text('Clientes', 10, y);
                    y += 8;
                    clients.forEach((c, i) => {
                        const line = `${i + 1}. ${c.name}${c.notes ? ' - ' + c.notes : ''}`;
                        docPdf.text(line, 10, y);
                        y += 8;
                        if (y > 280) { docPdf.addPage(); y = 20; }
                    });
                    y += 4;
                }

                if (leads.length) {
                    docPdf.setFontSize(12);
                    docPdf.text('Leads', 10, y);
                    y += 8;
                    leads.forEach((l, i) => {
                        const line = `${i + 1}. ${l.name}${l.notes ? ' - ' + l.notes : ''}`;
                        docPdf.text(line, 10, y);
                        y += 8;
                        if (y > 280) { docPdf.addPage(); y = 20; }
                    });
                    y += 4;
                }

                if (visits.length) {
                    docPdf.setFontSize(12);
                    docPdf.text('Visitas', 10, y);
                    y += 8;
                    visits.forEach((v, i) => {
                        docPdf.text(`${i + 1}. ${v.line}`, 10, y);
                        y += 8;
                        if (y > 280) { docPdf.addPage(); y = 20; }
                    });
                }

                docPdf.save(`visitas-${agronomistName}.pdf`);
            } catch (error) {
                console.error('Erro ao gerar relatório:', error);
                showToast('Erro ao gerar relatório de visitas.', 'error');
            }
        }

        contentEl?.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="download-report"]');
            if (!btn) return;
            downloadVisitsReportFixed(btn.dataset.agronomistId, btn.dataset.agronomistName);
        });

        renderAgronomists();
    }

    /**
     * ABA 5: CLIENTES (Gestão de Clientes) - CORRIGIDA
     */
    async function initClientesTab() {
        if (isClientesTabInitialized) return;
        isClientesTabInitialized = true;
        
        // --- Referências aos Elementos do DOM ---
        const adminClientsList = document.getElementById('adminClientsList');
        const adminClientSearch = document.getElementById('adminClientSearch');
        const adminAddClientBtn = document.getElementById('adminAddClientBtn');
          const adminAddOperatorBtn = document.getElementById('adminAddOperatorBtn');
        
        const clientModal = document.getElementById('clientModal');
        const modulesModal = document.getElementById('modulesModal');
        const accessModal = document.getElementById('accessModal');
         const addOperatorModal = document.getElementById('addOperatorModal');
        const addOperatorForm = document.getElementById('addOperatorForm');
        const closeAddOperatorModalBtn = document.getElementById('closeAddOperatorModalBtn');
        const newOperatorNameInput = document.getElementById('newOperatorName');
        const newOperatorEmailInput = document.getElementById('newOperatorEmail');
        const newOperatorPasswordInput = document.getElementById('newOperatorPassword');
        const operatorClientSelect = document.getElementById('operatorClientSelect');

        // --- Estado da Aba ---
        let allClientsForAdmin = [];
        const availableModules = [{ id: 'reports', name: 'Relatório de Evolução' }, { id: 'photos', name: 'Galeria de Fotos do Talhão' }];

        // --- Funções de Renderização e Lógica ---

        function setupModalHTML() {
            clientModal.innerHTML = `
                <div class="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6">
                    <h3 id="clientModalTitle" class="text-lg font-bold text-gray-800 mb-4"></h3>
                    <div class="space-y-4">
                        <div>
                            <label for="clientModalName" class="block text-sm font-medium text-gray-700">Nome do Cliente</label>
                            <input type="text" id="clientModalName" class="mt-1 w-full p-2 border border-gray-300 rounded-md">
                        </div>
                        <div>
                            <label for="clientModalAgronomist" class="block text-sm font-medium text-gray-700">Agrônomo Responsável</label>
                            <select id="clientModalAgronomist" class="mt-1 w-full p-2 border border-gray-300 rounded-md"></select>
                        </div>
                    </div>
                    <div class="mt-6 flex justify-end gap-4">
                        <button type="button" data-action="close" class="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Cancelar</button>
                        <button type="button" data-action="save" class="px-6 py-2 text-white font-semibold rounded-lg" style="background-color: var(--brand-green);">Salvar</button>
                    </div>
                </div>`;

            modulesModal.innerHTML = `
                <div class="bg-white rounded-lg shadow-2xl w-full max-w-md">
                    <div class="p-6 border-b">
                        <h3 class="text-lg font-bold text-gray-800">Gerenciar Módulos</h3>
                        <p id="modulesModalClientName" class="text-sm text-gray-500"></p>
                    </div>
                    <div id="modulesList" class="p-6 space-y-3"></div>
                    <div class="p-4 bg-gray-50 border-t flex justify-end gap-4">
                        <button type="button" data-action="close" class="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Cancelar</button>
                        <button type="button" data-action="save" class="px-6 py-2 text-white font-semibold rounded-lg" style="background-color: var(--brand-green);">Salvar Módulos</button>
                    </div>
                </div>`;
            
            accessModal.innerHTML = `
                <div class="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6">
                    <h3 class="text-lg font-bold text-gray-800">Vincular Acesso de Cliente</h3>
                    <p id="accessModalClientName" class="text-sm text-gray-500 mb-4"></p>
                    <div>
                        <label for="clientUidInput" class="block text-sm font-medium text-gray-700">UID do Usuário no Firebase</label>
                        <input type="text" id="clientUidInput" placeholder="Cole o UID do Firebase Auth aqui" class="mt-1 w-full p-2 border border-gray-300 rounded-md">
                        <p class="text-xs text-gray-500 mt-1">O cliente deve se cadastrar e fornecer seu UID para o vínculo.</p>
                    </div>
                    <div class="mt-6 flex justify-end gap-4">
                        <button type="button" data-action="close" class="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Cancelar</button>
                        <button type="button" data-action="save" class="px-6 py-2 text-white font-semibold rounded-lg" style="background-color: var(--brand-green);">Vincular</button>
                    </div>
                </div>`;
        }
        
        async function loadAllClientsForManagement() {
            showSpinner(adminClientsList);
            try {
                // CORREÇÃO: Usando collection() e query() para v9
                const snapshot = await getDocs(query(collection(db, 'clients'), orderBy('name')));
                allClientsForAdmin = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                renderAdminClientList(allClientsForAdmin);
            } catch (error) {
                console.error("Erro ao carregar clientes para gestão:", error);
                adminClientsList.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Ocorreu um erro ao buscar os clientes.</td></tr>';
            } finally {
                hideSpinner(adminClientsList);
            }
        }

        function renderAdminClientList(clientsToRender) {
            adminClientsList.innerHTML = '';
            if (clientsToRender.length === 0) {
                adminClientsList.innerHTML = '<tr><td colspan="4" class="empty-state"><span>Nenhum cliente encontrado.</span><button id="emptyAddClientBtn" class="btn btn-primary">Adicionar cliente</button></td></tr>';
                const btn = document.getElementById("emptyAddClientBtn");
                if(btn) btn.addEventListener('click', () => openClientModal());
                return;
            }
            clientsToRender.forEach(client => {
                const assignedAgronomist = allAgronomists.find(a => a.id === client.agronomistId);
                const statusBadge = client.clientAuthUid ? `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>` : `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendente</span>`;
                const linkButton = !client.clientAuthUid ? `<button data-action="setup-access" data-client-id="${client.id}" data-client-name="${client.name}" class="btn btn-secondary btn-icon" title="Vincular Usuário"><i class="fas fa-link"></i></button>` : '';

                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50';
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap"><a href="client-details.html?clientId=${client.id}&from=admin" class="text-sm font-medium text-gray-900 hover:text-green-700" title="Ver detalhes do cliente">${client.name}</a></td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 responsive-hide">${assignedAgronomist ? assignedAgronomist.name : 'Nenhum'}</td>
                    <td class="px-6 py-4 whitespace-nowrap responsive-hide">${statusBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div class="flex gap-4 actions-desktop">
                            <button data-action="manage-modules" data-client-id="${client.id}" data-client-name="${client.name}" class="btn btn-secondary btn-icon" title="Gerenciar Módulos"><i class="fas fa-cog"></i></button>
                            <button data-action="edit-client" data-client-id="${client.id}" class="btn btn-secondary btn-icon" title="Editar Cliente"><i class="fas fa-pencil-alt"></i></button>
                            ${linkButton}
                        </div>
                        <a href="client-details.html?clientId=${client.id}&from=admin" class="btn btn-secondary details-mobile">+ detalhes</a>
                    </td>`;
                adminClientsList.appendChild(row);
            });
        }
        
        async function openClientModal(clientId = null) {
            currentEditingClientId = clientId;
            const titleEl = clientModal.querySelector('#clientModalTitle');
            const nameEl = clientModal.querySelector('#clientModalName');
            const agroEl = clientModal.querySelector('#clientModalAgronomist');

            if (clientId) {
                titleEl.textContent = "Editar Cliente";
                // CORREÇÃO: Usando doc() e getDoc() para v9
                const clientDoc = await getDoc(doc(db, 'clients', clientId));
                const clientData = clientDoc.data();
                nameEl.value = clientData.name;
                populateAgronomistDropdown(agroEl, clientData.agronomistId);
            } else {
                titleEl.textContent = "Adicionar Novo Cliente";
                nameEl.value = '';
                populateAgronomistDropdown(agroEl);
            }
            openModal(clientModal);
        }

        async function handleSaveClient() {
            const name = clientModal.querySelector('#clientModalName').value.trim();
            const agronomistId = clientModal.querySelector('#clientModalAgronomist').value;
            if (!name || !agronomistId) { showToast("Nome do cliente e agrônomo são obrigatórios.", 'error'); return; }
            
            const saveBtn = clientModal.querySelector('button[data-action="save"]');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';

            const clientData = { name, agronomistId };
            try {
                if (currentEditingClientId) {
                    // CORREÇÃO: Usando doc() e updateDoc() para v9
                    await updateDoc(doc(db, 'clients', currentEditingClientId), clientData);
                    showToast("Cliente atualizado com sucesso!", "success");
                } else {
                    // CORREÇÃO: Usando collection() e addDoc() para v9
                    await addDoc(collection(db, 'clients'), { ...clientData, status: 'ativo', isFavorite: false, tier: 'standard', createdAt: serverTimestamp(), propertyCount: 0, cultureCount: 0, enabledModules: {} });
                    showToast("Cliente criado com sucesso!", "success");
                }
                closeModal(clientModal);
                loadAllClientsForManagement();
            } catch (error) { 
                console.error("Erro ao salvar cliente:", error); 
                showToast("Ocorreu um erro ao salvar o cliente.", "error"); 
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Salvar';
            }
        }
        
        async function openModulesModal(buttonElement) {
            currentEditingClientId = buttonElement.dataset.clientId;
            modulesModal.querySelector('#modulesModalClientName').textContent = `Cliente: ${buttonElement.dataset.clientName}`;
            const listEl = modulesModal.querySelector('#modulesList');
            showSpinner(listEl);
            openModal(modulesModal);

            try {
                // CORREÇÃO: Usando doc() e getDoc() para v9
                const docSnap = await getDoc(doc(db, 'clients', currentEditingClientId));
                if (docSnap.exists()) {
                    const enabledModules = docSnap.data().enabledModules || {};
                    hideSpinner(listEl);
                    listEl.innerHTML = '';
                    availableModules.forEach(mod => {
                        const isChecked = enabledModules[mod.id] === true;
                        listEl.innerHTML += `<label class="flex items-center justify-between p-3 bg-gray-100 rounded-lg cursor-pointer"><span class="text-sm font-medium text-gray-900">${mod.name}</span><div class="relative inline-block w-10 align-middle select-none transition duration-200 ease-in"><input type="checkbox" data-module-id="${mod.id}" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" ${isChecked ? 'checked' : ''}/><label class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label></div></label>`;
                    });
                }
            } catch (error) {
                console.error("Erro ao abrir modal de módulos:", error);
                showToast("Não foi possível carregar as configurações do cliente.", "error");
            }
        }
        
        async function handleSaveModules() {
            if (!currentEditingClientId) return;
            const saveBtn = modulesModal.querySelector('button[data-action="save"]');
            saveBtn.disabled = true;
            const enabledModules = {};
            modulesModal.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                enabledModules[checkbox.dataset.moduleId] = checkbox.checked;
            });
            try {
                // CORREÇÃO: Usando doc() e updateDoc() para v9
                await updateDoc(doc(db, 'clients', currentEditingClientId), { enabledModules });
                closeModal(modulesModal);
                showToast('Módulos salvos com sucesso!', 'success');
            } catch (error) {
                console.error("Erro ao salvar módulos:", error);
                showToast('Não foi possível salvar os módulos.', 'error');
            } finally {
                saveBtn.disabled = false;
            }
        }

        function openAccessModal(buttonElement) {
            currentEditingClientId = buttonElement.dataset.clientId;
            accessModal.querySelector('#accessModalClientName').textContent = `Cliente: ${buttonElement.dataset.clientName}`;
            accessModal.querySelector('#clientUidInput').value = '';
            openModal(accessModal);
        }

        async function handleLinkClientUid() {
            const uidInput = accessModal.querySelector('#clientUidInput');
            const saveBtn = accessModal.querySelector('button[data-action="save"]');
            const uid = uidInput.value.trim();
            if (!uid || uid.length < 28) { showToast('Por favor, insira um UID válido do Firebase.', 'error'); return; }
            
            saveBtn.disabled = true;
            saveBtn.textContent = 'Vinculando...';
            try {
                // CORREÇÃO: Usando writeBatch(db) para v9
                const batch = writeBatch(db);
                // CORREÇÃO: Usando doc() para v9
                const clientRef = doc(db, 'clients', currentEditingClientId);
                const userRef = doc(db, 'users', uid);
                batch.update(clientRef, { clientAuthUid: uid });
                batch.set(userRef, { role: 'cliente' }, { merge: true });
                await batch.commit();
                closeModal(accessModal);
                loadAllClientsForManagement();
                showToast('Usuário vinculado com sucesso!', 'success');
            } catch (error) { 
                console.error("Erro ao vincular UID do cliente:", error); 
                showToast('Ocorreu um erro ao vincular o usuário.', 'error'); 
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Vincular';
            }
        }


        function openAddOperatorModal() {
            if (operatorClientSelect) operatorClientSelect.innerHTML = '<option value="">Selecione uma fazenda...</option>';
            allClientsForAdmin.forEach(client => {
                if (operatorClientSelect) operatorClientSelect.innerHTML += `<option value="${client.id}">${client.name}</option>`;
            });
            openModal(addOperatorModal);
        }

        async function handleAddOperator(e) {
            e.preventDefault();
            const name = newOperatorNameInput.value.trim();
            const email = newOperatorEmailInput.value.trim();
            const password = newOperatorPasswordInput.value.trim();
            const farmClientId = operatorClientSelect.value;

            if (!name || !email || !password || !farmClientId) {
                showToast('Por favor, preencha todos os campos.', 'error');
                return;
            }
            if (password.length < 6) {
                showToast('A senha deve ter pelo menos 6 caracteres.', 'error');
                return;
            }

            showSpinner(addOperatorModal);
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    name,
                    email,
                    role: 'operador',
                    farmClientId,
                    createdAt: serverTimestamp(),
                    createdByAdminId: userId
                });
                showToast('Funcionário adicionado com sucesso!', 'success');
                closeModal(addOperatorModal);
                if (addOperatorForm) addOperatorForm.reset();
            } catch (error) {
                console.error('Erro ao adicionar funcionário:', error);
                let errorMessage = 'Erro ao adicionar funcionário.';
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'Este email já está em uso.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Formato de email inválido.';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = 'A senha é muito fraca. Use pelo menos 6 caracteres.';
                }
                showToast(errorMessage, 'error');
            } finally {
                hideSpinner(addOperatorModal);
            }
        }

        // --- Event Listeners (Delegação de Eventos) ---
        adminClientSearch.addEventListener('input', () => renderAdminClientList(allClientsForAdmin.filter(c => c.name.toLowerCase().includes(adminClientSearch.value.toLowerCase()))));
        adminAddClientBtn.addEventListener('click', () => openClientModal());
         if (adminAddOperatorBtn) adminAddOperatorBtn.addEventListener('click', () => openAddOperatorModal());

        adminClientsList.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const action = button.dataset.action;
            if (action === 'edit-client') openClientModal(button.dataset.clientId);
            if (action === 'manage-modules') openModulesModal(button);
            if (action === 'setup-access') openAccessModal(button);
        });

        clientModal.addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (action === 'close') closeModal(clientModal);
            if (action === 'save') handleSaveClient();
        });
        modulesModal.addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (action === 'close') closeModal(modulesModal);
            if (action === 'save') handleSaveModules();
        });
        accessModal.addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (action === 'close') closeModal(accessModal);
            if (action === 'save') handleLinkClientUid();
        });
         if (closeAddOperatorModalBtn) closeAddOperatorModalBtn.addEventListener('click', () => closeModal(addOperatorModal));
        if (addOperatorForm) addOperatorForm.addEventListener('submit', handleAddOperator);
        
        // --- Carga Inicial da Aba ---
        setupModalHTML();
        loadAllClientsForManagement();
    }
    
    // ===================================================================
    // ||                    LÓGICA GERAL E INICIALIZAÇÃO               ||
    // ===================================================================
    
    async function loadAllAgronomists() {
        try {
            // CORREÇÃO: Usando collection() e query() para v9
            const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'agronomo'), orderBy('name')));
            allAgronomists = usersSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || `Agrônomo ${doc.id.substring(0,5)}` }));
        } catch (error) {
            console.error("Erro ao carregar agrônomos:", error);
            showToast("Falha ao carregar agrônomos.", 'error');
        }
    }

    function populateAgronomistDropdown(selectElement, selectedId = '') {
        if (!selectElement) return;
        selectElement.innerHTML = '<option value="">-- Selecione um agrônomo --</option>';
        allAgronomists.forEach(agro => {
            const isSelected = agro.id === selectedId ? 'selected' : '';
            selectElement.innerHTML += `<option value="${agro.id}" ${isSelected}>${agro.name}</option>`;
        });
    }

    const initializeAdminPage = async () => {
        await loadAllAgronomists();
        switchTab('dashboard'); 
    };

    initializeAdminPage();
}
