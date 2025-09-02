import { showToast } from '../services/ui.js';
import { processOutbox } from '../sync/outbox.js';
import { getClients, syncClientsFromFirestore } from '../stores/clientsStore.js';
import { getLeads, syncLeadsFromFirestore } from '../stores/leadsStore.js';
import { listVisits, syncVisitsFromFirestore } from '../stores/visitsStore.js';
import { getAgenda, updateAgenda, syncAgendaFromFirestore } from '../stores/agendaStore.js';
import { getSales } from '../stores/salesStore.js';

// IDs dos atalhos que devem ocupar duas colunas no grid da home
const MAIN_SHORTCUTS = ['quickHomeAddContato', 'quickHomeAddVisit'];

export function initHomeView({ openVisitModal, openQuickCreateModal, replotMap, renderHistory }) {
  let chartSales;
  let chartVisits;
  let chartJsPromise;

  function loadChartJs() {
    if (window.Chart) return Promise.resolve();
    if (chartJsPromise) return chartJsPromise;
    chartJsPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      s.onload = resolve;
      s.onerror = () => {
        console.warn('[charts] offline, sem Chart.js');
        resolve();
      };
      document.head.appendChild(s);
    });
    return chartJsPromise;
  }

  function renderHomeKPIs() {
    const exec = async () => {
      const now = new Date();
      const salesStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const salesTons = getSales()
        .filter((s) => new Date(s.createdAt) >= salesStart)
        .reduce((acc, s) => acc + (parseFloat(s.tons) || 0), 0);
      document.getElementById('kpiSales').textContent = String(salesTons);

      const visitsCut = now.getTime() - 28 * 24 * 60 * 60 * 1000;
      const allVisits = await listVisits();
      const visitsCount = allVisits.filter((v) => {
        const t = new Date(v.at).getTime();
        return !isNaN(t) && t >= visitsCut;
      }).length;
      document.getElementById('kpiVisits').textContent = String(visitsCount);

      const leadsCut = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      const leadsCount = getLeads().filter((l) => {
        const t = new Date(l.createdAt).getTime();
        return !isNaN(t) && t >= leadsCut;
      }).length;
      document.getElementById('kpiLeads').textContent = String(leadsCount);

      const agendaLimit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const pend = getAgenda().filter((a) => {
        if (a.done) return false;
        const w = new Date(a.when);
        return !isNaN(w) && w >= now && w <= agendaLimit;
      }).length;
      document.getElementById('kpiAgenda').textContent = String(pend);
    };
    if (!document.getElementById('kpiSales')?.textContent) {
      setTimeout(exec, 300);
    } else exec();
  }

  function monthLabels() {
    const arr = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d
        .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        .replace('.', '')
        .toUpperCase();
      arr.push({ key, label });
    }
    return arr;
  }

  function getISOWeek(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  }

  function weekLabels() {
    const res = [];
    const now = new Date();
    const monday = new Date(now);
    const diff = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    for (let i = 11; i >= 0; i--) {
      const start = new Date(monday);
      start.setDate(monday.getDate() - i * 7);
      const year = start.getFullYear();
      const week = getISOWeek(start);
      res.push({
        key: `${year}-${week}`,
        label: `sem ${String(week).padStart(2, '0')}/${String(year).slice(-2)}`,
      });
    }
    return res;
  }

  async function renderSalesChart() {
    const container = document.getElementById('chartSales');
    if (!container) return;
    if (!chartSales) {
      await new Promise((r) => setTimeout(r, 300));
    }
    const months = monthLabels();
    const map = new Map(months.map((m) => [m.key, 0]));
    getSales().forEach((s) => {
      const d = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const tons = parseFloat(s.tons) || 0;
      if (map.has(key)) map.set(key, map.get(key) + tons);
    });
    const labels = months.map((m) => m.label);
    const data = months.map((m) => map.get(m.key));
    if (!data.some((v) => v > 0)) {
      container.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">Sem dados no período</div>';
      return;
    }
    try {
      await loadChartJs();
      if (!window.Chart) {
        container.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">Sem gráficos offline</div>';
        return;
      }
      if (!chartSales) {
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.className = 'h-56 md:h-64 w-full';
        canvas.setAttribute('aria-label', 'Gráfico de vendas dos últimos 6 meses');
        container.appendChild(canvas);
        chartSales = new Chart(canvas, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                data,
                backgroundColor: '#166534',
              },
            ],
          },
          options: {
            plugins: {
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.label} — ${ctx.parsed.y} t`,
                },
              },
              legend: { display: false },
            },
            scales: {
              x: {
                ticks: {
                  color: '#4b5563',
                  font: { size: window.innerWidth < 360 ? 10 : 12 },
                },
                grid: { color: 'rgba(0,0,0,0.03)' },
              },
              y: {
                beginAtZero: true,
                ticks: { color: '#4b5563' },
                grid: { color: 'rgba(0,0,0,0.05)' },
              },
            },
          },
        });
      } else {
        chartSales.data.labels = labels;
        chartSales.data.datasets[0].data = data;
        chartSales.update();
      }
    } catch (e) {
      console.warn('[charts] erro ao renderizar', e);
      container.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">Sem gráficos no momento</div>';
    }
  }

  async function renderVisitsChart() {
    const container = document.getElementById('chartVisits');
    if (!container) return;
    if (!chartVisits) {
      await new Promise((r) => setTimeout(r, 300));
    }
    const weeks = weekLabels();
    const map = new Map(weeks.map((w) => [w.key, 0]));
    const allVisits = await listVisits();
    allVisits.forEach((v) => {
      const d = new Date(v.at);
      const key = `${d.getFullYear()}-${getISOWeek(d)}`;
      if (map.has(key)) map.set(key, map.get(key) + 1);
    });
    const labels = weeks.map((w) => w.label);
    const data = weeks.map((w) => map.get(w.key));
    if (!data.some((v) => v > 0)) {
      container.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">Sem dados no período</div>';
      return;
    }
    try {
      await loadChartJs();
      if (!window.Chart) {
        container.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">Sem gráficos offline</div>';
        return;
      }
      if (!chartVisits) {
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.className = 'h-56 md:h-64 w-full';
        canvas.setAttribute('aria-label', 'Gráfico de visitas por semana');
        container.appendChild(canvas);
        chartVisits = new Chart(canvas, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                data,
                borderColor: '#166534',
                backgroundColor: 'rgba(22,101,52,0.2)',
                tension: 0.3,
              },
            ],
          },
          options: {
            plugins: {
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.parsed.y} visitas`,
                },
              },
              legend: { display: false },
            },
            scales: {
              x: {
                ticks: {
                  color: '#4b5563',
                  font: { size: window.innerWidth < 360 ? 10 : 12 },
                },
                grid: { color: 'rgba(0,0,0,0.03)' },
              },
              y: {
                beginAtZero: true,
                ticks: { color: '#4b5563' },
                grid: { color: 'rgba(0,0,0,0.05)' },
              },
            },
          },
        });
      } else {
        chartVisits.data.labels = labels;
        chartVisits.data.datasets[0].data = data;
        chartVisits.update();
      }
    } catch (e) {
      console.warn('[charts] erro ao renderizar', e);
      container.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">Sem gráficos no momento</div>';
    }
  }

  function renderLeadsFunnel() {
    const container = document.getElementById('chartLeadsFunnel');
    if (!container) return;
    container.innerHTML = '';
    const stages = ['Novo', 'Interessado', 'Na dúvida', 'Convertido', 'Sem interesse'];
    const counts = {};
    stages.forEach((s) => (counts[s] = 0));
    getLeads().forEach((l) => {
      counts[l.stage] = (counts[l.stage] || 0) + 1;
    });
    stages.forEach((stage) => {
      const div = document.createElement('div');
      const active = stage !== 'Sem interesse';
      div.className = `flex-1 min-w-0 rounded-xl p-3 text-center text-sm transition transform hover:scale-105 hover:shadow-lg bg-gradient-to-br ${
        active ? 'from-emerald-100 to-emerald-200 text-emerald-700' : 'from-gray-200 to-gray-300 text-gray-600'
      }`;
      div.title = String(counts[stage]);
      div.innerHTML = `<div class="text-lg font-bold">${counts[stage] || 0}</div><div class="text-xs whitespace-normal break-words leading-tight">${stage}</div>`;
      container.appendChild(div);
    });
  }

  async function renderHomeCharts() {
    const home = document.getElementById('view-home');
    if (home?.classList.contains('hidden')) return;
    try {
      await renderSalesChart();
      await renderVisitsChart();
      renderLeadsFunnel();
    } catch (e) {
      console.error(e);
    }
  }

  function bindHomeShortcuts() {
    // aplica span configurável aos atalhos principais
    MAIN_SHORTCUTS.forEach((id) => {
      document.getElementById(id)?.classList.add('col-span-2');
    });

    document.getElementById('quickHomeAddContato')?.addEventListener('click', () => openQuickCreateModal('cliente'));
    document.getElementById('quickHomeAddVisit')?.addEventListener('click', () => openVisitModal());
    document.getElementById('quickHomeOpenMap')?.addEventListener('click', () => {
      location.hash = '#mapa';
    });
    document.getElementById('quickHomeOpenContacts')?.addEventListener('click', () => {
      location.hash = '#contatos';
    });
    document.getElementById('quickHomeGotoAgenda')?.addEventListener('click', () => {
      location.hash = '#home';
      const ag = document.getElementById('agendaHome');
      ag?.scrollIntoView({ behavior: 'smooth' });
      if (ag) {
        ag.classList.add('ring', 'ring-green-500');
        setTimeout(() => ag.classList.remove('ring', 'ring-green-500'), 2000);
      }
    });
    document.getElementById('quickHomeSyncNow')?.addEventListener('click', async () => {
      if (!navigator.onLine) {
        showToast('Sem conexão. Tente sincronizar quando voltar a internet.', 'info');
        return;
      }
      try {
        showToast('Sincronizando…', 'info', 2000);
        await processOutbox();
        await Promise.all([
          syncClientsFromFirestore(),
          syncLeadsFromFirestore(),
          syncAgendaFromFirestore(),
          syncVisitsFromFirestore(),
          listVisits(),
        ]);
        replotMap();
        await renderHistory();
        await renderHomeCharts();
        showToast('Sincronizado com sucesso.', 'success');
      } catch (e) {
        console.error('[sync] erro', e);
        showToast('Falha ao sincronizar. Tente novamente.', 'error');
      }
    });
  }

  function renderAgendaHome(periodDays = 7) {
    const select = document.getElementById('agendaPeriod');
    if (select) select.value = String(periodDays);
    const listEl = document.getElementById('agendaList');
    const emptyEl = document.getElementById('agendaEmpty');
    if (!listEl || !emptyEl) return;
    listEl.textContent = '';
    const agenda = getAgenda();
    const now = new Date();
    const limit = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);
    const leads = getLeads().filter((l) => l.stage !== 'Convertido');
    const clients = getClients();
    const items = agenda
      .filter((it) => {
        if (it.done) return false;
        const w = new Date(it.when);
        if (isNaN(w)) return false;
        return w >= now && w <= limit;
      })
      .sort((a, b) => new Date(a.when) - new Date(b.when));
    items.forEach((it) => {
      const when = new Date(it.when);
      const li = document.createElement('li');
      li.className = 'rounded-xl border border-gray-100 bg-white p-3 hover:bg-gray-50 transition flex justify-between items-start gap-2';
      const info = document.createElement('div');
      info.className = 'flex-1 space-y-1';
      const dt = document.createElement('div');
      dt.className = 'text-sm text-gray-600';
      dt.textContent = when.toLocaleString('pt-BR');
      const nameDiv = document.createElement('div');
      nameDiv.className = 'font-semibold text-gray-800';
      let name = '(sem nome)';
      let type = 'Lead';
      if (it.clientId) {
        const c = clients.find((cl) => cl.id === it.clientId);
        name = c?.name || '(sem nome)';
        type = 'Cliente';
      } else if (it.leadId) {
        const l = leads.find((ld) => ld.id === it.leadId);
        name = l?.name || '(sem nome)';
        type = 'Lead';
      }
      const badge = document.createElement('span');
      badge.className = 'text-xs rounded px-1.5 py-0.5 bg-blue-50 text-blue-700 mr-1';
      badge.textContent = type;
      nameDiv.textContent = '';
      nameDiv.appendChild(badge);
      nameDiv.appendChild(document.createTextNode(name));
      info.appendChild(dt);
      info.appendChild(nameDiv);
      if (it.note) {
        const note = document.createElement('div');
        note.className = 'text-xs text-gray-500';
        note.textContent = it.note;
        info.appendChild(note);
      }
      const btn = document.createElement('button');
      btn.className = 'btn-secondary text-sm min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 hover:bg-gray-200';
      btn.textContent = 'Concluir';
      btn.addEventListener('click', () => {
        updateAgenda(it.id, { done: true });
        renderAgendaHome(parseInt(select.value));
        renderHomeKPIs();
      });
      li.appendChild(info);
      li.appendChild(btn);
      listEl.appendChild(li);
    });
    listEl.classList.toggle('hidden', items.length === 0);
    emptyEl.classList.toggle('hidden', items.length !== 0);
    const upcomingCount = agenda.filter((it) => {
      if (it.done) return false;
      const w = new Date(it.when);
      if (isNaN(w)) return false;
      return w >= now && w <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }).length;
    toggleHomeBadge(upcomingCount);
  }

  function bindAgendaHomeEvents() {
    document.getElementById('agendaPeriod')?.addEventListener('change', (e) => {
      const days = parseInt(e.target.value);
      renderAgendaHome(days);
    });
    document.getElementById('btnAgendaAddVisit')?.addEventListener('click', () => {
      openVisitModal();
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
        badge.className = 'badge absolute top-0 right-1 bg-red-500 text-white rounded-full text-xs px-1';
        btn.appendChild(badge);
      }
      badge.textContent = String(count);
    } else {
      badge?.remove();
    }
  }

  bindHomeShortcuts();
  bindAgendaHomeEvents();

  return { renderHomeKPIs, renderHomeCharts, renderAgendaHome };
}
