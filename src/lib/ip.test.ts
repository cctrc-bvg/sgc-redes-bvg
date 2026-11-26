import { describe, expect, it } from 'vitest';
import { ipDeOrigem } from './ip';

describe('ipDeOrigem', () => {
  it('um proxy: vale o último da lista, não o que o cliente escreveu no começo', () => {
    expect(ipDeOrigem('10.9.9.9, 200.1.2.3', null)).toBe('200.1.2.3');
    expect(ipDeOrigem('200.1.2.3', null)).toBe('200.1.2.3');
  });
  it('dois proxies: pula o do meio', () => {
    expect(ipDeOrigem('falso, 200.1.2.3, 10.0.0.2', null, 2)).toBe('200.1.2.3');
  });
  it('sem X-Forwarded-For usa X-Real-IP; sem nada, nulo; valor absurdo é descartado', () => {
    expect(ipDeOrigem(null, '200.1.2.3')).toBe('200.1.2.3');
    expect(ipDeOrigem(null, null)).toBeNull();
    expect(ipDeOrigem('x'.repeat(100), null)).toBeNull();
  });
});
