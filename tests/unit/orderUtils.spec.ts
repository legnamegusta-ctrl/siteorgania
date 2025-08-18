import { describe, it, expect } from 'vitest';
import { mergeOrderTasks, calcOrderProgress, recountByStatus } from '../../public/js/lib/orderUtils.js';

const orders = [
  { id:'1', code:'ORD-001', tasks:[
    { id:'a', dueISO:'2024-05-15' },
    { id:'b', completedAtISO:'2024-05-10' }
  ]}
];

const now = new Date('2024-05-15T12:00:00-03:00');

describe('mergeOrderTasks', () => {
  it('flattens tasks with order info', () => {
    const res = mergeOrderTasks(orders);
    expect(res[0]).toMatchObject({ orderId:'1', orderCode:'ORD-001', source:'ordem' });
  });
});

describe('calcOrderProgress', () => {
  it('computes percentages', () => {
    const tasks = mergeOrderTasks(orders);
    const prog = calcOrderProgress(tasks, now);
    expect(prog).toEqual({ percent:50, open:1, total:2 });
  });
});

describe('recountByStatus', () => {
  it('counts statuses', () => {
    const tasks = mergeOrderTasks(orders);
    const counts = recountByStatus(tasks, now);
    expect(counts).toEqual({ Concluída:1, Pendente:1, Atrasada:0 });
  });
});
