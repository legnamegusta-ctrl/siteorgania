// js/pages/plot-report.js

import { db } from '../config/firebase.js';
import { showSpinner, hideSpinner, showToast, openModal, closeModal } from '../services/ui.js';
// CORREÇÃO: Adicionado 'getDoc' e 'collectionGroup' ao import do firebase/firestore
import { collection, query, where, orderBy, getDocs, doc, getDoc, collectionGroup } from '/vendor/firebase/9.6.0/firebase-firestore.js'; //

export function initPlotReport(userId, userRole) {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    const propertyId = params.get('propertyId');
    const plotId = params.get('plotId');
    const cultureId = params.get('cultureId');
    const from = params.get('from') || 'agronomo';

    const reportPlotNameHeader = document.getElementById('reportPlotNameHeader');
    const reportInfo = document.getElementById('reportInfo');
    const metricSelectorContainer = document.getElementById('metric-selector-container');
    const chartDisplayArea = document.getElementById('chart-display-area');
    const backToPlotDetailsBtn = document.getElementById('backToPlotDetailsBtn');

    // NOVO: Elementos da Bottom Navigation Bar (desta página) - Declarados uma única vez aqui
    const navHomeBtn = document.getElementById('navHomeBtnPlotReport');
    const navClientsBtn = document.getElementById('navClientsBtnPlotReport');
    const navVisitBtn = document.getElementById('navVisitBtnPlotReport');
    const navMapBtn = document.getElementById('navMapBtnPlotReport'); 
    const navProfileBtn = document.getElementById('navProfileBtnPlotReport');

    let allPlotData = [];
    let activeCharts = {};
    let currentPlotInfo = null; // Armazena info do plot e da cultura

    const referenceLevels = {
        production: { label: 'Produção', unit: 'sc/ha' },
        ph_cacl2: { label: 'pH (CaCl₂ 0,01M)', min: 5.2, max: 5.6, unit: 'pH' },
        ph_h2o: { label: 'pH (H₂O)', min: 5.9, max: 6.3, unit: 'pH' },
        h_al: { label: 'Tampão SMP (H+Al)', min: 3.9, max: 4.4, unit: 'cmolc/dm³' },
        al_trocavel: { label: 'Al-(Acidez Trocável)', max: 0.1, unit: 'cmolc/dm³' },
        carbono_organico: { label: 'Carbono Orgânico', min: 1.7, max: 2.0, unit: 'g/dm³' },
        materia_organica: { label: 'Matéria Orgânica (%)', min: 3.0, max: 4.0, unit: '%' },
        fosforo_rem: { label: 'Fósforo Remanescente', unit: 'mg/L' },
        fosforo_ncp: { label: 'Fósforo Nível Crítico (NCP)', unit: 'mg/dm³' },
        fosforo_pri: { label: 'Fósforo Relativo PRI(%)', unit: '%' },
        calcio: { label: 'Cálcio (Ca)', min: 2.5, max: 4.0, unit: 'cmolc/dm³' },
        magnesio: { label: 'Magnésio (Mg)', min: 0.8, max: 1.5, unit: 'cmolc/dm³' },
        potassio_cmolc: { label: 'Potássio Mehlich (K)', min: 0.25, max: 0.40, unit: 'cmolc/dm³' },
        soma_bases: { label: 'S.B (Soma das Bases)', min: 4.0, max: 5.5, unit: 'cmolc/dm³' },
        fosforo_mehlich: { label: 'Fósforo Mehlich (P)', min: 100, max: 160, unit: 'mg/dm³' },
        enxofre: { label: 'Enxofre (S)', min: 15.0, max: 20.0, unit: 'mg/dm³' },
        boro: { label: 'Boro (B)', min: 0.60, max: 0.80, unit: 'mg/dm³' },
        cobre: { label: 'Cobre (Cu)', min: 0.5, max: 1.0, unit: 'mg/dm³' },
        ferro: { label: 'Ferro (Fe)', min: 10, max: 30, unit: 'mg/dm³' },
        zinco: { label: 'Zinco (Zn)', min: 1.5, max: 3.0, unit: 'mg/dm³' },
        manganes: { label: 'Manganês (Mn)', min: 5.0, max: 20.0, unit: 'cmolc/dm³' },
        ctc_efetiva: { label: 'CTC Efetiva', min: 8.0, max: 10.0, unit: 'cmolc/dm³' },
        ctc_ph7: { label: 'CTC (pH 7.0)', min: 8.0, max: 10.0, unit: 'cmolc/dm³' },
        v_percent: { label: 'V% (Saturação por Bases)', min: 50, max: 70, unit: '%' },
        m_percent: { label: 'm% (Saturação de Al)', max: 15.0, unit: '%' },
        perc_al_ctc: { label: '% Alumínio na C.T.C', max: 15.0, unit: '%' },
        perc_h_ctc: { label: '% Hidrogênio na C.T.C', min: 15.0, max: 30.0, unit: '%' },
        perc_ca_ctc: { label: '% Cálcio na C.T.C', min: 35.0, max: 50.0, unit: '%' },
        perc_mg_ctc: { label: '% Magnésio na C.T.C', min: 13.0, max: 20.0, unit: '%' },
        perc_k_ctc: { label: '% Potássio na C.T.C', min: 3.5, max: 5.0, unit: '%' },
        rel_ca_mg: { label: 'Relação Ca/Mg', min: 3, max: 5, unit: 'Índice' },
        rel_ca_k: { label: 'Relação Ca/K', min: 7, max: 10, unit: 'Índice' },
        rel_mg_k: { label: 'Relação Mg/K', min: 3, max: 4, unit: 'Índice' }
    };

    async function initializeReport() {
        if (!clientId || !propertyId || !plotId || !cultureId) {
            reportPlotNameHeader.textContent = "Erro: Informações de talhão/cultura faltando na URL.";
            return;
        }

        try {
            // CORREÇÃO: Usando collection() e doc() para v9
            const plotPromise = getDoc(doc(collection(db, `clients/${clientId}/properties/${propertyId}/plots`), plotId));
            const propertyPromise = getDoc(doc(collection(db, `clients/${clientId}/properties`), propertyId));
            const culturePromise = getDoc(doc(collection(db, `clients/${clientId}/properties/${propertyId}/plots/${plotId}/culturas`), cultureId));
            
            const [plotDoc, propertyDoc, cultureDoc] = await Promise.all([plotPromise, propertyPromise, culturePromise]);

            if (plotDoc.exists && propertyDoc.exists && cultureDoc.exists) {
                currentPlotInfo = {
                    plotName: plotDoc.data().name,
                    propertyName: propertyDoc.data().name,
                    cultureName: cultureDoc.data().cropName,
                    cultureStartDate: cultureDoc.data().startDate ? (cultureDoc.data().startDate.toDate ? cultureDoc.data().startDate.toDate().toLocaleDateString('pt-BR') : new Date(cultureDoc.data().startDate).toLocaleDateString('pt-BR')) : 'N/A'
                };
                reportPlotNameHeader.textContent = `Relatório de Evolução: ${currentPlotInfo.plotName}`;
                reportInfo.textContent = `Propriedade: ${currentPlotInfo.propertyName} | Cultura: ${currentPlotInfo.cultureName} (Início: ${currentPlotInfo.cultureStartDate})`;
            } else {
                 reportPlotNameHeader.textContent = `Relatório de Evolução`;
                 reportInfo.textContent = `Dados não encontrados`;
            }

            // Configura o botão de voltar para a página de detalhes do talhão
            backToPlotDetailsBtn.href = `plot-details.html?clientId=${clientId}&propertyId=${propertyId}&plotId=${plotId}&cultureId=${cultureId}&from=${from}`;

            allPlotData = await fetchAllPlotData();
            
            // Agora, a página só exibirá a mensagem de erro se não houver NENHUM dado de análise OU produção.
            const hasAnalyses = allPlotData.some(d => d.hasOwnProperty('ph_h2o'));
            const hasProduction = allPlotData.some(d => d.hasOwnProperty('production'));

            if (!hasAnalyses && !hasProduction) {
                chartDisplayArea.innerHTML = '<div id="loadingReportMessage" class="flex items-center justify-center h-full text-center text-gray-500"><p>Nenhuma análise ou registro de produção encontrado para gerar um gráfico.</p></div>';
                metricSelectorContainer.innerHTML = '<p class="text-sm text-gray-400">Sem dados para comparar.</p>';
                return;
            }
            
            populateMetricSelector();
            addSelectorListener();
            setupBottomNavbarListeners(); // NOVO: Chama a função para configurar os listeners da navbar

        } catch(error) {
            console.error("Erro ao inicializar o relatório:", error);
            chartDisplayArea.innerHTML = '<div class="flex items-center justify-center h-full text-center text-red-500"><p>Ocorreu um erro ao gerar o relatório.</p></div>';
            if (error.code === 'permission-denied') {
                showToast("Erro de permissão ao carregar dados para o relatório. Verifique as regras de segurança para análises e manejos.", 'error', 10000);
            }
        }
    }

    // Busca todos os dados relevantes (análises e manejos de fim de colheita) para o relatório
    async function fetchAllPlotData() {
        let items = [];
        const culturePath = `clients/${clientId}/properties/${propertyId}/plots/${plotId}/culturas/${cultureId}`;
        
        // CORREÇÃO: Usando collection() para v9
        const analysesSnapshot = await getDocs(collection(db, `${culturePath}/analyses`));
        analysesSnapshot.forEach(docSnap => { items.push({ ...docSnap.data(), eventGroup: 'analysis', id: docSnap.id }); }); // Renomear 'doc' para 'docSnap'
        
        // CORREÇÃO: Usando collection() e query() para v9
        const managementsQuery = query(collection(db, `${culturePath}/managements`), where('type', '==', 'fim_colheita'));
        const managementsSnapshot = await getDocs(managementsQuery);
        managementsSnapshot.forEach(docSnap => { items.push({ ...docSnap.data(), eventGroup: 'management', id: docSnap.id }); }); // Renomear 'doc' para 'docSnap'
        
        // Adiciona um campo de data consistente para ordenação e gráficos
        items.forEach(item => {
            if (item.eventGroup === 'analysis' && item.date) {
                item.reportDate = new Date(item.date + 'T12:00:00'); // Garante fuso horário para consistência
            } else if (item.eventGroup === 'management' && item.date) {
                item.reportDate = new Date(item.date + 'T12:00:00');
            }
        });

        // Filtra itens sem data válida e ordena
        const sortedItems = items.filter(item => item.reportDate instanceof Date && !isNaN(item.reportDate)).sort((a, b) => a.reportDate - b.reportDate);
        return sortedItems;
    }

    // Popula o seletor de métricas na barra lateral
    function populateMetricSelector() {
        metricSelectorContainer.innerHTML = '';
        const sections = {
            'Resultados de Colheita': ['production'],
            'Reação do Solo': ['ph_h2o', 'ph_cacl2', 'al_trocavel', 'h_al', 'ctc_ph7', 'v_percent', 'm_percent', 'materia_organica'],
            'Macro e Micro': ['calcio', 'magnesio', 'potassio_cmolc', 'soma_bases', 'fosforo_mehlich', 'enxofre', 'boro', 'cobre', 'ferro', 'zinco', 'manganes'],
            'Relações e Saturação (%)': ['perc_ca_ctc', 'perc_mg_ctc', 'perc_k_ctc', 'rel_ca_mg', 'rel_ca_k', 'rel_mg_k']
        };

        for (const [title, keys] of Object.entries(sections)) {
            // Filtra as chaves para incluir apenas as que têm dados presentes em allPlotData
            const availableKeys = keys.filter(key => referenceLevels[key] && allPlotData.some(d => d.hasOwnProperty(key) && d[key] !== undefined && d[key] !== null));
            
            if(availableKeys.length > 0) {
                metricSelectorContainer.innerHTML += `<h4 class="metric-group-title">${title}</h4>`;
                availableKeys.forEach(key => {
                    const id = `check-${key}`;
                    metricSelectorContainer.innerHTML += `<label for="${id}" class="metric-item-label"><input type="checkbox" id="${id}" data-metric-key="${key}" class="metric-checkbox"><span>${referenceLevels[key].label}</span></label>`;
                });
            }
        }
        toggleInitialMessage(); // Atualiza a mensagem inicial após popular o seletor
    }

    // Adiciona listener para as mudanças nos checkboxes de métricas
    function addSelectorListener() {
        metricSelectorContainer.addEventListener('change', (e) => {
            const checkbox = e.target.closest('.metric-checkbox');
            if (checkbox) {
                const metricKey = checkbox.dataset.metricKey;
                toggleInitialMessage(true); // Oculta a mensagem inicial ao selecionar
                if (checkbox.checked) {
                    addChart(metricKey);
                } else {
                    removeChart(metricKey);
                }
                toggleInitialMessage(); // Exibe novamente se nenhum gráfico estiver ativo
            }
        });
    }

    // Gerencia a visibilidade da mensagem inicial (quando nenhum gráfico está selecionado)
    function toggleInitialMessage(forceHide = false) {
        const message = document.getElementById('loadingReportMessage');
        if (!message) return;

        // Se forceHide for true, ou se há gráficos ativos, esconde a mensagem. Senão, mostra.
        if (forceHide || Object.keys(activeCharts).length > 0) {
            message.style.display = 'none';
        } else {
            message.style.display = 'flex';
            chartDisplayArea.style.justifyContent = 'center';
            chartDisplayArea.style.alignItems = 'center';
        }
    }
    
    // Adiciona um novo gráfico para a métrica selecionada
    function addChart(metricKey) {
        if(document.getElementById(`chart-card-${metricKey}`)) return;

        const chartCard = document.createElement('div');
        chartCard.id = `chart-card-${metricKey}`;
        chartCard.className = 'p-4 border rounded-lg mb-4 bg-white';
        chartCard.innerHTML = `<canvas id="chart-${metricKey}"></canvas>`;
        chartDisplayArea.appendChild(chartCard);

        const ctx = document.getElementById(`chart-${metricKey}`).getContext('2d');
        const levels = referenceLevels[metricKey] || {};
        
        const data = allPlotData
            .filter(d => d.hasOwnProperty(metricKey) && d[metricKey] !== undefined && d[metricKey] !== null)
            .map(d => ({ x: d.reportDate, y: parseFloat(d[metricKey]) }));
            
        if (data.length < 1) { // Garante que há dados para plotar
            showToast(`Não há dados válidos para "${levels.label}" para gerar o gráfico.`, 'info');
            return;
        }

        const getPointColor = (value, lvls) => {
            if (!lvls || value === undefined || value === null) return 'rgba(107, 114, 128, 0.7)'; // Cinza padrão
            if (lvls.min !== undefined && value < lvls.min) return '#ef4444'; // Vermelho (abaixo)
            if (lvls.max !== undefined && value > lvls.max) return '#ef4444'; // Vermelho (acima)
            return '#22c55e'; // Verde (dentro da faixa)
        };
        const pointColors = data.map(p => getPointColor(p.y, levels));

        const annotations = {};
        const dataValues = data.map(d => d.y).filter(v => v !== null && v !== undefined);
        const dataMin = dataValues.length > 0 ? Math.min(...dataValues) : 0;
        const dataMax = dataValues.length > 0 ? Math.max(...dataValues) : 100; // Valor padrão se não houver dados

        // Adiciona caixas de anotação para faixas de referência (ótimo, baixo, alto)
        if (levels.min !== undefined && levels.max !== undefined) {
             // Faixa Ideal (verde)
            annotations.ideal = { type: 'box', yMin: levels.min, yMax: levels.max, backgroundColor: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.05)' };
             // Faixa Baixa (vermelho claro)
            annotations.tooLow = { type: 'box', yMin: (dataMin < levels.min ? dataMin : 0), yMax: levels.min, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.05)' };
            // Faixa Alta (vermelho claro) - garante que vai até o máximo do gráfico ou do dado
            annotations.tooHigh = { type: 'box', yMin: levels.max, yMax: Math.max(dataMax, levels.max * 1.1), backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.05)' };
        } else if (levels.min !== undefined) {
             annotations.tooLow = { type: 'box', yMin: (dataMin < levels.min ? dataMin : 0), yMax: levels.min, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.05)' };
             annotations.ideal = { type: 'box', yMin: levels.min, yMax: Math.max(dataMax, levels.min * 1.1), backgroundColor: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.05)' };
        } else if (levels.max !== undefined) {
            const yMaxChart = Math.max(dataMax, levels.max) * 1.1;
            annotations.ideal = { type: 'box', yMin: (dataMin < levels.max ? dataMin : 0), yMax: levels.max, backgroundColor: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.05)' };
            annotations.tooHigh = { type: 'box', yMin: levels.max, yMax: yMaxChart, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.05)' };
        }


        const newChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: levels.label,
                    data: data,
                    borderColor: 'rgba(58, 125, 68, 1)',
                    pointBackgroundColor: pointColors,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.1,
                    fill: false // Para gráficos de linha, não preencher abaixo da linha por padrão
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, 
                scales: {
                    x: { 
                        type: 'time', 
                        time: { unit: 'month', tooltipFormat: 'dd/MM/yyyy' }, 
                        title: { display: true, text: 'Data' } 
                    },
                    y: { 
                        title: { display: true, text: levels.unit || 'Valor' },
                        beginAtZero: false 
                    }
                },
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: `Evolução de ${levels.label}`, font: { size: 16 } },
                    annotation: { annotations }
                }
            }
        });
        activeCharts[metricKey] = newChart;
    }

    function removeChart(metricKey) {
        if (activeCharts[metricKey]) {
            activeCharts[metricKey].destroy();
            delete activeCharts[metricKey];
        }
        const chartCard = document.getElementById(`chart-card-${metricKey}`);
        if (chartCard) {
            chartCard.remove();
        }
    }

    backToPlotDetailsBtn.addEventListener('click', () => window.history.back());
    
    // NOVO: Função para configurar os event listeners da Bottom Navigation Bar
    function setupBottomNavbarListeners() {
        const navHomeBtn = document.getElementById('navHomeBtnPlotReport');
        const navClientsBtn = document.getElementById('navClientsBtnPlotReport');
        const navVisitBtn = document.getElementById('navVisitBtnPlotReport');
        const navProfileBtn = document.getElementById('navProfileBtnPlotReport');

        if (navHomeBtn) {
            navHomeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = `dashboard-agronomo.html`;
            });
        }
        if (navClientsBtn) {
            navClientsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = `client-list.html`;
            });
        }
        if (navVisitBtn) {
            navVisitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showToast("Funcionalidade de iniciar visita a partir desta página será implementada em breve.", "info");
            });
        }
        // Este botão de mapa não existe no HTML de plot-details.html. 
        // Se a funcionalidade de mapa for necessária aqui, ele deve ser adicionado ao HTML.
        // Por enquanto, será removido deste JS para evitar erros de referência se não estiver no HTML.
        /*
        if (navMapBtn) { 
            navMapBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = `mapa-agronomo.html`;
            });
        }
        */
        if (navProfileBtn) {
            navProfileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showToast("A seção de Perfil será implementada em breve.", "info");
            });
        }
    }

    initializeReport();
}
