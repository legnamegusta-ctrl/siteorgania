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
 * Exibe um overlay de carregamento global.
 */
export function showLoader() {
    let loader = document.getElementById('global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.innerHTML = '<div class="loading-spinner"></div>';
        loader.style.position = 'fixed';
        loader.style.top = '0';
        loader.style.left = '0';
        loader.style.width = '100%';
        loader.style.height = '100%';
        loader.style.display = 'flex';
        loader.style.alignItems = 'center';
        loader.style.justifyContent = 'center';
        loader.style.background = 'rgba(255,255,255,0.8)';
        loader.style.zIndex = '9999';
        document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
}

/**
 * Remove o overlay de carregamento global.
 */
export function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

/**
 * Limpa um container e exibe um spinner de carregamento.
 * @param {HTMLElement} container - O elemento container.
 */
export function showSpinner(container) {
    if (!container) return;
    // Garante que o container possa posicionar o spinner sobre o conteúdo existente
    if (!container.style.position) {
        container.style.position = 'relative';
    }

    // Evita inserir múltiplos spinners no mesmo container
    if (container.querySelector('.spinner-container')) return;

    const spinnerWrapper = document.createElement('div');
    spinnerWrapper.className = 'spinner-container';
    spinnerWrapper.innerHTML = '<div class="loading-spinner"></div>';

    // Posiciona o spinner centralizado sobre o container
    spinnerWrapper.style.position = 'absolute';
    spinnerWrapper.style.top = '0';
    spinnerWrapper.style.left = '0';
    spinnerWrapper.style.width = '100%';
    spinnerWrapper.style.height = '100%';
    spinnerWrapper.style.minHeight = '100px';
    spinnerWrapper.style.display = 'flex';
    spinnerWrapper.style.justifyContent = 'center';
    spinnerWrapper.style.alignItems = 'center';
    spinnerWrapper.style.background = 'rgba(255,255,255,0.8)';

    container.appendChild(spinnerWrapper);
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