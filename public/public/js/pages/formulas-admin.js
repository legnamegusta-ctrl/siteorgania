// js/pages/formulas-admin.js

import { db } from '../config/firebase.js';
// FUNÇÕES DE UI ATUALIZADAS
import { showToast, showSpinner, hideSpinner, openModal, closeModal } from '../services/ui.js';
// Adicionado imports necessários para Firestore V9
import { collection, query, where, orderBy, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js'; // Adicionei 'addDoc', 'updateDoc', e 'deleteDoc' que são usados

// CORREÇÃO: Adicionando 'export' à função
export function initFormulasAdmin(userId, userRole) {
    // Listas
    const fixedFormulasList = document.getElementById('fixedFormulasList');
    const customFormulasList = document.getElementById('customFormulasList');

    // Modal
    const formulaModal = document.getElementById('formulaModal');
    const formulaModalTitle = document.getElementById('formulaModalTitle');
    const formulaNameInput = document.getElementById('formulaNameInput');
    const saveFormulaBtn = document.getElementById('saveFormulaBtn');
    const showAddFormulaModalBtn = document.getElementById('showAddFormulaModalBtn');
    const closeFormulaModalBtn = document.getElementById('closeFormulaModalBtn');

    let currentEditingFormulaId = null;
    let allFormulas = [];

    // CORREÇÃO: Usando collection() para v9
    const formulasCollectionRef = collection(db, 'fertilizer_formulas');

    // Carrega e renderiza todas as fórmulas do Firestore
    async function loadFormulas() {
        if (fixedFormulasList) showSpinner(fixedFormulasList);
        if (customFormulasList) showSpinner(customFormulasList);
        
        try {
            // CORREÇÃO: Usando query() e getDocs() para v9
            const snapshot = await getDocs(query(formulasCollectionRef, orderBy('order')));
            
            allFormulas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const fixedFormulas = allFormulas.filter(f => f.isFixed);
            const customFormulas = allFormulas.filter(f => !f.isFixed);

            renderFormulas(fixedFormulas, fixedFormulasList);
            renderFormulas(customFormulas, customFormulasList);

        }catch (error) {
            console.error("Erro ao carregar fórmulas:", error);
            showToast("Não foi possível carregar as formulações.", 'error');
            if(fixedFormulasList) fixedFormulasList.innerHTML = '<p class="text-red-500">Erro ao carregar.</p>';
            if(customFormulasList) customFormulasList.innerHTML = '<p class="text-red-500">Erro ao carregar.</p>';
        }
    }

    // Renderiza as listas de fórmulas.
    function renderFormulas(formulas, container) {
        if (!container) return; // Verificação de segurança
        hideSpinner(container);
        
        container.innerHTML = '';
        if (formulas.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Nenhuma fórmula encontrada.</p>';
            return;
        }

        formulas.forEach(formula => {
            const deleteButton = !formula.isFixed 
                ? `<button class="delete-formula-btn text-red-500 hover:text-red-700" data-id="${formula.id}" title="Excluir"><i class="fas fa-trash-alt"></i></button>`
                : `<span class="w-6 h-6 inline-block" title="Esta fórmula é padrão e não pode ser excluída."></span>`;
            
            const element = `
                <div class="border border-gray-200 p-3 rounded-lg flex justify-between items-center">
                    <p class="text-gray-800">${formula.name}</p>
                    <div class="space-x-4 flex items-center">
                        <button class="edit-formula-btn text-blue-600 hover:text-blue-800" data-id="${formula.id}" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                        ${deleteButton}
                    </div>
                </div>
            `;
            container.innerHTML += element;
        });
    }

    // Abre o modal em modo de adição ou edição
    function openFormulaModal(formula = null) {
        if (formula) { // Modo Edição
            currentEditingFormulaId = formula.id;
            formulaModalTitle.textContent = 'Editar Fórmula';
            formulaNameInput.value = formula.name;
        } else { // Modo Adição
            currentEditingFormulaId = null;
            formulaModalTitle.textContent = 'Adicionar Nova Fórmula';
            formulaNameInput.value = '';
        }
        openModal(formulaModal); // LÓGICA DE MODAL ATUALIZADA
    }

    // Salva uma nova fórmula ou atualiza uma existente
    async function saveFormula() {
        const name = formulaNameInput.value.trim();
        if (!name) {
            showToast("O nome da formulação não pode estar vazio.", 'error');
            return;
        }

        saveFormulaBtn.disabled = true;

        try {
            if (currentEditingFormulaId) { // Atualizar
                // CORREÇÃO: Usando doc() e updateDoc() para v9
                await updateDoc(doc(formulasCollectionRef, currentEditingFormulaId), { name });
                showToast("Fórmula atualizada com sucesso!", 'success');
            } else { // Adicionar
                const lastOrder = allFormulas.length > 0 ? Math.max(...allFormulas.map(f => f.order || 0)) : 0;
                
                // CORREÇÃO: Usando addDoc() para v9
                await addDoc(formulasCollectionRef, {
                    name,
                    isFixed: false, // Novas fórmulas são sempre 'personalizadas'
                    order: lastOrder + 1
                });
                showToast("Fórmula adicionada com sucesso!", 'success');
            }
            closeModal(formulaModal); // LÓGICA DE MODAL ATUALIZADA
            loadFormulas();
        } catch (error) {
            console.error("Erro ao salvar fórmula:", error);
            showToast("Não foi possível salvar a fórmula.", 'error');
        } finally {
            saveFormulaBtn.disabled = false;
        }
    }

    // Exclui uma fórmula
    async function deleteFormula(formulaId) {
        if (confirm("Tem certeza que deseja excluir esta fórmula? Esta ação não pode ser desfeita.")) {
            try {
                // CORREÇÃO: Usando doc() e deleteDoc() para v9.
                await deleteDoc(doc(formulasCollectionRef, formulaId));
                showToast("Fórmula excluída com sucesso.", 'info');
                loadFormulas();
            } catch (error) {
                console.error("Erro ao excluir fórmula:", error);
                showToast("Não foi possível excluir a fórmula.", 'error');
            }
        }
    }
    
    // Função única para tratar cliques nos botões das listas
    function handleListClick(event) {
        const target = event.target;
        const editBtn = target.closest('.edit-formula-btn');
        const deleteBtn = target.closest('.delete-formula-btn');

        if (editBtn) {
            const formulaId = editBtn.dataset.id;
            const formula = allFormulas.find(f => f.id === formulaId);
            if(formula) openFormulaModal(formula);
            return;
        }

        if (deleteBtn) {
            deleteFormula(deleteBtn.dataset.id);
            return;
        }
    }

    // Listeners de Eventos
    // LÓGICA DE MODAL ATUALIZADA
    showAddFormulaModalBtn.addEventListener('click', () => openFormulaModal());
    closeFormulaModalBtn.addEventListener('click', () => closeModal(formulaModal));
    saveFormulaBtn.addEventListener('click', saveFormula);

    // Delegação de eventos para as listas
    if (fixedFormulasList) fixedFormulasList.addEventListener('click', handleListClick);
    if (customFormulasList) customFormulasList.addEventListener('click', handleListClick);

    // Carga inicial
    loadFormulas();
}