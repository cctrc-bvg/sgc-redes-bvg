import { describe, expect, it } from 'vitest';
import { tipoDeAtor } from './atores';

describe('tipoDeAtor', () => {
  it('classifica quem faz cada etapa', () => {
    expect(tipoDeAtor('Coordenação')).toBe('gestao');
    expect(tipoDeAtor('Coordenação/CTP/Direção')).toBe('gestao');
    expect(tipoDeAtor('Professores')).toBe('docencia');
    expect(tipoDeAtor('Docente')).toBe('docencia');
    expect(tipoDeAtor('Sistema/Coordenação')).toBe('sistema');
    expect(tipoDeAtor('Assistência Estudantil')).toBe('setor');
    expect(tipoDeAtor('Interessado/setor')).toBe('setor');
    expect(tipoDeAtor('Você')).toBe('todos');
  });
});
