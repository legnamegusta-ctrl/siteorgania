// js/pages/plot-details.js

import { db } from '../config/firebase.js';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, addDoc, serverTimestamp, onSnapshot, increment, getDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { showToast, showSpinner, hideSpinner, openModal, closeModal } from '../services/ui.js';

export function initPlotDetails(userId, userRole) {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    const propertyId = params.get('propertyId');
    const plotId = params.get('plotId');
    const cultureId = params.get('cultureId');
    const from = params.get('from') || 'agronomo';

    // --- Elementos da Página e Modais ---
    const plotNameHeader = document.getElementById('plotNameHeader');
    const cultureInfo = document.getElementById('cultureInfo');
    const propertyClientInfo = document.getElementById('propertyClientInfo');
    const plantsCountInfo = document.getElementById('plantsCountInfo'); // NOVO
    const backBtn = document.getElementById('backBtn');
    const timelineContainer = document.getElementById('cultureTimeline');
    const viewReportBtn = document.getElementById('viewReportBtn');
    const showAddAnalysisModalBtn = document.getElementById('showAddAnalysisModalBtn');
    const showAddManagementModalBtn = document.getElementById('showAddManagementModalBtn');

    const analysisModal = document.getElementById('analysisModal');
    const analysisModalTitle = document.getElementById('analysisModalTitle');
    const closeAnalysisModalBtn = document.getElementById('closeAnalysisModalBtn');
    const saveAnalysisBtn = document.getElementById('saveAnalysisBtn');
    const analysisForm = analysisModal.querySelector('form');

    const viewAnalysisModal = document.getElementById('viewAnalysisModal');
    const viewAnalysisContent = document.getElementById('viewAnalysisContent');
    const closeViewAnalysisModalBtn = document.getElementById('closeViewAnalysisModalBtn');
    const editAnalysisBtn = document.getElementById('editAnalysisBtn');

    const managementModal = document.getElementById('managementModal');
    const managementForm = document.getElementById('managementForm');
    const closeManagementModalBtn = document.getElementById('closeManagementModalBtn');
    const addManagementBtn = document.getElementById('addManagementBtn');
    const managementTypeSelect = document.getElementById('managementType');

    const descriptionFieldContainer = document.getElementById('descriptionFieldContainer');
    const productionFieldContainer = document.getElementById('productionFieldContainer');
    const imageLinkContainer = document.getElementById('imageLinkContainer');
    const plotImageUrlInput = document.getElementById('plotImageUrl');

    const photoGallerySection = document.getElementById('photoGallerySection');
    const photoGallery = document.getElementById('photoGallery');
    const imageLightboxModal = document.getElementById('imageLightboxModal');
    const lightboxImage = document.getElementById('lightboxImage');
    const closeLightboxBtn = document.getElementById('closeLightboxBtn');

    // --- Variáveis de Estado ---
    let currentEditingAnalysisId = null;
    let allTimelineItems = [];
    let visibleItemCount = 6;
    const culturePath = `clients/${clientId}/properties/${propertyId}/plots/${plotId}/culturas/${cultureId}`;
    const statsPath = `stats/globalStats`;
    let allUsersCache = {}; // Para buscar nomes de responsáveis

    const referenceLevels = {
        ph_cacl2: { label: 'pH (CaCl₂ 0,01M)', min: 5.2, max: 5.6 },
        ph_h2o: { label: 'pH (H₂O)', min: 5.9, max: 6.3 },
        h_al: { label: 'Tampão SMP (H+Al)', min: 3.9, max: 4.4 },
        al_trocavel: { label: 'Al-(Acidez Trocável)', max: 0.1 },
        carbono_organico: { label: 'Carbono Orgânico', min: 1.7, max: 2.0 },
        materia_organica: { label: 'Matéria Orgânica (%)', min: 3.0, max: 4.0 },
        fosforo_rem: { label: 'Fósforo Remanescente' },
        fosforo_ncp: { label: 'Fósforo Nível Crítico (NCP)' },
        fosforo_pri: { label: 'Fósforo Relativo PRI(%)' },
        calcio: { label: 'Cálcio (Ca)', min: 2.5, max: 4.0 },
        magnesio: { label: 'Magnésio (Mg)', min: 0.8, max: 1.5 },
        potassio_cmolc: { label: 'Potássio Mehlich (K)', min: 0.25, max: 0.40 },
        soma_bases: { label: 'S.B (Soma das Bases)', min: 4.0, max: 5.5 },
        fosforo_mehlich: { label: 'Fósforo Mehlich (P)', min: 100, max: 160 },
        enxofre: { label: 'Enxofre (S)', min: 15.0, max: 20.0 },
        boro: { label: 'Boro (B)', min: 0.60, max: 0.80 },
        cobre: { label: 'Cobre (Cu)', min: 0.5, max: 1.0 },
        ferro: { label: 'Ferro (Fe)', min: 10, max: 30 },
        zinco: { label: 'Zinco (Zn)', min: 1.5, max: 3.0 },
        manganes: { label: 'Manganês (Mn)', min: 5.0, max: 20.0 },
        ctc_efetiva: { label: 'CTC Efetiva', min: 8.0, max: 10.0 },
        ctc_ph7: { label: 'CTC (pH 7.0)', min: 8.0, max: 10.0 },
        v_percent: { label: 'V% (Saturação por Bases)', min: 50, max: 70 },
        m_percent: { label: 'm% (Saturação de Al)', max: 15.0 },
        perc_al_ctc: { label: '% Alumínio na C.T.C', max: 15.0 },
        perc_h_ctc: { label: '% Hidrogênio na C.T.C', min: 15.0, max: 30.0 },
        perc_ca_ctc: { label: '% Cálcio na C.T.C', min: 35.0, max: 50.0 },
        perc_mg_ctc: { label: '% Magnésio na C.T.C', min: 13.0, max: 20.0 },
        perc_k_ctc: { label: '% Potássio na C.T.C', min: 3.5, max: 5.0 },
        rel_ca_mg: { label: 'Relação Ca/Mg', min: 3, max: 5 },
        rel_ca_k: { label: 'Relação Ca/K', min: 7, max: 10 },
        rel_mg_k: { label: 'Relação Mg/K', min: 3, max: 4 }
    };

    async function initializeCultureDashboard() {
        if (!clientId || !propertyId || !plotId || !cultureId) {
            if (plotNameHeader) plotNameHeader.textContent = "Erro: Informações Faltando na URL.";
            return;
        }

        let backUrl;
        if (userRole === 'cliente') {
            backUrl = `dashboard-cliente.html`; // Cliente volta para seu dashboard
        } else if (userRole === 'operador') {
             backUrl = `operador-dashboard.html`; // Operador volta para seu dashboard
        }
        else { // Agronomo, Admin
            backUrl = `property-details.html?clientId=${clientId}&propertyId=${propertyId}&from=${from}`;
        }
        if (backBtn) backBtn.href = backUrl;

        // Controle de visibilidade de botões de edição/adição
        if (userRole === 'agronomo') {
            if (showAddAnalysisModalBtn) showAddAnalysisModalBtn.style.display = 'inline-flex';
            if (showAddManagementModalBtn) showAddManagementModalBtn.style.display = 'inline-flex';
            if (editAnalysisBtn) editAnalysisBtn.style.display = 'inline-block';
        } else { // Cliente, Operador, Admin
            if (showAddAnalysisModalBtn) showAddAnalysisModalBtn.style.display = 'none';
            if (showAddManagementModalBtn) showAddManagementModalBtn.style.display = 'none';
            if (editAnalysisBtn) editAnalysisBtn.style.display = 'none'; // Cliente e Operador não editam análises
        }
        // O operador pode adicionar manejos rapidamente do dashboard dele, não precisa deste botão aqui.

        await loadAllUsersForCache(); // Carrega cache de usuários
        await Promise.all([loadHeaderData(), buildTimeline()]);
        addEventListeners();
        setupBottomNavbarListeners(); // NOVO: Chama a função para configurar os listeners da navbar
    }

    async function loadAllUsersForCache() {
        try {
            const usersSnapshot = await getDocs(collection(db, 'users')); // Busca todos os usuários
            usersSnapshot.forEach(docSnap => {
                allUsersCache[docSnap.id] = docSnap.data().name || `Usuário ${docSnap.id.substring(0,5)}`;
            });
            console.log('Plot Details: Cache de usuários carregado:', allUsersCache);
        } catch (error) {
            console.error("Erro ao carregar cache de usuários:", error);
            showToast("Erro ao carregar dados de usuários para responsáveis.", "error");
        }
    }


    async function loadHeaderData() {
        try {
            const clientPromise = getDoc(doc(collection(db, 'clients'), clientId));
            const propertyPromise = getDoc(doc(collection(db, `clients/${clientId}/properties`), propertyId));
            const plotPromise = getDoc(doc(collection(db, `clients/${clientId}/properties/${propertyId}/plots`), plotId));
            const culturePromise = getDoc(doc(collection(db, `clients/${clientId}/properties/${propertyId}/plots/${plotId}/culturas`), cultureId));

            const [clientDoc, propertyDoc, plotDoc, cultureDoc] = await Promise.all([clientPromise, propertyPromise, plotPromise, culturePromise]);

            if (!cultureDoc.exists()) {
                console.error("ERRO: Documento da cultura não encontrado para o cultureId:", cultureId);
                if (plotNameHeader) plotNameHeader.textContent = "Cultura não encontrada.";
                if (cultureInfo) cultureInfo.textContent = "Verifique o ID da cultura na URL ou no Firestore.";
                if (propertyClientInfo) propertyClientInfo.textContent = "";
                if (plantsCountInfo) plantsCountInfo.textContent = "";
                return;
            }

            const clientData = clientDoc.data();
            const propertyData = propertyDoc.data();
            const plotData = plotDoc.data();
            let cultureData = cultureDoc.data();

            if (plotNameHeader) plotNameHeader.textContent = plotData.name;

            let startDateFormatted = 'N/A';
            if (cultureData.startDate) {
                let dateObject;
                if (typeof cultureData.startDate.toDate === 'function') {
                    dateObject = cultureData.startDate.toDate();
                } else if (typeof cultureData.startDate === 'object' && cultureData.startDate.seconds !== undefined) {
                    dateObject = new Date(cultureData.startDate.seconds * 1000 + cultureData.startDate.nanoseconds / 1000000);
                } else if (typeof cultureData.startDate === 'string') {
                    dateObject = new Date(cultureData.startDate);
                } else {
                    dateObject = new Date(cultureData.startDate);
                }

                if (!isNaN(dateObject.getTime())) {
                    startDateFormatted = dateObject.toLocaleDateString('pt-BR');
                }
            }
            if (cultureInfo) cultureInfo.textContent = `Cultura de ${cultureData.cropName} (Início: ${startDateFormatted})`;

            if (propertyClientInfo) propertyClientInfo.textContent = `${propertyData.name} | Cliente: ${clientData.name}`;
            if (plantsCountInfo) plantsCountInfo.textContent = `Pés/Plantas: ${plotData.plantsCount || 'N/A'}`; // NOVO: Exibe quantidade de plantas

            const photoModuleEnabled = clientData?.enabledModules?.photos;
            const reportModuleEnabled = clientData?.enabledModules?.reports;
            const photoOption = managementTypeSelect ? managementTypeSelect.querySelector('option[value="foto_talhao"]') : null;

            if (viewReportBtn) viewReportBtn.style.display = reportModuleEnabled ? 'inline-block' : 'none';
            if (photoGallerySection) photoGallerySection.style.display = photoModuleEnabled ? 'block' : 'none';
            if (photoOption) photoOption.style.display = photoModuleEnabled ? 'block' : 'none';
        } catch (error) {
            console.error("Erro ao carregar cabeçalho:", error);
            if (plotNameHeader) plotNameHeader.textContent = "Erro ao carregar dados.";
        }
    }

    async function buildTimeline() {
        if (timelineContainer) showSpinner(timelineContainer);
        if (photoGallery) showSpinner(photoGallery);
        try {
            const analysesQuery = query(collection(db, `${culturePath}/analyses`), orderBy('date', 'desc'));
            const managementsQuery = query(collection(db, `${culturePath}/managements`), orderBy('date', 'desc'));

            const [analysesSnapshot, managementsSnapshot] = await Promise.all([getDocs(analysesQuery), getDocs(managementsQuery)]);

            allTimelineItems = [];
            analysesSnapshot.forEach(docSnap => { allTimelineItems.push({ ...docSnap.data(), eventGroup: 'analysis', id: docSnap.id }); });
            managementsSnapshot.forEach(docSnap => { allTimelineItems.push({ ...docSnap.data(), eventGroup: 'management', id: docSnap.id }); });

            allTimelineItems.forEach(item => {
                let tempDateObject;
                if (item.date && typeof item.date.toDate === 'function') {
                    tempDateObject = item.date.toDate();
                } else if (item.date && typeof item.date === 'object' && item.date.seconds !== undefined) {
                    tempDateObject = new Date(item.date.seconds * 1000 + item.date.nanoseconds / 1000000);
                } else if (item.date) {
                    tempDateObject = new Date(item.date);
                } else {
                    tempDateObject = new Date('Invalid Date');
                }
                item.dateObj = !isNaN(tempDateObject.getTime()) ? tempDateObject : new Date('Invalid Date');

                let responsible = 'Desconhecido';
                if (item.registeredByName) {
                    responsible = item.registeredByName;
                } else if (item.registeredById && allUsersCache[item.registeredById]) {
                    responsible = allUsersCache[item.registeredById];
                } else if (item.responsibleAgronomistId && allUsersCache[item.responsibleAgronomistId]) { 
                    responsible = allUsersCache[item.responsibleAgronomistId];
                }
                item.responsible = responsible;
            });
            allTimelineItems.sort((a, b) => b.dateObj - a.dateObj);

            renderTimelineItems();

        } catch (error) {
            console.error("Erro ao construir a linha do tempo:", error);
            if (timelineContainer) timelineContainer.innerHTML = "<p class='text-red-500'>Erro ao carregar eventos.</p>";
        } finally {
            if (timelineContainer) hideSpinner(timelineContainer);
            if (photoGallery) hideSpinner(photoGallery);
        }
    }

    function renderTimelineItems() {
        if (!timelineContainer || !photoGallery) return;

        timelineContainer.innerHTML = '';
        photoGallery.innerHTML = '';

        const itemsToRender = allTimelineItems.slice(0, visibleItemCount);

        if (itemsToRender.length === 0) {
            timelineContainer.innerHTML = "<p class='text-gray-500'>Nenhum evento registrado para esta cultura ainda.</p>";
            return;
        }

        itemsToRender.forEach(item => {
            const itemDate = !isNaN(item.dateObj.getTime()) ? item.dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Data Inválida';
            let itemCardHtml = '';

            const taskIdAttr = item.taskId ? `data-task-id="${item.taskId}"` : '';
            const isAnalysis = item.eventGroup === 'analysis';
            const isManagement = item.eventGroup === 'management';

            const cardClass = isAnalysis ? 'analysis-card' : 'management-card';
            const dataEventType = item.eventGroup;
            const dataEventId = item.id;

            let statusBadgeHtml = '';
            if (item.status) {
                let statusColorClass = 'bg-gray-100 text-gray-800';
                if (item.status === 'Concluída') {
                    statusColorClass = 'bg-green-100 text-green-800';
                } else if (item.status === 'Em Andamento') {
                    statusColorClass = 'bg-blue-100 text-blue-800';
                } else if (item.status === 'Pendente') {
                    statusColorClass = 'bg-orange-100 text-orange-800';
                }
                statusBadgeHtml = `<span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColorClass}">${item.status}</span>`;
            }

            const photoCount = item.imageUrls ? item.imageUrls.length : 0;
            const photoHtml = photoCount > 0 ? `<span class="inline-flex items-center text-gray-600 text-sm ml-2"><i class="fas fa-camera mr-1"></i>${photoCount} fotos</span>` : '';

            const responsibleHtml = `<p class="text-xs text-gray-500">Responsável: ${item.responsible}</p>`;

            if (isAnalysis) {
                const interpretationHtml = item.agronomistInterpretation ? `<p class="mt-2 text-sm text-gray-600 whitespace-pre-wrap italic">"${item.agronomistInterpretation}"</p>` : '<p class="mt-2 text-sm text-gray-500 italic">Nenhuma interpretação adicionada.</p>';
                itemCardHtml = `
                    <div class="timeline-item relative pb-8">
                        <div class="${cardClass} p-4 bg-gray-50 rounded-lg hover:shadow-md hover:bg-gray-100 cursor-pointer transition-shadow" data-event-type="${dataEventType}" data-event-id="${dataEventId}" ${taskIdAttr}>
                            <div class="flex justify-between items-center mb-1">
                                <h4 class="text-lg font-bold" style="color:var(--brand-green);">Análise de Solo</h4>
                                ${statusBadgeHtml}
                            </div>
                            <time class="mb-1 text-sm font-normal text-gray-400">${itemDate}</time>
                            ${responsibleHtml}
                            ${interpretationHtml}
                            <div class="mt-3 text-right">
                                <button class="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm view-details-btn">
                                    Ver Detalhes
                                </button>
                            </div>
                        </div>
                    </div>`;
            } else if (isManagement) {
                let title = item.type ? item.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : "Evento";
                const styleClass = 'text-lg font-bold text-blue-600';
                const costHtml = item.cost > 0 ? `<span class="font-bold">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.cost)}</span>` : '';

                let descriptionContent = item.description ? `<p>${item.description}</p>` : '';
                if (item.production) {
                    descriptionContent += `<p class="mt-2 font-semibold text-gray-800">Produção: <span class="font-normal">${item.production}</span></p>`;
                }
                if (item.type === 'foto_talhao' && photoCount > 0 && item.imageUrls[0]) {
                    descriptionContent += `<img src="${item.imageUrls[0]}" alt="Foto: ${item.description || title}" class="photo-thumbnail timeline-photo" data-src="${item.imageUrls[0]}">`;
                }

                itemCardHtml = `
                    <div class="timeline-item relative pb-8">
                        <div class="flex justify-between items-center flex-wrap gap-x-4">
                            <h4 class="${styleClass}">${title}</h4>${costHtml}
                        </div>
                        <time class="mb-2 text-sm font-normal text-gray-400">${itemDate}</time>
                        ${responsibleHtml}
                        ${photoHtml}
                        <div class="p-4 bg-blue-50 border-l-4 border-blue-300 rounded-r-lg text-gray-700" data-event-type="${dataEventType}" data-event-id="${dataEventId}" ${taskIdAttr}>
                            ${descriptionContent || '<p class="text-gray-500 italic">Nenhuma descrição adicionada.</p>'}
                            <div class="mt-3 text-right">
                                <button class="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-sm view-details-btn">
                                    Ver Detalhes
                                </button>
                            </div>
                        </div>
                    </div>`;
            }
            timelineContainer.innerHTML += itemCardHtml;

            if (photoCount > 0 && isManagement && item.imageUrls && item.imageUrls.length > 0) {
                item.imageUrls.forEach(url => {
                    photoGallery.innerHTML += `<div class="gallery-image-container"><img src="${url}" alt="${item.description || title}" class="gallery-image timeline-photo" data-src="${url}"></div>`;
                });
            }
        });

        if (visibleItemCount < allTimelineItems.length) {
            const seeMoreButton = `<div class="text-center mt-4"><button id="seeMoreBtn" class="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Ver Mais</button></div>`;
            timelineContainer.innerHTML += seeMoreButton;
        }
    }

    function openViewAnalysisModal(analysisId) {
        const analysisData = allTimelineItems.find(item => item.id === analysisId && item.eventGroup === 'analysis');
        if (!analysisData) return;

        currentEditingAnalysisId = analysisId;

        const getColoredValue = (value, key) => {
            const levels = referenceLevels[key] || {};
            if (value === undefined || value === null) return '<span>N/A</span>';
            if (levels.min !== undefined && value < levels.min) return `<span class="value-red font-bold">${value} (Baixo)</span>`;
            if (levels.max !== undefined && value > levels.max) return `<span class="value-red font-bold">${value} (Alto)</span>`;
            if (levels.min !== undefined || levels.max !== undefined) return `<span class="value-green font-bold">${value}</span>`;
            return `<span>${value}</span>`;
        };

        let contentHtml = '';
        const sections = {
            'Reação do Solo e Propriedades': ['ph_cacl2', 'ph_h2o', 'h_al', 'al_trocavel', 'carbono_organico', 'materia_organica', 'fosforo_rem', 'fosforo_ncp', 'fosforo_pri'],
            'Macro e Micronutrientes': ['calcio', 'magnesio', 'potassio_cmolc', 'soma_bases', 'fosforo_mehlich', 'enxofre', 'boro', 'cobre', 'ferro', 'zinco', 'manganes'],
            'Índice de Saturação e Relações': ['ctc_efetiva', 'ctc_ph7', 'v_percent', 'm_percent', 'perc_al_ctc', 'perc_h_ctc', 'perc_ca_ctc', 'perc_mg_ctc', 'perc_k_ctc', 'rel_ca_mg', 'rel_ca_k', 'rel_mg_k']
        };

        for (const [sectionTitle, fields] of Object.entries(sections)) {
            const sectionFields = fields.filter(key => analysisData[key] !== undefined);
            if (sectionFields.length > 0) {
                contentHtml += `<h4 class="col-span-full font-semibold text-lg border-b pb-2 mt-4 mb-2" style="color: var(--brand-green);">${sectionTitle}</h4>`;
                contentHtml += '<div class="details-grid col-span-full">';
                sectionFields.forEach(key => {
                    const label = referenceLevels[key]?.label || key;
                    const value = analysisData[key];
                    contentHtml += `<div class="details-grid-item"><strong>${label}:</strong> ${getColoredValue(value, key)}</div>`;
                });
                contentHtml += '</div>';
            }
        }

        if(analysisData.agronomistInterpretation) {
            contentHtml += `<div class="col-span-full mt-4 pt-4 border-t"><strong class="font-semibold mb-1 text-gray-700">Interpretação do Agrônomo</strong><p class="whitespace-pre-wrap text-gray-800">${analysisData.agronomistInterpretation}</p></div>`;
        }

        if (viewAnalysisContent) viewAnalysisContent.innerHTML = contentHtml;
        if (editAnalysisBtn) editAnalysisBtn.style.display = userRole === 'agronomo' ? 'inline-block' : 'none';
        openModal(viewAnalysisModal); // LÓGICA DE MODAL ATUALIZADA
    }

    function openEditAnalysisModal() {
        const analysisData = allTimelineItems.find(item => item.id === currentEditingAnalysisId);
        if (!analysisData) return;

        closeModal(viewAnalysisModal); // LÓGICA DE MODAL ATUALIZADA
        if (analysisModalTitle) analysisModalTitle.textContent = "Editar Análise de Solo";

        if (analysisForm) analysisForm.reset();
        for(const key in analysisData) {
            const input = document.getElementById(key);
            if(input) { input.value = analysisData[key] || ''; }
        }
        const analysisDateElement = document.getElementById('analysisDate');
        if (analysisDateElement) analysisDateElement.value = analysisData.date;
        const agronomistInterpretationElement = document.getElementById('agronomistInterpretation');
        if (agronomistInterpretationElement) agronomistInterpretationElement.value = analysisData.agronomistInterpretation || '';

        openModal(analysisModal); // LÓGICA DE MODAL ATUALIZADA
    }

    async function saveAnalysis() {
        const analysisDateInput = document.getElementById('analysisDate');
        const ph_cacl2Input = document.getElementById('ph_cacl2');
        const ph_h2oInput = document.getElementById('ph_h2o');
        const h_alInput = document.getElementById('h_al');
        const al_trocavelInput = document.getElementById('al_trocavel');
        const carbono_organicoInput = document.getElementById('carbono_organico');
        const materia_organicaInput = document.getElementById('materia_organica');
        const fosforo_remInput = document.getElementById('fosforo_rem');
        const fosforo_ncpInput = document.getElementById('fosforo_ncp');
        const fosforo_priInput = document.getElementById('fosforo_pri');
        const calcioInput = document.getElementById('calcio');
        const magnesioInput = document.getElementById('magnesio');
        const potassio_cmolcInput = document.getElementById('potassio_cmolc');
        const fosforo_mehlichInput = document.getElementById('fosforo_mehlich');
        const enxofreInput = document.getElementById('enxofre');
        const boroInput = document.getElementById('boro');
        const cobreInput = document.getElementById('cobre');
        const ferroInput = document.getElementById('ferro');
        const zincoInput = document.getElementById('zinco');
        const manganesInput = document.getElementById('manganes');
        const agronomistInterpretationInput = document.getElementById('agronomistInterpretation');

        const rawData = {
            date: analysisDateInput ? analysisDateInput.value : '',
            ph_cacl2: ph_cacl2Input ? parseFloat(ph_cacl2Input.value) || null : null,
            ph_h2o: ph_h2oInput ? parseFloat(ph_h2oInput.value) || null : null,
            h_al: h_alInput ? parseFloat(h_alInput.value) || null : null,
            al_trocavel: al_trocavelInput ? parseFloat(al_trocavelInput.value) || null : null,
            carbono_organico: carbono_organicoInput ? parseFloat(carbono_organicoInput.value) || null : null,
            materia_organica: materia_organicaInput ? parseFloat(materia_organicaInput.value) || null : null,
            fosforo_rem: fosforo_remInput ? parseFloat(fosforo_remInput.value) || null : null,
            fosforo_ncp: fosforo_ncpInput ? parseFloat(fosforo_ncpInput.value) || null : null,
            fosforo_pri: fosforo_priInput ? parseFloat(fosforo_priInput.value) || null : null,
            calcio: calcioInput ? parseFloat(calcioInput.value) || null : null,
            magnesio: magnesioInput ? parseFloat(magnesioInput.value) || null : null,
            potassio_cmolc: potassio_cmolcInput ? parseFloat(potassio_cmolcInput.value) || null : null,
            fosforo_mehlich: fosforo_mehlichInput ? parseFloat(fosforo_mehlichInput.value) || null : null,
            enxofre: enxofreInput ? parseFloat(enxofreInput.value) || null : null,
            boro: boroInput ? parseFloat(boroInput.value) || null : null,
            cobre: cobreInput ? parseFloat(cobreInput.value) || null : null,
            ferro: ferroInput ? parseFloat(ferroInput.value) || null : null,
            zinco: zincoInput ? parseFloat(zincoInput.value) || null : null,
            manganes: manganesInput ? parseFloat(manganesInput.value) || null : null,
            agronomistInterpretation: agronomistInterpretationInput ? agronomistInterpretationInput.value.trim() || null : null,
        };

        if (!rawData.date) { showToast("A data da análise é obrigatória.", 'error'); return; }

        const calculatedData = {};
        const Ca = rawData.calcio || 0, Mg = rawData.magnesio || 0, K = rawData.potassio_cmolc || 0, Al = rawData.al_trocavel || 0, H_Al = rawData.h_al || 0;
        const SB = Ca + Mg + K;
        const ctc_efetiva = SB + Al;
        const ctc_ph7 = SB + H_Al;

        calculatedData.soma_bases = parseFloat(SB.toFixed(2));
        calculatedData.ctc_efetiva = parseFloat(ctc_efetiva.toFixed(2));
        calculatedData.ctc_ph7 = parseFloat(ctc_ph7.toFixed(2));

        if (ctc_ph7 > 0) {
            calculatedData.v_percent = parseFloat(((SB * 100) / ctc_ph7).toFixed(1));
            calculatedData.perc_ca_ctc = parseFloat(((Ca * 100) / ctc_ph7).toFixed(1));
            calculatedData.perc_mg_ctc = parseFloat(((Mg * 100) / ctc_ph7).toFixed(1));
            calculatedData.perc_k_ctc = parseFloat(((K * 100) / ctc_ph7).toFixed(1));
            calculatedData.perc_h_ctc = parseFloat(((H_Al * 100) / ctc_ph7).toFixed(1));
        }
        if (ctc_efetiva > 0) {
            calculatedData.m_percent = parseFloat(((Al * 100) / ctc_efetiva).toFixed(1));
            calculatedData.perc_al_ctc = parseFloat(((Al * 100) / ctc_efetiva).toFixed(1));
        }
        if (Mg > 0) calculatedData.rel_ca_mg = parseFloat((Ca / Mg).toFixed(1));
        if (K > 0) { calculatedData.rel_ca_k = parseFloat((Ca / K).toFixed(1)); calculatedData.rel_mg_k = parseFloat((Mg / K).toFixed(1)); }

        let finalData = { ...rawData, ...calculatedData };
        Object.keys(finalData).forEach(key => (finalData[key] === null || (typeof finalData[key] === 'number' && isNaN(finalData[key]))) && delete finalData[key]);
        finalData.date = rawData.date;
        if (rawData.agronomistInterpretation) { finalData.agronomistInterpretation = rawData.agronomistInterpretation; }

        finalData.registeredById = userId;
        finalData.registeredByName = allUsersCache[userId] || 'Agrônomo Desconhecido';

        try {
            const docRef = currentEditingAnalysisId ? doc(collection(db, `${culturePath}/analyses`), currentEditingAnalysisId) : doc(collection(db, `${culturePath}/analyses`));
            if (currentEditingAnalysisId) {
                await updateDoc(docRef, finalData);
                showToast("Análise atualizada com sucesso!", "success");
            } else {
                const batch = writeBatch(db);
                batch.set(docRef, finalData);
                batch.update(doc(db, statsPath), { totalAnalyses: increment(1) });
                await batch.commit();
                showToast("Análise completa salva com sucesso!", "success");
            }
            closeModal(analysisModal); 
            currentEditingAnalysisId = null;
            buildTimeline();
        } catch (error) { console.error("Erro ao salvar análise:", error); showToast('Ocorreu um erro ao salvar a análise.', 'error'); }
    }

    async function handleAddManagement() {
        if (!addManagementBtn || !managementTypeSelect || !document.getElementById('managementDate')) return;

        addManagementBtn.disabled = true;
        addManagementBtn.textContent = 'Salvando...';

        const managementDateInput = document.getElementById('managementDate');
        const managementDescriptionInput = document.getElementById('managementDescription');
        const managementCostInput = document.getElementById('managementCost');
        const managementProductionInput = document.getElementById('managementProduction');

        const managementData = {
            date: managementDateInput.value,
            type: managementTypeSelect.value,
            description: managementDescriptionInput ? managementDescriptionInput.value.trim() : '',
            cost: managementCostInput ? (parseFloat(managementCostInput.value) || 0) : 0,
            imageUrls: []
        };

        if (!managementData.date) {
            showToast("A data do evento é obrigatória.", 'error');
            addManagementBtn.disabled = false;
            addManagementBtn.textContent = 'Salvar Evento';
            return;
        }

        try {
            if (managementData.type === 'fim_colheita') {
                const productionValue = managementProductionInput ? managementProductionInput.value.trim() : '';
                if (productionValue) managementData.production = productionValue;
            }

            if (managementData.type === 'foto_talhao') {
                const imageUrlsString = plotImageUrlInput ? plotImageUrlInput.value.trim() : '';
                const imageUrls = imageUrlsString.split('\n').filter(url => url);
                if (imageUrls.length === 0) throw new Error("Por favor, insira pelo menos um link de imagem.");
                managementData.imageUrls = imageUrls;
            } else {
                delete managementData.imageUrls;
            }

            if (!managementData.description) delete managementData.description;
            if (!managementData.cost) delete managementData.cost;

            managementData.registeredById = userId;
            managementData.registeredByName = allUsersCache[userId] || 'Agrônomo Desconhecido';
            managementData.status = 'Concluída';

            await addDoc(collection(db, `${culturePath}/managements`), managementData);

            if (managementForm) managementForm.reset();
            if (imageLinkContainer) imageLinkContainer.classList.add('hidden');
            if (productionFieldContainer) productionFieldContainer.classList.add('hidden');
            if (descriptionFieldContainer) descriptionFieldContainer.classList.remove('hidden');

            closeModal(managementModal);
            buildTimeline();
            showToast("Evento salvo com sucesso!", "success");

        } catch(error) {
            console.error("Erro ao salvar manejo:", error);
            showToast(`Erro ao salvar: ${error.message}`, 'error');
        } finally {
            if (addManagementBtn) {
                addManagementBtn.disabled = false;
                addManagementBtn.textContent = 'Salvar Evento';
            }
        }
    }

    function addEventListeners() {
        if (showAddAnalysisModalBtn) showAddAnalysisModalBtn.addEventListener('click', () => {
            currentEditingAnalysisId = null;
            if (analysisForm) analysisForm.reset();
            if (analysisModalTitle) analysisModalTitle.textContent = "Adicionar Nova Análise de Solo";
            openModal(analysisModal);
        });
        if (closeAnalysisModalBtn) closeAnalysisModalBtn.addEventListener('click', () => closeModal(analysisModal));
        if (saveAnalysisBtn) saveAnalysisBtn.addEventListener('click', saveAnalysis);

        if (showAddManagementModalBtn) showAddManagementModalBtn.addEventListener('click', () => {
            if (managementForm) managementForm.reset();
            if (productionFieldContainer) productionFieldContainer.classList.add('hidden');
            if (imageLinkContainer) imageLinkContainer.classList.add('hidden');
            if (descriptionFieldContainer) descriptionFieldContainer.classList.remove('hidden');
            openModal(managementModal);
        });

        if (closeManagementModalBtn) closeManagementModalBtn.addEventListener('click', () => closeModal(managementModal));
        if (addManagementBtn) addManagementBtn.addEventListener('click', handleAddManagement);

        if (managementTypeSelect) managementTypeSelect.addEventListener('change', (e) => {
            const selectedType = e.target.value;
            if (productionFieldContainer) productionFieldContainer.classList.toggle('hidden', selectedType !== 'fim_colheita');
            if (imageLinkContainer) imageLinkContainer.classList.toggle('hidden', selectedType !== 'foto_talhao');
            if (descriptionFieldContainer) descriptionFieldContainer.classList.toggle('hidden', selectedType === 'foto_talhao');
        });

        if (viewReportBtn) viewReportBtn.addEventListener('click', () => { window.location.href = `relatorio-talhao.html?clientId=${clientId}&propertyId=${propertyId}&plotId=${plotId}&cultureId=${cultureId}&from=${from}`; });

        if (closeViewAnalysisModalBtn) closeViewAnalysisModalBtn.addEventListener('click', () => closeModal(viewAnalysisModal));
        if (editAnalysisBtn) editAnalysisBtn.addEventListener('click', openEditAnalysisModal);

        if (timelineContainer) timelineContainer.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'seeMoreBtn') {
                visibleItemCount += 6;
                renderTimelineItems();
                return;
            }
            const photoTarget = e.target.closest('.timeline-photo');
            const detailsBtn = e.target.closest('.view-details-btn');
            const analysisCard = e.target.closest('.analysis-card');

            if (photoTarget) {
                openLightbox(photoTarget.dataset.src);
            } else if (detailsBtn) {
                const itemContainer = detailsBtn.closest('[data-event-type]');
                const eventType = itemContainer.dataset.eventType;
                const eventId = itemContainer.dataset.eventId;
                const taskId = itemContainer.dataset.taskId;

                if (taskId) {
                    window.location.href = `task-viewer.html?taskId=${taskId}&clientId=${clientId}&propertyId=${propertyId}&plotId=${plotId}&view=details`;
                } else if (eventType === 'analysis') {
                    openViewAnalysisModal(eventId);
                } else if (eventType === 'management') {
                    showToast("Nenhum detalhe específico disponível para este evento de manejo.", "info");
                }
            } else if (analysisCard && userRole !== 'cliente' && userRole !== 'operador') {
                openViewAnalysisModal(analysisCard.dataset.eventId);
            }
        });

        if (photoGallery) photoGallery.addEventListener('click', (e) => {
            const photoTarget = e.target.closest('.gallery-image');
            if (photoTarget) {
                openLightbox(photoTarget.dataset.src);
            }
        });

        const openLightbox = (src) => {
            if (lightboxImage) lightboxImage.src = src;
            openModal(imageLightboxModal);
        };
        const closeLightbox = () => {
            closeModal(imageLightboxModal);
            if (lightboxImage) lightboxImage.src = '';
        };

        if (closeLightboxBtn) closeLightboxBtn.addEventListener('click', closeLightbox);
        if (imageLightboxModal) imageLightboxModal.addEventListener('click', (e) => {
            if (e.target === imageLightboxModal) {
                closeLightbox();
            }
        });
    }

    // Função para configurar os event listeners da Bottom Navigation Bar
    function setupBottomNavbarListeners() {
        const navHomeBtn = document.getElementById('navHomeBtnPlotDetails');
        const navClientsBtn = document.getElementById('navClientsBtnPlotDetails');
        const navVisitBtn = document.getElementById('navVisitBtnPlotDetails');
        const navAgendaBtn = document.getElementById('navAgendaBtnPlotDetails');
        const navProfileBtn = document.getElementById('navProfileBtnPlotDetails');

        if (navHomeBtn) {
            navHomeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = `dashboard-${userRole}.html`;
            });
        }
        if (navClientsBtn) {
            navClientsBtn.addEventListener('click', (e) => {
                e.preventDefault();
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

    initializeCultureDashboard();
}
