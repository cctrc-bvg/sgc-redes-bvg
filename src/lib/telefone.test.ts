import { describe, expect, it } from 'vitest';
import { mascararTelefone } from './telefone';

describe('máscara de telefone', () => {
  it('formata enquanto digita', () => {
    expect(mascararTelefone('8')).toBe('(8');
    expect(mascararTelefone('85')).toBe('(85');
    expect(mascararTelefone('859')).toBe('(85) 9');
    expect(mascararTelefone('859999')).toBe('(85) 9999');
    expect(mascararTelefone('8599999')).toBe('(85) 9999-9');
    expect(mascararTelefone('8599991234')).toBe('(85) 9999-1234');
    expect(mascararTelefone('85999991234')).toBe('(85) 99999-1234');
  });

  it('ignora letras, excesso de dígitos e o DDI colado', () => {
    expect(mascararTelefone('(85) 99999-1234 ramal')).toBe('(85) 99999-1234');
    expect(mascararTelefone('+55 85 99999-1234')).toBe('(85) 99999-1234');
    expect(mascararTelefone('859999912341234')).toBe('(85) 99999-1234');
    expect(mascararTelefone('')).toBe('');
  });
});
