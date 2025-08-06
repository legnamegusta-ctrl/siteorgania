// js/services/ui.js

/**
 * Exibe uma mensagem de erro dentro de um formulário.
 * @param {HTMLElement} formElement - O elemento do formulário.
 * @param {string} message - A mensagem de erro a ser exibida.
 */
export function showFormError(formElement, message) {
    // ... (código da função sem alterações)
}

/**
 * Limpa um container e exibe um spinner de carregamento.
 * @param {HTMLElement} container - O elemento container.
 */
export function showSpinner(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="spinner-container">
            <div class="loading-spinner"></div>
        </div>
    `;
}

/**
 * Remove o spinner de um container.
 * @param {HTMLElement} container - O elemento container.
 */
export function hideSpinner(container) {
    if (!container) return;
    const spinnerContainer = container.querySelector('.spinner-container');
    if (spinnerContainer) {
        spinnerContainer.remove();
    }
}

/**
 * Exibe uma notificação toast no canto da tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} [type='info'] - O tipo de toast ('info', 'success', 'error').
 * @param {number} [duration=4000] - A duração em milissegundos.
 */
export function showToast(message, type = 'info', duration = 4000) {
    // Verifica se o container principal de toasts existe, senão o cria
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // Cria o elemento do toast
    const toastElement = document.createElement('div');
    toastElement.className = `toast toast-${type}`;

    // Define o ícone com base no tipo
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle'
    };
    const iconClass = icons[type] || 'fa-info-circle';

    toastElement.innerHTML = `
        <i class="fas ${iconClass} toast-icon"></i>
        <p class="toast-message">${message}</p>
    `;

    // Adiciona o toast ao container
    toastContainer.appendChild(toastElement);

    // Define timers para remover o toast
    setTimeout(() => {
        toastElement.classList.add('fade-out');
    }, duration - 500); // Começa a animação de saída 500ms antes do fim

    setTimeout(() => {
        toastElement.remove();
    }, duration);
}

// ===================================================================
// ||                 NOVAS FUNÇÕES DE CONTROLE DE MODAL            ||
// ===================================================================

/**
 * Torna um elemento modal visível.
 * @param {HTMLElement} modalElement - O elemento do modal a ser aberto.
 */
export function openModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('hidden');
    }
}

/**
 * Oculta um elemento modal.
 * @param {HTMLElement} modalElement - O elemento do modal a ser fechado.
 */
export function closeModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add('hidden');
    }
}