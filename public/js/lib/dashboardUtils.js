import { dedupeTasks } from './taskUtils.js';
import { mergeOrderTasks } from './orderUtils.js';
import { classifyStatus } from './taskUtils.js';

export function mergeDashboardTasks({ dashboardTasks = [], orders = [] }) {
  const orderTasks = mergeOrderTasks(orders);
  return dedupeTasks([...dashboardTasks, ...orderTasks]);
}

export function calcKPIs(tasks = [], now = new Date()) {
  const counts = { concluidas: 0, pendentes: 0, atrasadas: 0, novasMes: 0, concluidasMes: 0 };
  const tz = 'America/Sao_Paulo';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const y = parts.find(p=>p.type==='year').value;
  const m = parts.find(p=>p.type==='month').value;
  tasks.forEach(t => {
    const status = classifyStatus(t, now);
    if (status === 'Concluída') counts.concluidas++;
    if (status === 'Pendente') counts.pendentes++;
    if (status === 'Atrasada') counts.atrasadas++;
    const due = t.dueISO ? new Date(new Date(t.dueISO).toLocaleString('en-US', { timeZone: tz })) : null;
    if (due && due.getFullYear() == y && String(due.getMonth()+1).padStart(2,'0') == m) counts.novasMes++;
    const comp = t.completedAtISO ? new Date(new Date(t.completedAtISO).toLocaleString('en-US',{timeZone:tz})) : null;
    if (comp && comp.getFullYear()==y && String(comp.getMonth()+1).padStart(2,'0')==m) counts.concluidasMes++;
  });
  return counts;
}

export function buildPieDataset(tasks = [], now = new Date()) {
  const counts = { Concluída: 0, Pendente: 0, Atrasada: 0 };
  tasks.forEach(t => counts[classifyStatus(t, now)]++);
  return {
    labels: ['Concluídas', 'Pendentes', 'Atrasadas'],
    data: [counts.Concluída, counts.Pendente, counts.Atrasada]
  };
}

export function buildNext7DaysDataset(tasks = [], now = new Date()) {
  const tz = 'America/Sao_Paulo';
  const today = new Date(new Date(now).toLocaleString('en-US',{timeZone:tz}));
  const limit = new Date(today.getTime() + 7*24*3600*1000);
  const map = new Map();
  tasks.forEach(t => {
    if (classifyStatus(t, now) === 'Concluída') return;
    if (!t.dueISO) return;
    const due = new Date(new Date(t.dueISO).toLocaleString('en-US',{timeZone:tz}));
    if (due > limit || due < today) return;
    const key = `${due.getFullYear()}-${due.getMonth()+1}-${due.getDate()}`;
    map.set(key, (map.get(key)||0)+1);
  });
  const entries = Array.from(map.entries()).sort((a,b)=>new Date(a[0]) - new Date(b[0]));
  return entries.map(([date,count])=>({date,count}));
}
