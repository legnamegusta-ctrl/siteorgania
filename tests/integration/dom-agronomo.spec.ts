import { describe, it, expect } from 'vitest';
import { loadDOM } from '../utils/dom.js';

// Ensure dashboard-agronomo.html has proposals table with proper columns

describe('dashboard agrônomo DOM', () => {
  const dom = loadDOM('public/dashboard-agronomo.html');
  it('contains proposals table with expected headers', () => {
    const doc = dom.window.document;
    const headers = Array.from(doc.querySelectorAll('#tbl-propostas thead th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Lead', 'Valor', 'Status', 'Validade', 'Ações']);
  });
});
