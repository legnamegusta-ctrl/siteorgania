import { describe, it, expect } from 'vitest';
import { loadDOM } from '../utils/dom.js';
import { selectors } from '../utils/selectors.ts';

describe('dashboard DOM', () => {
  const dom = loadDOM('public/operador-dashboard.html');
  it('contains dashboard table', () => {
    const el = dom.window.document.querySelector(selectors.tblDashboardTarefas);
    expect(el).not.toBeNull();
  });
});
