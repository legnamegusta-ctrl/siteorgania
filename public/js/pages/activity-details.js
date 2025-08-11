// js/pages/activity-details.js

import { db } from '../config/firebase.js';
import { doc, getDoc, updateDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
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
        let observations = [];
        let comments = [];
        let responsible = 'Desconhecido';
        let local = 'N/A';
        let taskRef;

        if (dataSource === 'task') {
            taskRef = doc(db, `clients/${clientId}/tasks/${activityId}`);
            const taskSnap = await getDoc(taskRef);
            if (!taskSnap.exists()) throw new Error('Tarefa não encontrada.');
            const task = taskSnap.data();

            type = `Tarefa: ${task.title || ''}`;
            status = task.isCompleted ? 'Concluída' : task.status || 'Pendente';
            description = task.description || 'Nenhuma descrição.';
            date = task.dueDate;
            imageUrls = task.imageUrls || [];
            observations = task.observations || [];
            comments = task.comments || [];
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
            observations = activity.observations || [];
            comments = activity.comments || [];
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
        contentEl.innerHTML = `
            <p><strong>Tipo:</strong> <span id="activityDetailType">${type}</span></p>
            <p><strong>Local:</strong> <span id="activityDetailLocation">${local}</span></p>
            <p><strong>Data:</strong> <span id="activityDetailDate">${formattedDate}</span></p>
            <p><strong>Responsável:</strong> <span id="activityDetailResponsible">${responsible}</span></p>
            <p><strong>Status:</strong> <span id="activityDetailStatus">${status}</span></p>
            <p><strong>Descrição:</strong> <span id="activityDetailDescription">${description}</span></p>
        `;

        renderPhotos(imageUrls);
        if (dataSource === 'task') {
            document.getElementById('taskExtras').classList.remove('hidden');
            renderObservations(observations);
            renderComments(comments);

            const observationForm = document.getElementById('addObservationForm');
            const observationInput = document.getElementById('observationInput');
            observationForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const value = observationInput.value.trim();
                if (!value) return;
                try {
                    await updateDoc(taskRef, { observations: arrayUnion(value) });
                    observations.push(value);
                    renderObservations(observations);
                    observationInput.value = '';
                    showToast('Observação adicionada.', 'success');
                } catch (err) {
                    console.error('Erro ao adicionar observação:', err);
                    showToast('Erro ao salvar observação.', 'error');
                }
            });

            const commentForm = document.getElementById('addCommentForm');
            const commentInput = document.getElementById('commentInput');
            commentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const text = commentInput.value.trim();
                if (!text) return;
                const comment = { text, authorId: userId, authorName: await getUserName(userId), createdAt: new Date().toISOString() };
                try {
                    await updateDoc(taskRef, { comments: arrayUnion(comment) });
                    comments.push(comment);
                    renderComments(comments);
                    commentInput.value = '';
                    showToast('Comentário adicionado.', 'success');
                } catch (err) {
                    console.error('Erro ao adicionar comentário:', err);
                    showToast('Erro ao salvar comentário.', 'error');
                }
            });

            const photoForm = document.getElementById('addPhotoForm');
            const photoInput = document.getElementById('photoInput');
            photoForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const file = photoInput.files[0];
                if (!file) return;
                try {
                    showSpinner(document.getElementById('photosSection'));
                    const base64 = await fileToBase64(file);
                    const res = await fetch('/uploadTaskPhoto', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageBase64: base64, clientId, taskId: activityId })
                    });
                    const data = await res.json();
                    if (data.imageUrl) {
                        await updateDoc(taskRef, { imageUrls: arrayUnion(data.imageUrl) });
                        imageUrls.push(data.imageUrl);
                        renderPhotos(imageUrls);
                        showToast('Foto enviada com sucesso.', 'success');
                        photoInput.value = '';
                    } else {
                        showToast('Falha no envio da foto.', 'error');
                    }
                } catch (err) {
                    console.error('Erro ao enviar foto:', err);
                    showToast('Erro ao enviar foto.', 'error');
                } finally {
                    hideSpinner(document.getElementById('photosSection'));
                }
            });
        } else {
            document.getElementById('taskExtras').classList.remove('hidden');
            document.getElementById('addObservationForm').classList.add('hidden');
            document.getElementById('addPhotoForm').classList.add('hidden');
            document.getElementById('addCommentForm').classList.add('hidden');
            renderObservations(observations);
            renderComments(comments);
        }
    } catch (error) {
        console.error('Erro ao carregar detalhes da atividade:', error);
        titleEl.textContent = 'Erro ao carregar';
        contentEl.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        showToast('Erro ao carregar detalhes do serviço.', 'error');
    }
}

function renderPhotos(urls) {
    const grid = document.getElementById('photosGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!urls || urls.length === 0) {
        grid.innerHTML = '<p class="text-gray-500 col-span-full">Nenhuma foto disponível.</p>';
        return;
    }
    urls.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Foto';
        img.className = 'w-full h-40 object-cover rounded';
        grid.appendChild(img);
    });
}

function renderObservations(list) {
    const ul = document.getElementById('observationsList');
    if (!ul) return;
    ul.innerHTML = '';
    if (!list || list.length === 0) {
        ul.innerHTML = '<li class="text-gray-500">Nenhuma observação.</li>';
        return;
    }
    list.forEach(obs => {
        const li = document.createElement('li');
        li.textContent = obs;
        ul.appendChild(li);
    });
}

function renderComments(list) {
    const container = document.getElementById('commentsList');
    if (!container) return;
    container.innerHTML = '';
    if (!list || list.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Nenhum comentário.</p>';
        return;
    }
    list.forEach(c => {
        const item = document.createElement('div');
        item.className = 'border border-gray-200 rounded p-2';
        const date = c.createdAt ? new Date(c.createdAt).toLocaleString('pt-BR') : '';
        item.innerHTML = `<p class="text-sm text-gray-700"><strong>${c.authorName || 'Anônimo'}</strong> <span class="text-gray-500 text-xs">${date}</span></p><p class="mt-1 text-gray-800">${c.text}</p>`;
        container.appendChild(item);
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
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