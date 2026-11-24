import { describe, expect, it } from 'vitest';
import {
  SabadoLetivoSchema,
  aulasSemanaisPrevistas,
  chaveCelula,
  diaDaGradeNaData,
  janelasLivres,
  lerSemestreLetivo,
  ofertaValeNoSemestre,
  planejarGrade,
  semestreLetivoAtual,
} from './regras';

describe('período', () => {
  it('semestre pelo mês em Fortaleza', () => {
    expect(semestreLetivoAtual(new Date('2026-03-10T12:00:00Z'))).toBe(1);
    expect(semestreLetivoAtual(new Date('2026-06-30T12:00:00Z'))).toBe(1);
    expect(semestreLetivoAtual(new Date('2026-07-01T12:00:00Z'))).toBe(2);
    // 01/07 01:00 UTC ainda é 30/06 em Fortaleza.
    expect(semestreLetivoAtual(new Date('2026-07-01T01:00:00Z'))).toBe(1);
  });

  it('lê o semestre da URL', () => {
    expect([lerSemestreLetivo('1'), lerSemestreLetivo('2'), lerSemestreLetivo('3'), lerSemestreLetivo(undefined)]).toEqual([1, 2, null, null]);
  });

  it('anuais valem nos dois semestres; técnicas só no seu', () => {
    expect([ofertaValeNoSemestre(null, 1), ofertaValeNoSemestre(null, 2)]).toEqual([true, true]);
    expect([ofertaValeNoSemestre(1, 1), ofertaValeNoSemestre(1, 2)]).toEqual([true, false]);
  });

  it.each([
    [80, 2, 4], // técnica semestral de 80h → 4 aulas/semana (grade 2026: Comunicação de Dados)
    [40, 1, 2],
    [80, null, 2], // anual de 80h → 2 aulas/semana
    [40, null, 1],
  ])('%ih (semestre %s) → %i aulas por semana', (ch, sem, aulas) => {
    expect(aulasSemanaisPrevistas(ch, sem)).toBe(aulas);
  });
});

describe('planejarGrade', () => {
  const seg1 = chaveCelula(1, 'b1');
  const seg2 = chaveCelula(1, 'b2');
  const ter1 = chaveCelula(2, 'b1');
  const ofertas = new Map([
    ['of-bio', { professorId: 'ana' }],
    ['of-cd', { professorId: 'caio' }],
  ]);

  it('grava, troca e remove células', () => {
    const plano = planejarGrade({
      atuais: new Map([
        [seg1, 'of-bio'],
        [seg2, 'of-bio'],
      ]),
      desejado: new Map([
        [seg1, 'of-bio'], // igual
        [seg2, 'of-cd'], // troca
        [ter1, ''], // continua vago
      ]),
      ofertas,
      ocupacao: new Map(),
    });
    expect(plano).toEqual({ gravar: [{ chave: seg2, ofertaId: 'of-cd' }], remover: [], erros: {} });
  });

  it('remove célula que fica vaga, inclusive órfã de oferta excluída', () => {
    const plano = planejarGrade({ atuais: new Map([[seg1, null]]), desejado: new Map([[seg1, '']]), ofertas, ocupacao: new Map() });
    expect(plano.remover).toEqual([seg1]);
  });

  it('recusa oferta de outra turma ou de outro semestre (id fora da lista)', () => {
    const plano = planejarGrade({ atuais: new Map(), desejado: new Map([[seg1, 'of-outra']]), ofertas, ocupacao: new Map() });
    expect(plano.erros[seg1]).toMatch(/inválida/);
  });

  it('recusa choque de horário do professor com outra turma', () => {
    const plano = planejarGrade({
      atuais: new Map(),
      desejado: new Map([
        [seg1, 'of-cd'],
        [ter1, 'of-cd'],
      ]),
      ofertas,
      ocupacao: new Map([[`caio|${seg1}`, 'Redes 2º Ano']]),
    });
    expect(plano.erros[seg1]).toBe('Choque de horário: o professor já tem aula na turma Redes 2º Ano neste horário.');
    expect(plano.gravar).toEqual([{ chave: ter1, ofertaId: 'of-cd' }]);
  });
});

describe('janelasLivres (RF01)', () => {
  const blocos = [
    { id: 'm1', turno: 'MANHA' },
    { id: 'm2', turno: 'MANHA' },
    { id: 't1', turno: 'TARDE' },
    { id: 't2', turno: 'TARDE' },
  ];

  it('bloco vago num turno com aula é janela; turno sem aula não é', () => {
    const janelas = janelasLivres(new Set([chaveCelula(1, 'm1')]), blocos);
    expect([...janelas]).toEqual([chaveCelula(1, 'm2')]);
  });

  it('sem aulas não há janelas', () => {
    expect(janelasLivres(new Set(), blocos).size).toBe(0);
  });
});

describe('diaDaGradeNaData (G14)', () => {
  const sabados = new Map([['2026-11-28', 2]]); // sábado com a grade de terça

  it('dias úteis usam a própria grade', () => {
    expect(diaDaGradeNaData('2026-11-23', sabados)).toBe(1); // segunda
    expect(diaDaGradeNaData('2026-11-27', sabados)).toBe(5); // sexta
  });

  it('sábado letivo usa a grade do dia de referência', () => {
    expect(diaDaGradeNaData('2026-11-28', sabados)).toBe(2);
  });

  it('sábado comum e domingo não têm aula', () => {
    expect(diaDaGradeNaData('2026-12-05', sabados)).toBeNull();
    expect(diaDaGradeNaData('2026-11-29', sabados)).toBeNull();
  });

  it('data inválida lança erro', () => {
    expect(() => diaDaGradeNaData('28/11/2026', sabados)).toThrow(RangeError);
  });
});

describe('SabadoLetivoSchema', () => {
  it('aceita sábado com dia de referência', () => {
    expect(SabadoLetivoSchema.parse({ data: '2026-11-28', diaSemanaReferente: '2', observacao: ' ' })).toEqual({
      data: '2026-11-28',
      diaSemanaReferente: 2,
    });
  });

  it.each(['2026-11-27', '2026-02-30', '28/11/2026', ''])('recusa data que não é sábado válido: "%s"', (data) => {
    expect(SabadoLetivoSchema.safeParse({ data, diaSemanaReferente: '2' }).success).toBe(false);
  });

  it('exige dia de referência de segunda a sexta', () => {
    const r = SabadoLetivoSchema.safeParse({ data: '2026-11-28', diaSemanaReferente: '6' });
    expect(r.error?.issues[0].message).toMatch(/dia da semana/);
  });
});
