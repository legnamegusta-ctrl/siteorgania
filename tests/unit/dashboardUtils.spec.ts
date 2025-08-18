import { describe, it, expect } from 'vitest';
import { mergeDashboardTasks, calcKPIs, buildPieDataset, buildNext7DaysDataset } from '../../public/js/lib/dashboardUtils.js';

const now = new Date('2024-05-15T12:00:00-03:00');

const dashboardTasks = [ {id:'x', dueISO:'2024-05-20'} ];
const orders = [ {id:'1', code:'ORD-001', tasks:[{id:'y', dueISO:'2024-05-10'}]} ];

describe('mergeDashboardTasks', () => {
  it('merges dashboard and order tasks', () => {
    const tasks = mergeDashboardTasks({ dashboardTasks, orders });
    expect(tasks).toHaveLength(2);
  });
});

describe('calcKPIs', () => {
  it('calculates counts', () => {
    const tasks = mergeDashboardTasks({ dashboardTasks, orders });
    const kpi = calcKPIs(tasks, now);
    expect(kpi.pendentes).toBe(2);
  });
});

describe('buildPieDataset', () => {
  it('returns dataset', () => {
    const tasks = mergeDashboardTasks({ dashboardTasks, orders });
    const pie = buildPieDataset(tasks, now);
    expect(pie.data.reduce((a,b)=>a+b,0)).toBe(2);
  });
});

describe('buildNext7DaysDataset', () => {
  it('filters next seven days', () => {
    const tasks = mergeDashboardTasks({ dashboardTasks, orders });
    const ds = buildNext7DaysDataset(tasks, now);
    expect(Array.isArray(ds)).toBe(true);
  });
});
