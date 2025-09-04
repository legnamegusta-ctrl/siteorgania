import { showToast } from '../services/ui.js';
import { processOutbox } from '../sync/outbox.js';
import { getLeads, syncLeadsFromFirestore } from '../stores/leadsStore.js';
import { listVisits, syncVisitsFromFirestore } from '../stores/visitsStore.js';
import { getAgenda, updateAgenda, syncAgendaFromFirestore } from '../stores/agendaStore.js';

export function initHomeSummaryView({
  openVisitModal,
  openQuickCreateModal,
  replotMap,
  renderHistory,
}) {
  async function renderTodayAgenda() {
    const listEl = document.getElementById('todayAppointments');
    if (!listEl) return;
    listEl.textContent = '';
    const agenda = getAgenda();
    const leads = getLeads();
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const items = agenda
      .filter((it) => {
        if (it.done) return false;
        const w = new Date(it.when);
        return !isNaN(w) && w >= start && w <= end;
      })
      .sort((a, b) => new Date(a.when) - new Date(b.when));
    items.forEach((it) => {
      const when = new Date(it.when);
      const li = document.createElement('li');
      li.className =
        'rounded-xl border border-gray-100 bg-white p-3 hover:bg-gray-50 transition flex justify-between items-start gap-2';
      const info = document.createElement('div');
      info.className = 'flex-1 space-y-1';
      const dt = document.createElement('div');
      dt.className = 'text-sm text-gray-600';
      dt.textContent = when.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const nameDiv = document.createElement('div');
      nameDiv.className = 'font-semibold text-gray-800';
      let name = it.title || '(sem título)';
      if (it.leadId) {
        const l = leads.find((ld) => ld.id === it.leadId);
        if (l?.name) name = l.name;
      }
      nameDiv.textContent = name;
      info.appendChild(dt);
      info.appendChild(nameDiv);
      if (it.note) {
        const note = document.createElement('div');
        note.className = 'text-xs text-gray-500';
        note.textContent = it.note;
        info.appendChild(note);
      }
      const btn = document.createElement('button');
      btn.className =
        'btn-secondary text-sm min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 hover:bg-gray-200';
      btn.textContent = 'Concluir';
      btn.addEventListener('click', () => {
        updateAgenda(it.id, { done: true });
        renderTodayAgenda();
      });
      li.appendChild(info);
      li.appendChild(btn);
      listEl.appendChild(li);
    });
    const upcomingCount = getAgenda().filter((it) => {
      if (it.done) return false;
      const w = new Date(it.when);
      return !isNaN(w) && w >= now && w <= new Date(now.getTime() + 7 * 86400000);
    }).length;
    toggleHomeBadge(upcomingCount);
  }

  async function renderRecentActivity() {
    const listEl = document.getElementById('recentActivitiesList');
    if (!listEl) return;
    listEl.textContent = '';
    const allVisits = await listVisits();
    const visits = allVisits
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 5);
    if (visits.length === 0) {
      const li = document.createElement('li');
      li.className = 'text-sm text-gray-500';
      li.textContent = 'Nenhuma atividade recente.';
      listEl.appendChild(li);
      return;
    }
    visits.forEach((v) => {
      const li = document.createElement('li');
      li.className = 'rounded-xl border border-gray-100 bg-white p-3 space-y-1';
      const title = document.createElement('div');
      title.className = 'font-semibold text-gray-800';
      title.textContent = v.summary || 'Visita';
      const dt = document.createElement('div');
      dt.className = 'text-xs text-gray-500';
      dt.textContent = new Date(v.at).toLocaleString('pt-BR');
      li.appendChild(title);
      li.appendChild(dt);
      listEl.appendChild(li);
    });
  }

  function bindQuickActions() {
    document.getElementById('shortcutAddVisit')?.addEventListener('click', () =>
      openVisitModal()
    );
    document.getElementById('shortcutNewLead')?.addEventListener('click', () =>
      openQuickCreateModal('lead')
    );
    document.getElementById('shortcutOpenMap')?.addEventListener('click', () => {
      location.hash = '#mapa';
    });
    document.getElementById('shortcutSync')?.addEventListener('click', async () => {
      if (!navigator.onLine) {
        showToast('Sem conexão. Tente sincronizar quando voltar a internet.', 'info');
        return;
      }
      try {
        showToast('Sincronizando…', 'info', 2000);
        await processOutbox();
        await Promise.all([
          syncLeadsFromFirestore(),
          syncAgendaFromFirestore(),
          syncVisitsFromFirestore(),
          listVisits(),
        ]);
        replotMap();
        await renderHistory();
        await renderTodayAgenda();
        await renderRecentActivity();
        showToast('Sincronizado com sucesso.', 'success');
      } catch (e) {
        console.error('[sync] erro', e);
        showToast('Falha ao sincronizar. Tente novamente.', 'error');
      }
    });
  }

  function toggleHomeBadge(count) {
    const btn = document.querySelector('#bottomBar button[data-nav="#home"]');
    if (!btn) return;
    btn.classList.add('relative');
    let badge = btn.querySelector('span.badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className =
          'badge absolute top-0 right-1 bg-red-500 text-white rounded-full text-xs px-1';
        btn.appendChild(badge);
      }
      badge.textContent = String(count);
    } else {
      badge?.remove();
    }
  }

  return { renderTodayAgenda, renderRecentActivity, bindQuickActions };
}
