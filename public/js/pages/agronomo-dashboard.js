// public/js/pages/agronomo-dashboard.js
import { STORE_NAMES, getAll } from '../data/crm-store.js';

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function updateKPIs() {
  const leads = await getAll(STORE_NAMES.LEADS);
  const visitas = await getAll(STORE_NAMES.VISITAS);
  const propostas = await getAll(STORE_NAMES.PROPOSTAS);

  const now = new Date();
  const sevenDays = new Date(now.getTime() - 7 * 86400000);
  const thirtyDays = new Date(now.getTime() - 30 * 86400000);

  const leads7d = leads.filter(l => new Date(l.criadoEm) >= sevenDays).length;
  const visitas7d = visitas.filter(v => new Date(v.inicio) >= sevenDays).length;
  const propostasAtivas = propostas.filter(p => ['Enviada', 'Rascunho'].includes(p.status)).length;

  const convNumerador = leads.filter(l => l.estagio === 'Fechado-Ganho' && new Date(l.criadoEm) >= thirtyDays).length;
  const convDenom = leads.filter(l => new Date(l.criadoEm) >= thirtyDays).length;
  const conversao = convDenom ? Math.round((convNumerador / convDenom) * 100) : 0;

  document.getElementById('kpi-leads-7d').textContent = leads7d;
  document.getElementById('kpi-visitas-7d').textContent = visitas7d;
  document.getElementById('kpi-propostas-ativas').textContent = propostasAtivas;
  document.getElementById('kpi-conversao-30d').textContent = `${conversao}%`;
}

function handleOffline() {
  const indicator = document.getElementById('offlineIndicator');
  const toggle = () => {
    if (navigator.onLine) {
      indicator.classList.add('hidden');
    } else {
      indicator.classList.remove('hidden');
    }
  };
  window.addEventListener('online', toggle);
  window.addEventListener('offline', toggle);
  toggle();
}

export function initAgronomoDashboard() {
  handleOffline();
  updateKPIs();
}

document.addEventListener('DOMContentLoaded', initAgronomoDashboard);
