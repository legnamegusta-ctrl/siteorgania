import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

export function loadDOM(path) {
  const html = readFileSync(path, 'utf8');
  return new JSDOM(html, { url: 'http://localhost', pretendToBeVisual: true });
}

export function setTimezone() {
  process.env.TZ = 'America/Sao_Paulo';
}
