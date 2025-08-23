// js/pages/lead-details.js

import { db, auth } from '../config/firebase.js';
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
  const addVisitForm = document.getElementById('addVisitForm');
  const visitDate = document.getElementById('visitDate');
  const visitSummary = document.getElementById('visitSummary');
  const visitNotes = document.getElementById('visitNotes');
  const visitOutcome = document.getElementById('visitOutcome');
  const visitNextStep = document.getElementById('visitNextStep');

  if (visitDate) {
    const now = new Date();
    visitDate.value = now.toISOString().slice(0, 16);
  }

  const leadRef = doc(db, 'leads', leadId);
  onSnapshot(leadRef, (snap) => {
    const data = snap.data();
    if (!data) return;
    const name = data.name || data.nomeContato || 'Lead';
    if (leadNameHeader) leadNameHeader.textContent = name;
    if (leadName) leadName.textContent = name;
    if (leadPhone) leadPhone.textContent = data.phone || data.phoneNumber || '';
    if (leadStage && data.stage) {
      leadStage.textContent = data.stage;
      leadStage.classList.remove('hidden');
    }

    const canAdd =
      userRole === 'admin' ||
      userRole === 'agronomo' ||
      (userRole === 'operador' && data.assignedTo === userId);
    addVisitForm?.classList.toggle('hidden', !canAdd);
  });

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

  addVisitForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const summary = visitSummary?.value.trim();
    if (!summary) {
      showToast('Informe o resumo da visita.', 'error');
      return;
    }
    try {
      await addDoc(visitsRef, {
        date: visitDate?.value ? Timestamp.fromDate(new Date(visitDate.value)) : Timestamp.now(),
        authorId: auth.currentUser.uid,
        authorRole: userRole,
        summary,
        notes: visitNotes?.value.trim() || '',
        outcome: visitOutcome?.value || 'realizada',
        nextStep: visitNextStep?.value.trim() || null,
        attachments: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        relatedType: 'lead',
        relatedId: leadId
      });
      addVisitForm.reset();
      if (visitDate) visitDate.value = new Date().toISOString().slice(0, 16);
      showToast('Visita registrada com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao adicionar visita:', err);
      showToast('Erro ao adicionar visita.', 'error');
    }
  });
}
