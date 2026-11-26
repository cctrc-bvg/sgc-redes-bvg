import { describe, expect, it } from 'vitest';
import { assuntoPpi, ppiDecidida, textoPpi, type PpiComunicavel } from './mensagens';

const base: PpiComunicavel = {
  nomeEstudante: 'Estudante Fictício',
  matricula: '20260000',
  turmaAtual: 'Redes 3º ano',
  status: 'DEFERIDA',
  totalValidado: 42.5,
  metaHoras: 40,
  observacoes: null,
};

describe('mensagens da PPI', () => {
  it('só a decisão pede comunicação', () => {
    expect(ppiDecidida(base)).toBe(true);
    expect(ppiDecidida({ ...base, status: 'INDEFERIDA' })).toBe(true);
    expect(ppiDecidida({ ...base, status: 'EM_ANALISE' })).toBe(false);
  });

  it('deferida: horas com vírgula e ficha para assinatura', () => {
    const t = textoPpi(base, 'estudante');
    expect(t).toContain('*deferida*: 42,5h validadas de 40h');
    expect(t).toContain('ficha está disponível');
    expect(t).not.toContain('20260000');
    expect(assuntoPpi(base)).toBe('[SGC-Redes] PPI — solicitação deferida');
  });

  it('indeferida leva o motivo ao estudante e à CTP', () => {
    const s = { ...base, status: 'INDEFERIDA' as const, totalValidado: 30, observacoes: 'Faltam comprovantes do estágio.' };
    expect(textoPpi(s, 'estudante')).toContain('Motivo: Faltam comprovantes do estágio.');
    const ctp = textoPpi(s, 'ctp');
    expect(ctp).toContain('Estudante Fictício (matrícula 20260000, Redes 3º ano): *indeferida*, 30h validadas de 40h.');
    expect(ctp).toContain('Motivo: Faltam comprovantes do estágio.');
  });
});

describe('resumo da PPI para a CCA', () => {
  it('agrupa por turma sem identificar estudantes e ignora rascunhos', async () => {
    const { resumoPpiPorTurma, textoResumoPpi } = await import('./mensagens');
    const r = resumoPpiPorTurma([
      { turmaAtual: 'REDES-3', status: 'DEFERIDA' },
      { turmaAtual: 'REDES-3', status: 'INDEFERIDA' },
      { turmaAtual: 'REDES-3', status: 'EM_ANALISE' },
      { turmaAtual: 'REDES-2', status: 'DEFERIDA' },
      { turmaAtual: 'REDES-2', status: 'RASCUNHO' },
    ]);
    expect(r).toEqual([
      { turma: 'REDES-2', deferidas: 1, indeferidas: 0, emAnalise: 0 },
      { turma: 'REDES-3', deferidas: 1, indeferidas: 1, emAnalise: 1 },
    ]);
    const t = textoResumoPpi(r, '2026-11-26');
    expect(t).toContain('26/11/2026');
    expect(t).toContain('- REDES-3: 1 deferida(s), 1 indeferida(s), 1 em análise');
  });
});
