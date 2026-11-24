import { describe, expect, it } from 'vitest';
import { filtroSigilo, ProcessoSchema, situacaoPrazo, vizinhas } from './regras';

const base = { titulo: 'Aproveitamento de Matemática', tipo: 'APROVEITAMENTO_DISCIPLINA', coluna: 'NOVO', numeroSei: '', prazo: '', descricao: '' };
const erro = (dados: object, campo: string) => ProcessoSchema.safeParse(dados).error?.issues.find((i) => i.path[0] === campo)?.message;

describe('ProcessoSchema', () => {
  it('aceita o mínimo e trata vazios como ausentes', () => {
    expect(ProcessoSchema.parse(base)).toEqual({ titulo: 'Aproveitamento de Matemática', tipo: 'APROVEITAMENTO_DISCIPLINA', coluna: 'NOVO', sigiloso: false });
  });

  it('valida número SEI, prazo, etiqueta e etapa', () => {
    expect(ProcessoSchema.parse({ ...base, numeroSei: '23255.000123/2026-45', prazo: '2026-12-01', sigiloso: 'on' })).toMatchObject({
      numeroSei: '23255.000123/2026-45',
      prazo: '2026-12-01',
      sigiloso: true,
    });
    expect(erro({ ...base, numeroSei: '123/2026' }, 'numeroSei')).toMatch(/formato do SEI/);
    expect(erro({ ...base, prazo: '2026-02-30' }, 'prazo')).toMatch(/data válida/);
    expect(erro({ ...base, tipo: 'X' }, 'tipo')).toMatch(/etiqueta/);
    expect(erro({ ...base, coluna: 'ARQUIVADO' }, 'coluna')).toMatch(/etapa/);
    expect(erro({ ...base, titulo: 'ab' }, 'titulo')).toMatch(/título curto/);
  });
});

describe('situacaoPrazo', () => {
  it('classifica pelo dia de hoje', () => {
    expect(situacaoPrazo(null, '2026-11-24', 'NOVO')).toBe('sem-prazo');
    expect(situacaoPrazo('2026-11-23', '2026-11-24', 'NOVO')).toBe('vencido');
    expect(situacaoPrazo('2026-11-24', '2026-11-24', 'COM_PROFESSOR')).toBe('hoje');
    expect(situacaoPrazo('2026-11-27', '2026-11-24', 'NOVO')).toBe('proximo');
    expect(situacaoPrazo('2026-11-28', '2026-11-24', 'NOVO')).toBe('ok');
    expect(situacaoPrazo('2026-11-01', '2026-11-24', 'CONCLUIDO')).toBe('concluido');
  });
});

describe('movimento e sigilo', () => {
  it('etapas vizinhas', () => {
    expect(vizinhas('NOVO')).toEqual({ anterior: null, proxima: 'COM_PROFESSOR' });
    expect(vizinhas('CONCLUIDO')).toEqual({ anterior: 'AGUARDANDO_RETORNO', proxima: null });
  });

  it('sem permissão, só itens não sigilosos', () => {
    expect(filtroSigilo(false)).toEqual({ sigiloso: false });
    expect(filtroSigilo(true)).toEqual({});
  });
});
