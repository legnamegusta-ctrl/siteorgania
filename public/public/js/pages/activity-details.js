// js/pages/activity-details.js

import { db } from '../config/firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { showSpinner, hideSpinner, showToast } from '../services/ui.js';

export async function initActivityDetails(userId, userRole) {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    const propertyId = params.get('propertyId');
    const plotId = params.get('plotId');
    const cultureId = params.get('cultureId');
    const dataSource = params.get('dataSource');
    const activityId = params.get('activityId');

    const titleEl = document.getElementById('activityDetailTitle');
    const contentEl = document.getElementById('activityDetailsContent');

    if (!contentEl) return;
    showSpinner(contentEl);

    try {
        let type = '';
        let status = '';
        let description = '';
        let date = '';
        let imageUrls = [];
        let responsible = 'Desconhecido';
        let local = 'N/A';

        if (dataSource === 'task') {
            const taskRef = doc(db, `clients/${clientId}/tasks/${activityId}`);
            const taskSnap = await getDoc(taskRef);
            if (!taskSnap.exists()) throw new Error('Tarefa não encontrada.');
            const task = taskSnap.data();

            type = `Tarefa: ${task.title || ''}`;
            status = task.isCompleted ? 'Concluída' : task.status || 'Pendente';
            description = task.description || 'Nenhuma descrição.';
            date = task.dueDate;
            imageUrls = task.imageUrls || [];
            if (task.responsibleAgronomistId) {
                responsible = await getUserName(task.responsibleAgronomistId);
            }
            if (plotId) {
                const plotSnap = await getDoc(doc(db, `clients/${clientId}/properties/${propertyId}/plots/${plotId}`));
                if (plotSnap.exists()) local = plotSnap.data().name || 'N/A';
            }
            titleEl.textContent = task.title || 'Detalhes da Tarefa';
        } else {
            const collectionName = dataSource === 'analysis' ? 'analyses' : 'managements';
            const activityRef = doc(db, `clients/${clientId}/properties/${propertyId}/plots/${plotId}/culturas/${cultureId}/${collectionName}/${activityId}`);
            const activitySnap = await getDoc(activityRef);
            if (!activitySnap.exists()) throw new Error('Atividade não encontrada.');
            const activity = activitySnap.data();

            type = dataSource === 'analysis' ? 'Análise de Solo' : (activity.type ? activity.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Manejo');
            status = activity.status || 'N/A';
            description = dataSource === 'analysis' ? (activity.agronomistInterpretation || 'Análise de solo realizada.') : (activity.description || 'Detalhes não informados.');
            date = activity.date;
            imageUrls = activity.imageUrls || [];
            if (activity.registeredById) {
                responsible = await getUserName(activity.registeredById);
            } else if (activity.registeredBy) {
                responsible = activity.registeredBy;
            }
            const plotSnap = await getDoc(doc(db, `clients/${clientId}/properties/${propertyId}/plots/${plotId}`));
            if (plotSnap.exists()) local = plotSnap.data().name || 'N/A';
            titleEl.textContent = `Detalhes do Evento`;
        }

        const formattedDate = date ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A';

        hideSpinner(contentEl);
        let photosHtml = '';
        if (imageUrls.length > 0) {
            photosHtml = '<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">' +
                imageUrls.map(url => `<img src="${url}" alt="Foto" class="w-full h-40 object-cover rounded">`).join('') +
                '</div>';
        } else {
            photosHtml = '<p class="text-gray-500">Nenhuma foto disponível.</p>';
        }

        contentEl.innerHTML = `
            <p><strong>Tipo:</strong> <span id="activityDetailType">${type}</span></p>
            <p><strong>Local:</strong> <span id="activityDetailLocation">${local}</span></p>
            <p><strong>Data:</strong> <span id="activityDetailDate">${formattedDate}</span></p>
            <p><strong>Responsável:</strong> <span id="activityDetailResponsible">${responsible}</span></p>
            <p><strong>Status:</strong> <span id="activityDetailStatus">${status}</span></p>
            <p><strong>Descrição:</strong> <span id="activityDetailDescription">${description}</span></p>
            <div id="activityDetailPhotos" class="mt-4">${photosHtml}</div>
        `;
    } catch (error) {
        console.error('Erro ao carregar detalhes da atividade:', error);
        titleEl.textContent = 'Erro ao carregar';
        contentEl.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        showToast('Erro ao carregar detalhes do serviço.', 'error');
    }
}

async function getUserName(userId) {
    try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
            return userSnap.data().name || 'Desconhecido';
        }
    } catch (e) {
        console.error('Erro ao buscar usuário:', e);
    }
    return 'Desconhecido';
}