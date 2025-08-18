import { describe, it, expect } from 'vitest';
import { classifyStatus, formatDateLocal, sortTasks, dedupeTasks } from '../../public/js/lib/taskUtils.js';

const now = new Date('2024-05-15T12:00:00-03:00');

describe('classifyStatus', () => {
  it('classifies today as Pendente', () => {
    expect(classifyStatus({ dueISO: '2024-05-15' }, now)).toBe('Pendente');
  });
  it('classifies past as Atrasada', () => {
    expect(classifyStatus({ dueISO: '2024-05-10' }, now)).toBe('Atrasada');
  });
  it('classifies completed as Concluída', () => {
    expect(classifyStatus({ completedAtISO: '2024-05-14' }, now)).toBe('Concluída');
  });
});

describe('formatDateLocal', () => {
  it('formats ISO to dd/MM/yyyy', () => {
    expect(formatDateLocal('2024-05-05T00:00:00Z')).toBe('04/05/2024');
  });
});

describe('sortTasks', () => {
  it('sorts by status and due date', () => {
    const tasks = [
      { id: '1', dueISO: '2024-05-16' },
      { id: '2', dueISO: '2024-05-10' },
      { id: '3', completedAtISO: '2024-05-10' }
    ];
    const sorted = sortTasks(tasks, now).map(t => t.id);
    expect(sorted).toEqual(['2', '1', '3']);
  });
});

describe('dedupeTasks', () => {
  it('removes duplicates by id', () => {
    const tasks = [{id:'1'},{id:'1'},{id:'2'}];
    expect(dedupeTasks(tasks)).toHaveLength(2);
  });
});
