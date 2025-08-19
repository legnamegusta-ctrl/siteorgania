// public/js/services/notifications.js

import { db } from '../config/firebase.js';
import {
    onSnapshot,
    collection,
    query,
    where,
    orderBy,
    doc,
    updateDoc,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { showToast } from './ui.js';

const TAG = '[NOTIF]';

function getEl(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(TAG, 'elemento ausente:', id);
    return el;
}

let notificationsBtn;
let notificationsDropdown;
let notificationsList;
let notificationsBadge;
let viewAllNotifications;

let notificationsListener = null;

export function setupNotifications(userId) {
    console.log(TAG, 'setting up notifications for user:', userId);

    notificationsBtn = getEl('notificationsBtn');
    notificationsDropdown = getEl('notificationsDropdown');
    notificationsList = getEl('notificationsList');
    notificationsBadge = getEl('notificationsBadge');
    viewAllNotifications = getEl('viewAllNotifications');

    if (!notificationsBtn || !notificationsDropdown || !notificationsList || !notificationsBadge) {
        return;
    }

    if (notificationsListener) {
        notificationsListener();
        console.log('Notifications: Unsubscribed from previous listener.');
    }

    const q = query(
        collection(db, 'notifications'),
        where('recipientId', '==', userId),
        where('isRead', '==', false),
        orderBy('createdAt', 'desc')
    );

    notificationsListener = onSnapshot(q, (snapshot) => {
        if (!notificationsList || !notificationsBadge) {
            if (!notificationsList) console.warn(TAG, 'elemento ausente:', 'notificationsList');
            if (!notificationsBadge) console.warn(TAG, 'elemento ausente:', 'notificationsBadge');
            if (notificationsListener) notificationsListener();
            return;
        }
        let unreadCount = 0;
        notificationsList.innerHTML = '';

        if (snapshot.empty) {
            notificationsList.innerHTML = '<p class="text-gray-500 px-4 py-2 text-sm">Nenhuma notificação nova.</p>';
        }

        snapshot.forEach((notificationDoc) => {
            unreadCount++;
            const notification = notificationDoc.data();
            const notificationId = notificationDoc.id;

            let message = notification.message || 'Nova notificação';
            let detailLink = '';

            if (notification.type === 'new_sale' && notification.saleId) {
                message = `Nova ordem de produção aprovada.`;
            } else if (notification.type === 'task_due' && notification.taskId) {
                message = `Tarefa "${notification.title || 'Desconhecida'}" está próxima do vencimento.`;
                detailLink = `agenda.html`;
            }

            const notificationItem = document.createElement('div');
            notificationItem.className = `px-4 py-2 border-b border-gray-200 hover:bg-gray-50 cursor-pointer ${notification.isRead ? 'text-gray-500' : 'font-semibold text-gray-800'}`;
            notificationItem.dataset.notificationId = notificationId;
            notificationItem.innerHTML = `
                <p class="text-sm">${message}</p>
                <p class="text-xs text-gray-500">${notification.createdAt ? new Date(notification.createdAt.toDate()).toLocaleString() : 'Data desconhecida'}</p>
            `;
            notificationItem.addEventListener('click', async () => {
                await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
                if (detailLink) {
                    window.location.href = detailLink;
                } else if (notificationsDropdown) {
                    notificationsDropdown.classList.add('hidden');
                }
            });
            notificationsList.appendChild(notificationItem);
        });

        if (unreadCount > 0) {
            if (notificationsBadge) {
                notificationsBadge.textContent = unreadCount;
                notificationsBadge.classList.remove('hidden');
            }
        } else {
            notificationsBadge && notificationsBadge.classList.add('hidden');
        }
        console.log(TAG, 'notificações renderizadas. não lidas:', unreadCount);
    }, (error) => {
        console.error(TAG, 'erro ao buscar notificações:', error);
        showToast('Erro ao carregar notificações: ' + error.message, 'error');
    });

    function setupNotificationButtonEvents() {
        if (notificationsBtn && !notificationsBtn._hasEventListener) {
            notificationsBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (notificationsDropdown) {
                    notificationsDropdown.classList.toggle('hidden');
                }
            });
            notificationsBtn._hasEventListener = true;
        }

        if (!document._hasClickOutsideListener) {
            document.addEventListener('click', (event) => {
                if (notificationsDropdown && !notificationsDropdown.contains(event.target) && notificationsBtn && !notificationsBtn.contains(event.target)) {
                    notificationsDropdown.classList.add('hidden');
                }
            });
            document._hasClickOutsideListener = true;
        }

        if (viewAllNotifications && !viewAllNotifications._hasEventListener) {
            viewAllNotifications.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!notificationsList || !notificationsBadge) {
                    if (!notificationsList) console.warn(TAG, 'elemento ausente:', 'notificationsList');
                    if (!notificationsBadge) console.warn(TAG, 'elemento ausente:', 'notificationsBadge');
                    return;
                }
                const visibleNotifications = notificationsList.querySelectorAll('div[data-notification-id]');
                const batch = writeBatch(db);
                visibleNotifications.forEach(item => {
                    const id = item.dataset.notificationId;
                    if (id) {
                        batch.update(doc(db, 'notifications', id), { isRead: true });
                    }
                });
                await batch.commit();

                notificationsBadge.classList.add('hidden');
                showToast('Todas as notificações marcadas como lidas.', 'info');
                if (notificationsDropdown) {
                    notificationsDropdown.classList.add('hidden');
                }
            });
            viewAllNotifications._hasEventListener = true;
        }
    }

    setupNotificationButtonEvents();
}
