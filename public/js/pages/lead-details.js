// js/pages/lead-details.js

import { db, auth } from '../config/firebase.js';
import { toggleModal } from './agro-bottom-nav.js';
import { getLeads } from '../stores/leadsStore.js';
import { getVisits } from '../stores/visitsStore.js';
import {
  doc,
  getDoc,
  updateDoc,
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
  const leadEmail = document.getElementById('leadEmail');
  const leadProperty = document.getElementById('leadProperty');
  const leadOrigin = document.getElementById('leadOrigin');
  const leadStage = document.getElementById('leadStage');
  const visitsTimeline = document.getElementById('visitsTimeline');
  const btnAddVisit = document.getElementById('btnAddVisit');
  const btnConvertLead = document.getElementById('convertLead');
  const leadAddVisitModal = document.getElementById('leadAddVisitModal');
  const btnLeadVisitClose = document.getElementById('btnLeadVisitClose');
  const btnLeadVisitCloseIcon = document.getElementById('btnLeadVisitCloseIcon');
  const leadAddVisitForm = document.getElementById('leadAddVisitForm');
  const leadVisitDate = document.getElementById('leadVisitDate');
  const leadVisitSummary = document.getElementById('leadVisitSummary');
  const leadVisitNotes = document.getElementById('leadVisitNotes');
  const leadVisitOutcome = document.getElementById('leadVisitOutcome');
  const leadVisitNextStep = document.getElementById('leadVisitNextStep');
  const leadVisitDateError = document.getElementById('leadVisitDateError');
  const leadVisitSummaryError = document.getElementById('leadVisitSummaryError');
  const leadVisitOutcomeError = document.getElementById('leadVisitOutcomeError');

  const editLeadBtn = document.getElementById('editLead');
  const editLeadModal = document.getElementById('editLeadModal');
  const btnEditLeadCloseIcon = document.getElementById('btnEditLeadCloseIcon');
  const btnEditLeadCancel = document.getElementById('btnEditLeadCancel');
  const editLeadForm = document.getElementById('editLeadForm');
  const editLeadName = document.getElementById('editLeadName');
  const editLeadPhone = document.getElementById('editLeadPhone');
  const editLeadEmail = document.getElementById('editLeadEmail');
  const editLeadProperty = document.getElementById('editLeadProperty');
  const editLeadOrigin = document.getElementById('editLeadOrigin');

  const leadRef = doc(db, 'leads', leadId);

  const STAGE_COLORS = {
    Novo: 'bg-yellow-100 text-yellow-800',
    Interessado: 'bg-blue-100 text-blue-800',
    'Na dúvida': 'bg-purple-100 text-purple-800',
    Convertido: 'bg-green-100 text-green-800',
    'Sem interesse': 'bg-gray-200 text-gray-800',
  };

  let leadLoaded = false;
  let usingLocalData = false;
  let visitsCache = [];
  let currentLeadData = null;

  function renderLocalLead(lead) {
    const name =
      lead.name || lead.nomeContato || lead.displayName || '(Sem nome)';
    if (leadNameHeader) leadNameHeader.textContent = name;
    if (leadName) leadName.textContent = name;
    if (leadPhone)
      leadPhone.textContent = lead.phone || lead.phoneNumber || '';
    if (leadEmail) leadEmail.textContent = lead.email || '';
    if (leadProperty)
      leadProperty.textContent = lead.propertyName || lead.property || '';
    if (leadOrigin) leadOrigin.textContent = lead.origin || lead.source || '';
    if (leadStage && lead.stage) {
      const color = STAGE_COLORS[lead.stage] || 'bg-gray-100 text-gray-800';
      leadStage.textContent = lead.stage;
      leadStage.className = `inline-block text-xs font-semibold px-2 py-1 rounded ${color}`;
    }
    currentLeadData = lead;
    if (visitsTimeline) {
      hideSpinner(visitsTimeline);
      visitsCache = getVisits().filter(
        (v) => v.refId === leadId && v.type === 'lead'
      );
      if (!visitsCache.length) {
        visitsTimeline.innerHTML =
          '<p class="text-gray-500">Nenhuma visita registrada.</p>';
      } else {
        renderVisits(visitsCache);
      }
    }
    btnAddVisit?.classList.add('hidden');
  }

  function handleLeadSnap(snap) {
    leadLoaded = true;
    if (!snap.exists()) {
      const localLead = getLeads().find((l) => l.id === leadId);
      if (localLead) {
        usingLocalData = true;
        renderLocalLead(localLead);
        return;
      }
      showToast('Lead não encontrado.', 'error');
      setTimeout(() => (window.location.href = 'dashboard-agronomo.html'), 1500);
      return;
    }
    const data = snap.data();
    currentLeadData = data;
    const name =
      data.name || data.nomeContato || data.displayName || '(Sem nome)';
    if (leadNameHeader) leadNameHeader.textContent = name;
    if (leadName) leadName.textContent = name;
    if (leadPhone)
      leadPhone.textContent = data.phone || data.phoneNumber || '';
    if (leadEmail) leadEmail.textContent = data.email || '';
    if (leadProperty)
      leadProperty.textContent = data.propertyName || data.property || '';
    if (leadOrigin) leadOrigin.textContent = data.origin || data.source || '';
    if (leadStage && data.stage) {
      const color = STAGE_COLORS[data.stage] || 'bg-gray-100 text-gray-800';
      leadStage.textContent = data.stage;
      leadStage.className = `inline-block text-xs font-semibold px-2 py-1 rounded ${color}`;
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

  function formatRole(role) {
    const roles = {
      admin: 'Admin',
      agronomo: 'Agrônomo',
      operador: 'Operador',
      cliente: 'Cliente'
    };
    return roles[role] || role || '';
  }

  function getVisitDate(v) {
    const ts = v.date || v.createdAt || v.at;
    return ts?.toDate ? ts.toDate() : new Date(ts);
  }

  function groupVisitsByDate(visits) {
    return visits.reduce((acc, v) => {
      const d = getVisitDate(v);
      const key = d.toLocaleDateString('pt-BR');
      (acc[key] = acc[key] || []).push({ ...v, __date: d });
      return acc;
    }, {});
  }

  function iconForOutcome(outcome) {
    const icons = {
      realizada: 'fas fa-check',
      reagendada: 'fas fa-redo',
      cancelada: 'fas fa-times',
      sem_contato: 'fas fa-phone-slash'
    };
    return icons[outcome] || 'fas fa-circle';
  }


  function renderVisits(visits) {
    if (!visitsTimeline) return;
    if (!visits.length) {
      visitsTimeline.innerHTML =
        '<p class="text-gray-500">Nenhuma visita registrada.</p>';
      return;
    }
    const grouped = groupVisitsByDate(visits);
    visitsTimeline.innerHTML = '';
    Object.keys(grouped)
      .sort(
        (a, b) =>
          new Date(b.split('/').reverse().join('-')) -
          new Date(a.split('/').reverse().join('-'))
      )
      .forEach((dateStr) => {
        const header = document.createElement('li');
        header.className = 'timeline-date';
        header.textContent = dateStr;
        visitsTimeline.appendChild(header);
        grouped[dateStr]
          .sort((a, b) => b.__date - a.__date)
          .forEach((v) => {
            const li = document.createElement('li');
            li.className = 'timeline-item';
            const icon = iconForOutcome(v.outcome);
            const statusClass = v.outcome ? `status-${v.outcome}` : '';
            const time = v.__date.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            });
            li.innerHTML = `
              <span class="timeline-icon ${statusClass}"><i class="${icon}"></i></span>
              <div class="text-sm text-gray-500">${time}${
                v.authorRole ? ` por ${formatRole(v.authorRole)}` : ''
              }</div>
              <div class="font-semibold">${v.summary || ''}</div>
              ${v.notes ? `<div class="mt-1 text-sm">${v.notes}</div>` : ''}
              ${v.outcome ? `<div class="mt-1 text-sm text-gray-600">Resultado: ${v.outcome}</div>` : ''}
              ${v.nextStep ? `<div class="mt-1 text-sm text-gray-600">Próximo passo: ${v.nextStep}</div>` : ''}
            `;
            visitsTimeline.appendChild(li);
          });
      });
  }

  if (visitsTimeline) showSpinner(visitsTimeline);

  const visitsRef = collection(db, `leads/${leadId}/visits`);
  const visitsQuery = query(visitsRef, orderBy('date', 'desc'));
  onSnapshot(visitsQuery, (snap) => {
    if (usingLocalData || !visitsTimeline) return;
    hideSpinner(visitsTimeline);
    visitsCache = [];
    snap.forEach((docSnap) => visitsCache.push(docSnap.data()));
    if (!visitsCache.length) {
      visitsTimeline.innerHTML = '<p class="text-gray-500">Nenhuma visita registrada.</p>';
      return;
    }
    renderVisits(visitsCache);
  });

  function validateDate() {
    if (!leadVisitDate) return true;
    const value = leadVisitDate.value;
    if (!value) {
      leadVisitDate.classList.add('border-red-500');
      if (leadVisitDateError) {
        leadVisitDateError.textContent = 'Informe a data da visita.';
        leadVisitDateError.classList.remove('hidden');
      }
      return false;
    }
    const selected = new Date(value);
    const now = new Date();
    if (selected < now) {
      leadVisitDate.classList.add('border-red-500');
      if (leadVisitDateError) {
        leadVisitDateError.textContent = 'A data não pode estar no passado.';
        leadVisitDateError.classList.remove('hidden');
      }
      return false;
    }
    leadVisitDate.classList.remove('border-red-500');
    leadVisitDate.classList.add('border-green-500');
    leadVisitDateError?.classList.add('hidden');
    return true;
  }

  function validateSummary() {
    if (!leadVisitSummary) return true;
    const value = leadVisitSummary.value.trim();
    if (!value) {
      leadVisitSummary.classList.add('border-red-500');
      if (leadVisitSummaryError) {
        leadVisitSummaryError.textContent = 'Informe o resumo da visita.';
        leadVisitSummaryError.classList.remove('hidden');
      }
      return false;
    }
    leadVisitSummary.classList.remove('border-red-500');
    leadVisitSummary.classList.add('border-green-500');
    leadVisitSummaryError?.classList.add('hidden');
    return true;
  }

  function validateOutcome() {
    if (!leadVisitOutcome) return true;
    const value = leadVisitOutcome.value;
    if (!value) {
      leadVisitOutcome.classList.add('border-red-500');
      if (leadVisitOutcomeError) {
        leadVisitOutcomeError.textContent = 'Selecione o resultado.';
        leadVisitOutcomeError.classList.remove('hidden');
      }
      return false;
    }
    leadVisitOutcome.classList.remove('border-red-500');
    leadVisitOutcome.classList.add('border-green-500');
    leadVisitOutcomeError?.classList.add('hidden');
    return true;
  }

  leadVisitDate?.addEventListener('input', validateDate);
  leadVisitSummary?.addEventListener('input', validateSummary);
  leadVisitOutcome?.addEventListener('change', validateOutcome);

  editLeadBtn?.addEventListener('click', () => {
    if (usingLocalData) {
      showToast('Não é possível editar offline.', 'error');
      return;
    }
    if (editLeadName)
      editLeadName.value =
        currentLeadData?.name ||
        currentLeadData?.nomeContato ||
        currentLeadData?.displayName ||
        '';
    if (editLeadPhone)
      editLeadPhone.value =
        currentLeadData?.phone || currentLeadData?.phoneNumber || '';
    if (editLeadEmail)
      editLeadEmail.value = currentLeadData?.email || '';
    if (editLeadProperty)
      editLeadProperty.value =
        currentLeadData?.propertyName || currentLeadData?.property || '';
    if (editLeadOrigin)
      editLeadOrigin.value =
        currentLeadData?.origin || currentLeadData?.source || '';
    toggleModal(editLeadModal, true);
  });

  btnEditLeadCancel?.addEventListener('click', () =>
    toggleModal(editLeadModal, false)
  );
  btnEditLeadCloseIcon?.addEventListener('click', () =>
    toggleModal(editLeadModal, false)
  );

  editLeadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (usingLocalData) {
      showToast('Não é possível editar offline.', 'error');
      return;
    }
    try {
      await updateDoc(leadRef, {
        name: editLeadName?.value.trim() || '',
        phone: editLeadPhone?.value.trim() || '',
        email: editLeadEmail?.value.trim() || '',
        propertyName: editLeadProperty?.value.trim() || '',
        origin: editLeadOrigin?.value.trim() || ''
      });
      toggleModal(editLeadModal, false);
      showToast('Lead atualizado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao atualizar lead:', err);
      showToast('Erro ao atualizar lead.', 'error');
    }
  });


  btnAddVisit?.addEventListener('click', () => {
    const nowIso = new Date().toISOString().slice(0, 16);
    if (leadVisitDate) {
      leadVisitDate.min = nowIso;
      leadVisitDate.value = nowIso;
    }
    if (leadVisitOutcome) leadVisitOutcome.value = '';
    leadVisitDate?.classList.remove('border-red-500', 'border-green-500');
    leadVisitSummary?.classList.remove('border-red-500', 'border-green-500');
    leadVisitOutcome?.classList.remove('border-red-500', 'border-green-500');
    leadVisitDateError?.classList.add('hidden');
    leadVisitSummaryError?.classList.add('hidden');
    leadVisitOutcomeError?.classList.add('hidden');
    toggleModal(leadAddVisitModal, true);
    leadVisitDate?.focus();
  });

  btnLeadVisitClose?.addEventListener('click', () =>
    toggleModal(leadAddVisitModal, false)
  );

  btnLeadVisitCloseIcon?.addEventListener('click', () =>
    toggleModal(leadAddVisitModal, false)
  );

  btnConvertLead?.addEventListener('click', async () => {
    if (usingLocalData) {
      showToast('Não é possível converter offline.', 'error');
      return;
    }
    try {
      const snap = await getDoc(leadRef);
      if (!snap.exists()) {
        showToast('Lead não encontrado.', 'error');
        return;
      }
      const data = snap.data();
      const clientRef = await addDoc(collection(db, 'clients'), {
        name: data.name || data.nomeContato || data.displayName || '',
        phone: data.phone || data.phoneNumber || '',
        email: data.email || '',
        origin: data.origin || data.source || '',
        propertyName: data.propertyName || data.property || '',
        status: 'ativo',
        isFavorite: false,
        tier: 'standard',
        createdAt: serverTimestamp(),
        propertyCount: 0,
        cultureCount: 0,
        enabledModules: {},
      });
      await updateDoc(leadRef, { stage: 'Convertido', clientId: clientRef.id });
      showToast('Lead convertido em cliente!', 'success');
      setTimeout(() => {
        window.location.href = `client-details.html?clientId=${clientRef.id}`;
      }, 1200);
    } catch (err) {
      console.error('Erro ao converter lead:', err);
      showToast('Erro ao converter lead.', 'error');
    }
  });

  leadAddVisitForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (usingLocalData) return;
    const validDate = validateDate();
    const validSummary = validateSummary();
    const validOutcome = validateOutcome();
    if (!validDate || !validSummary || !validOutcome) {
      showToast('Corrija os erros antes de salvar.', 'error');
      return;
    }
    try {
      const value = leadVisitDate?.value;
      await addDoc(visitsRef, {
        date: value ? Timestamp.fromDate(new Date(value)) : Timestamp.now(),
        authorId: auth.currentUser.uid,
        authorRole: userRole,
        summary: leadVisitSummary?.value.trim(),
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
      leadVisitDate?.classList.remove('border-green-500');
      leadVisitSummary?.classList.remove('border-green-500');
      leadVisitOutcome?.classList.remove('border-green-500');
      showToast('Visita registrada com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao adicionar visita:', err);
      showToast('Erro ao adicionar visita.', 'error');
    }
  });
}
