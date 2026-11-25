import { describe, expect, it } from 'vitest';
import { assuntoPpe, PUBLICOS_PPE, situacaoDaPpe, textoPpe, type PpeComunicavel } from './mensagens';

const base: PpeComunicavel = {
  semestre: '2026.2',
  nomeEstudante: 'Estudante Fictício',
  matricula: '20260000',
  disciplina: 'Redes Locais',
  modalidade: 'A_DEFINIR',
  status: 'AGUARDANDO_PROFESSOR',
  notaFinal: null,
  docente: null,
  pei: null,
};
const pei = { cargaHoraria: 12, horasPresenciais: 8, horasPraticas: 4, prorrogadoAte: null, encontros: [{ data: '2026-12-01', conteudo: 'VLANs' }] };

describe('situacaoDaPpe', () => {
  it('aguardando o docente pede a definição', () => {
    expect(situacaoDaPpe(base)).toBe('definir');
  });
  it('modalidade definida sem plano', () => {
    expect(situacaoDaPpe({ ...base, modalidade: 'PEI', status: 'EM_ANDAMENTO' })).toBe('modalidade');
    expect(situacaoDaPpe({ ...base, modalidade: 'DEPENDENCIA', status: 'EM_ANDAMENTO' })).toBe('modalidade');
  });
  it('PEI com encontros está pronto; prorrogado é um momento próprio', () => {
    expect(situacaoDaPpe({ ...base, modalidade: 'PEI', status: 'EM_ANDAMENTO', pei })).toBe('pei');
    expect(situacaoDaPpe({ ...base, modalidade: 'PEI', status: 'PRORROGADO', pei })).toBe('prorrogacao');
    expect(PUBLICOS_PPE.prorrogacao).toEqual(['estudante', 'ctp']);
    expect(situacaoDaPpe({ ...base, modalidade: 'PEI', status: 'EM_ANDAMENTO', pei: { ...pei, encontros: [] } })).toBe('modalidade');
  });
  it('aprovado, reprovado e lançado são resultado', () => {
    for (const status of ['APROVADO', 'REPROVADO', 'LANCADO_ACADEMICO'] as const) {
      expect(situacaoDaPpe({ ...base, modalidade: 'PEI', status })).toBe('resultado');
    }
  });
  it('só o docente recebe o pedido de definição', () => {
    expect(PUBLICOS_PPE.definir).toEqual(['docente']);
    expect(PUBLICOS_PPE.pei).toEqual(['estudante', 'ctp']);
  });
});

describe('textoPpe', () => {
  it('pedido ao docente cita a disciplina sem o nome do estudante', () => {
    const t = textoPpe(base, 'definir', 'docente');
    expect(t).toContain('Redes Locais');
    expect(t).not.toContain('Estudante Fictício');
    expect(assuntoPpe(base, 'definir')).toBe('[SGC-Redes] PPE 2026.2 — Redes Locais: definir a modalidade');
  });

  it('estudante recebe a modalidade sem a própria matrícula; CTP recebe com nome e matrícula', () => {
    const p = { ...base, modalidade: 'DEPENDENCIA' as const, status: 'EM_ANDAMENTO' as const, docente: 'Docente Exemplo' };
    const estudante = textoPpe(p, 'modalidade', 'estudante');
    expect(estudante).toContain('*Dependência presencial*');
    expect(estudante).toContain('Docente responsável: Docente Exemplo.');
    expect(estudante).not.toContain('20260000');
    const ctp = textoPpe(p, 'modalidade', 'ctp');
    expect(ctp).toContain('Estudante Fictício (matrícula 20260000)');
  });

  it('PEI pronto traz carga, prorrogação e o cronograma', () => {
    const p = { ...base, modalidade: 'PEI' as const, status: 'EM_ANDAMENTO' as const, pei: { ...pei, prorrogadoAte: '2027-02-15' } };
    const t = textoPpe(p, 'pei', 'estudante');
    expect(t).toContain('Carga horária: 12h (8h presenciais, 4h práticas).');
    expect(t).toContain('Prazo prorrogado até *15/02/2027*');
    expect(t).toContain('• 01/12/2026 — VLANs');
  });

  it('prorrogação: novo prazo ao estudante e à CTP, com o cronograma', () => {
    const p = { ...base, modalidade: 'PEI' as const, status: 'PRORROGADO' as const, pei: { ...pei, prorrogadoAte: '2027-02-15' } };
    expect(assuntoPpe(p, 'prorrogacao')).toContain('prazo do PEI prorrogado');
    const est = textoPpe(p, 'prorrogacao', 'estudante');
    expect(est).toContain('foi prorrogado até *15/02/2027* (Art. 124).');
    expect(est).toContain('• 01/12/2026 — VLANs');
    expect(est).not.toContain('matrícula');
    const ctp = textoPpe(p, 'prorrogacao', 'ctp');
    expect(ctp).toContain('Estudante Fictício (matrícula 20260000)');
    expect(ctp).toContain('prazo prorrogado até *15/02/2027*');
    expect(textoPpe({ ...p, pei: { ...pei, prorrogadoAte: null } }, 'prorrogacao', 'estudante')).toContain('foi prorrogado (Art. 124).');
  });

  it('resultado com nota em vírgula e sem presumir aprovação depois do lançamento', () => {
    expect(textoPpe({ ...base, status: 'APROVADO', notaFinal: 7.5 }, 'resultado', 'estudante')).toContain('*aprovado(a)*, nota 7,5');
    expect(textoPpe({ ...base, status: 'REPROVADO', notaFinal: 3 }, 'resultado', 'estudante')).toContain('Procure a Coordenação');
    const lancado = textoPpe({ ...base, status: 'LANCADO_ACADEMICO', notaFinal: 8 }, 'resultado', 'estudante');
    expect(lancado).toContain('*concluída*, nota 8');
    expect(lancado).toContain('já está lançado');
  });
});
