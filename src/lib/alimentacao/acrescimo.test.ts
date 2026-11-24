import { describe, expect, it } from 'vitest';
import { AcrescimoSchema, planejarAcrescimo } from './acrescimo';

const base = { turmaId: 't1', data: '2026-11-30', refeicoes: ['ALMOCO'], quantidade: '6', descricao: 'Encontro de PEI de Matemática' };
const erro = (dados: object, campo: string) => AcrescimoSchema.safeParse(dados).error?.issues.find((i) => i.path[0] === campo)?.message;

describe('AcrescimoSchema (G05)', () => {
  it('aceita dados válidos', () => {
    expect(AcrescimoSchema.parse(base)).toEqual({ ...base, quantidade: 6 });
  });

  it('valida refeições, quantidade, data e descrição', () => {
    expect(erro({ ...base, refeicoes: [] }, 'refeicoes')).toMatch(/pelo menos uma/);
    expect(erro({ ...base, refeicoes: ['JANTAR'] }, 'refeicoes')).toBeDefined();
    expect(erro({ ...base, quantidade: '0' }, 'quantidade')).toMatch(/pelo menos 1/);
    expect(erro({ ...base, quantidade: '81' }, 'quantidade')).toMatch(/no máximo 80/);
    expect(erro({ ...base, data: '2026-13-01' }, 'data')).toMatch(/data válida/);
    expect(erro({ ...base, descricao: 'ab' }, 'descricao')).toMatch(/Descreva/);
  });
});

describe('planejarAcrescimo', () => {
  it('classifica a urgência de cada refeição e aponta as que já passaram', () => {
    const agora = new Date('2026-11-30T10:00:00-03:00');
    const { itens, passadas } = planejarAcrescimo({ data: '2026-11-30', refeicoes: ['LANCHE_MANHA', 'ALMOCO'] }, agora);
    expect(passadas).toEqual(['LANCHE_MANHA']);
    expect(itens[1]).toMatchObject({ tipo: 'ALMOCO', antecedenciaMin: 120, nivel: 'VERMELHO_MENOS_4H' });
    expect(planejarAcrescimo({ data: '2026-12-02', refeicoes: ['LANCHE_TARDE'] }, agora).itens[0].nivel).toBe('VERDE_24H_MAIS');
  });
});
