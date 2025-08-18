import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { mergeDashboardTasks, calcKPIs } from '../../public/js/lib/dashboardUtils.js';
import { mergeOrderTasks } from '../../public/js/lib/orderUtils.js';
import { classifyStatus } from '../../public/js/lib/taskUtils.js';
import { setTimezone } from '../utils/dom.js';

describe('data mapping from seed', () => {
  setTimezone();
  const seed = JSON.parse(readFileSync('tests/fixtures/seed.json','utf8'));
  const now = new Date('2024-05-15T12:00:00-03:00');

  it('flattens order tasks with order info', () => {
    const tasks = mergeOrderTasks(seed.orders);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toHaveProperty('orderCode');
  });

  it('merges dashboard and order tasks', () => {
    const tasks = mergeDashboardTasks({ dashboardTasks: seed.tasks, orders: seed.orders });
    expect(tasks).toHaveLength(5);
    const statuses = tasks.map(t => classifyStatus(t, now));
    expect(statuses.filter(s=>s==='Concluída')).toHaveLength(2);
    expect(statuses.filter(s=>s==='Pendente')).toHaveLength(2);
    expect(statuses.filter(s=>s==='Atrasada')).toHaveLength(1);
  });

  it('computes KPI counts', () => {
    const tasks = mergeDashboardTasks({ dashboardTasks: seed.tasks, orders: seed.orders });
    const kpi = calcKPIs(tasks, now);
    expect(kpi).toEqual({ concluidas:2, pendentes:2, atrasadas:1, novasMes:5, concluidasMes:2 });
  });
});
