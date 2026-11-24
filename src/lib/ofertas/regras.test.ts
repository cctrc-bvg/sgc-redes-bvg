import { describe, expect, it } from 'vitest';
import {
  anoLetivoAtual,
  descreverPeriodoLetivo,
  lerAnoLetivo,
  planejarDistribuicao,
  resumirPlano,
  semestreLetivoDaDisciplina,
  type OfertaAtual,
} from './regras';

describe('ano letivo', () => {
  it('usa o fuso de Fortaleza na virada do ano', () => {
    // 01/01/2027 01:00 UTC ainda é 31/12/2026 22:00 em Fortaleza.
    expect(anoLetivoAtual(new Date('2027-01-01T01:00:00Z'))).toBe(2026);
    expect(anoLetivoAtual(new Date('2027-01-01T03:00:00Z'))).toBe(2027);
  });

  it.each([
    ['2026', 2026],
    ['2020', 2020],
    ['2019', null],
    ['2101', null],
    ['26', null],
    ['2026.1', null],
    [undefined, null],
  ])('lerAnoLetivo(%s) → %s', (valor, esperado) => {
    expect(lerAnoLetivo(valor)).toBe(esperado);
  });
});

describe('semestreLetivoDaDisciplina', () => {
  it('anual não tem semestre', () => {
    expect(semestreLetivoDaDisciplina(null)).toBeNull();
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 1],
    [4, 2],
    [5, 1],
    [6, 2],
  ])('%iº semestre do curso → %iº semestre letivo', (curso, letivo) => {
    expect(semestreLetivoDaDisciplina(curso)).toBe(letivo);
  });

  it('descreve o período', () => {
    expect(descreverPeriodoLetivo(2026, null)).toBe('2026 (anual)');
    expect(descreverPeriodoLetivo(2026, 2)).toBe('2026.2');
  });
});

describe('planejarDistribuicao', () => {
  const aptos = new Set(['prof-a', 'prof-b']);
  const atuais = new Map<string, OfertaAtual>([
    ['bio', { id: 'of-bio', professorId: 'prof-a', emUso: false }],
    ['fis', { id: 'of-fis', professorId: 'prof-a', emUso: true }],
    ['qui', { id: 'of-qui', professorId: 'prof-desativado', emUso: false }],
  ]);

  it('cria, troca e remove conforme o desejado', () => {
    const plano = planejarDistribuicao({
      atuais,
      professoresAptos: aptos,
      desejado: new Map([
        ['mat', 'prof-b'], // nova
        ['bio', ''], // remove
        ['fis', 'prof-b'], // troca
        ['geo', ''], // continua sem oferta
      ]),
    });
    expect(plano.erros).toEqual({});
    expect(plano.criar).toEqual([{ disciplinaId: 'mat', professorId: 'prof-b' }]);
    expect(plano.alterar).toEqual([{ ofertaId: 'of-fis', disciplinaId: 'fis', professorAnterior: 'prof-a', professorNovo: 'prof-b' }]);
    expect(plano.remover).toEqual([{ ofertaId: 'of-bio', disciplinaId: 'bio' }]);
    expect(resumirPlano(plano)).toBe('Distribuição salva: 1 oferta(s) criada(s), 1 professor(es) trocado(s), 1 oferta(s) removida(s).');
  });

  it('sem mudanças não gera operações', () => {
    const plano = planejarDistribuicao({ atuais, professoresAptos: aptos, desejado: new Map([['bio', 'prof-a']]) });
    expect([plano.criar, plano.alterar, plano.remover]).toEqual([[], [], []]);
    expect(resumirPlano(plano)).toBe('Nenhuma alteração para salvar.');
  });

  it('mantém professor desativado que já estava na oferta', () => {
    const plano = planejarDistribuicao({ atuais, professoresAptos: aptos, desejado: new Map([['qui', 'prof-desativado']]) });
    expect(plano.erros).toEqual({});
    expect(plano.alterar).toEqual([]);
  });

  it('recusa professor fora da lista de aptos (id forjado ou desativado)', () => {
    const plano = planejarDistribuicao({ atuais, professoresAptos: aptos, desejado: new Map([['mat', 'intruso'], ['bio', 'prof-desativado']]) });
    expect(Object.keys(plano.erros).sort()).toEqual(['bio', 'mat']);
    expect(plano.criar).toEqual([]);
  });

  it('não remove oferta em uso (grade ou ausências)', () => {
    const plano = planejarDistribuicao({ atuais, professoresAptos: aptos, desejado: new Map([['fis', '']]) });
    expect(plano.erros.fis).toMatch(/não pode ficar sem professor/);
    expect(plano.remover).toEqual([]);
  });
});
