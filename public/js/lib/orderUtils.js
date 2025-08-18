import { classifyStatus } from './taskUtils.js';

export function mergeOrderTasks(orders = []) {
  const tasks = [];
  orders.forEach(order => {
    const { id: orderId, code: orderCode, tasks: orderTasks = [] } = order || {};
    orderTasks.forEach((t, idx) => {
      const id = t.id || `ord:${orderId}:${idx}`;
      tasks.push({ ...t, id, orderId, orderCode, source: 'ordem' });
    });
  });
  return tasks;
}

export function calcOrderProgress(tasks = [], now = new Date()) {
  const total = tasks.length;
  const open = tasks.filter(t => classifyStatus(t, now) !== 'Concluída').length;
  const percent = total ? Math.round(((total - open) / total) * 100) : 0;
  return { percent, open, total };
}

export function recountByStatus(tasks = [], now = new Date()) {
  const counts = { Concluída: 0, Pendente: 0, Atrasada: 0 };
  tasks.forEach(t => {
    const s = classifyStatus(t, now);
    counts[s]++;
  });
  return counts;
}
