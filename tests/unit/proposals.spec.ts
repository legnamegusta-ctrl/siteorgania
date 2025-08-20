import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('proposals actions', () => {
  const src = readFileSync('public/js/pages/dashboard-agronomo.js', 'utf8');
  it('includes Aceitar and Rejeitar action labels', () => {
    expect(src).toMatch('>Aceitar<');
    expect(src).toMatch('>Rejeitar<');
  });
});
