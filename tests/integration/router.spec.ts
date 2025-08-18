import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { handleHashChange } from '../../public/js/lib/router.js';

function makeDOM() {
  const dom = new JSDOM(`
    <div id="dashboard"></div>
    <div id="order-view" class="hidden"></div>
    <div id="task-view" class="hidden"></div>
  `);
  return dom;
}

describe('handleHashChange', () => {
  it('shows order view for #order/', () => {
    const dom = makeDOM();
    handleHashChange('#order/1', dom.window.document);
    const order = dom.window.document.getElementById('order-view');
    const dash = dom.window.document.getElementById('dashboard');
    expect(order.classList.contains('hidden')).toBe(false);
    expect(dash.classList.contains('hidden')).toBe(true);
  });

  it('shows task view for #task/', () => {
    const dom = makeDOM();
    handleHashChange('#task/99', dom.window.document);
    const task = dom.window.document.getElementById('task-view');
    const dash = dom.window.document.getElementById('dashboard');
    expect(task.classList.contains('hidden')).toBe(false);
    expect(dash.classList.contains('hidden')).toBe(true);
  });

  it('defaults to dashboard for other hashes', () => {
    const dom = makeDOM();
    handleHashChange('#unknown', dom.window.document);
    const dash = dom.window.document.getElementById('dashboard');
    expect(dash.classList.contains('hidden')).toBe(false);
  });
});
