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
