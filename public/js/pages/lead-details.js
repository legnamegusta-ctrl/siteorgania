// js/pages/lead-details.js

import { db, auth } from '../config/firebase.js';
import { toggleModal } from './agro-bottom-nav.js';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { showToast, showSpinner, hideSpinner } from '../services/ui.js';

export function initLeadDetails(userId, userRole) {
  const params = new URLSearchParams(window.location.search);
  const leadId = params.get('id');
  if (!leadId) return;

  const backBtn = document.getElementById('backBtn');
  backBtn?.addEventListener('click', () => {
    window.location.href = 'dashboard-agronomo.html';
  });

  const leadNameHeader = document.getElementById('leadNameHeader');
  const leadName = document.getElementById('leadName');
  const leadPhone = document.getElementById('leadPhone');
  const leadStage = document.getElementById('leadStage');
  const visitsTimeline = document.getElementById('visitsTimeline');
  const btnAddVisit = document.getElementById('btnAddVisit');
  const leadAddVisitModal = document.getElementById('leadAddVisitModal');
  const btnLeadVisitClose = document.getElementById('btnLeadVisitClose');
  const leadAddVisitForm = document.getElementById('leadAddVisitForm');
  const leadVisitDate = document.getElementById('leadVisitDate');
  const leadVisitSummary = document.getElementById('leadVisitSummary');
  const leadVisitNotes = document.getElementById('leadVisitNotes');
  const leadVisitOutcome = document.getElementById('leadVisitOutcome');
  const leadVisitNextStep = document.getElementById('leadVisitNextStep');

  const leadRef = doc(db, 'leads', leadId);

  let leadLoaded = false;

  function handleLeadSnap(snap) {
    leadLoaded = true;
    if (!snap.exists()) {
      showToast('Lead não encontrado.', 'error');
      setTimeout(() => (window.location.href = 'dashboard-agronomo.html'), 1500);
      return;
    }
    const data = snap.data();
    const name =
      data.name || data.nomeContato || data.displayName || '(Sem nome)';
    if (leadNameHeader) leadNameHeader.textContent = name;
    if (leadName) leadName.textContent = name;
    if (leadPhone)
      leadPhone.textContent = data.phone || data.phoneNumber || '';
    if (leadStage && data.stage) {
      leadStage.textContent = data.stage;
      leadStage.classList.remove('hidden');
    }
    const canAdd =
      userRole === 'admin' ||
      userRole === 'agronomo' ||
      (userRole === 'operador' && data.assignedTo === userId);
    btnAddVisit?.classList.toggle('hidden', !canAdd);
  }

  onSnapshot(leadRef, handleLeadSnap);

  setTimeout(async () => {
    if (!leadLoaded) {
      try {
        const snap = await getDoc(leadRef);
        handleLeadSnap(snap);
      } catch (err) {
        console.error('Erro ao buscar lead:', err);
      }
    }
  }, 2000);

  function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  function formatRole(role) {
    const roles = {
      admin: 'Admin',
      agronomo: 'Agrônomo',
      operador: 'Operador',
      cliente: 'Cliente'
    };
    return roles[role] || role || '';
  }

  if (visitsTimeline) showSpinner(visitsTimeline);

  const visitsRef = collection(db, `leads/${leadId}/visits`);
  const visitsQuery = query(visitsRef, orderBy('date', 'desc'));
  onSnapshot(visitsQuery, (snap) => {
    if (!visitsTimeline) return;
    hideSpinner(visitsTimeline);
    if (snap.empty) {
      visitsTimeline.innerHTML = '<p class="text-gray-500">Nenhuma visita registrada.</p>';
      return;
    }
    visitsTimeline.innerHTML = '';
    snap.forEach((docSnap) => {
      const v = docSnap.data();
      const card = document.createElement('div');
      card.className = 'mb-4 pl-4 border-l-2 border-green-600';
      card.innerHTML = `
        <div class="text-sm text-gray-500">${formatDate(v.date || v.createdAt)} por ${formatRole(v.authorRole)}</div>
        <div class="font-semibold">${v.summary || ''}</div>
        ${v.notes ? `<div class="mt-1 text-sm">${v.notes}</div>` : ''}
        ${v.outcome ? `<div class="mt-1 text-sm text-gray-600">Resultado: ${v.outcome}</div>` : ''}
        ${v.nextStep ? `<div class="mt-1 text-sm text-gray-600">Próximo passo: ${v.nextStep}</div>` : ''}
      `;
      visitsTimeline.appendChild(card);
    });
  });

  btnAddVisit?.addEventListener('click', () => {
    if (leadVisitDate)
      leadVisitDate.value = new Date().toISOString().slice(0, 16);
    toggleModal(leadAddVisitModal, true);
  });

  btnLeadVisitClose?.addEventListener('click', () =>
    toggleModal(leadAddVisitModal, false)
  );

  leadAddVisitForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const summary = leadVisitSummary?.value.trim();
    if (!summary) {
      showToast('Informe o resumo da visita.', 'error');
      return;
    }
    try {
      const value = leadVisitDate?.value;
      await addDoc(visitsRef, {
        date: value ? Timestamp.fromDate(new Date(value)) : Timestamp.now(),
        authorId: auth.currentUser.uid,
        authorRole: userRole,
        summary,
        notes: leadVisitNotes?.value.trim() || '',
        outcome: leadVisitOutcome?.value || 'realizada',
        nextStep: leadVisitNextStep?.value.trim() || null,
        attachments: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        relatedType: 'lead',
        relatedId: leadId,
      });
      toggleModal(leadAddVisitModal, false);
      leadAddVisitForm?.reset();
      showToast('Visita registrada com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao adicionar visita:', err);
      showToast('Erro ao adicionar visita.', 'error');
    }
  });
}
