import { describe, expect, it } from 'vitest';
import { criarAtividadeSchema, distribuirHoras, formatarHoras, SolicitacaoSchema, totaisPorGrupo } from './regras';

// Visitas técnicas: 8h por visita, até 4 visitas, teto 8h. Monitoria: 6h, 1, teto 6.
const regras = new Map([
  ['visita', { id: 'visita', horasPorUnidade: 8, qtdMaxima: 4, pontuacaoMaxima: 8 }],
  ['grupo', { id: 'grupo', horasPorUnidade: 2, qtdMaxima: 6, pontuacaoMaxima: 8 }],
]);
const a = (id: string, regraId: string, quantidadeInformada: number, dataRealizacao: string, aprovada = true) => ({ id, regraId, quantidadeInformada, dataRealizacao, aprovada });

describe('distribuirHoras (tetos acumulados por categoria)', () => {
  it('a primeira atividade usa o teto; as seguintes recebem só o que sobra', () => {
    const h = distribuirHoras([a('v2', 'visita', 1, '2026-05-01'), a('v1', 'visita', 1, '2026-03-01')], regras);
    expect(h.get('v1')).toBe(8);
    expect(h.get('v2')).toBe(0);
  });

  it('quantidade máxima também é acumulada', () => {
    // Grupo de estudo: 2h/semestre, até 6 semestres, teto 8h → 4 semestres já batem o teto.
    const h = distribuirHoras([a('g1', 'grupo', 3, '2026-01-01'), a('g2', 'grupo', 3, '2026-07-01')], regras);
    expect(h.get('g1')).toBe(6);
    expect(h.get('g2')).toBe(2);
  });

  it('atividade não aprovada ou de regra desconhecida vale zero e não consome o teto', () => {
    const h = distribuirHoras([a('x', 'visita', 1, '2026-01-01', false), a('y', 'visita', 1, '2026-02-01'), a('z', 'sumiu', 5, '2026-01-01')], regras);
    expect([h.get('x'), h.get('y'), h.get('z')]).toEqual([0, 8, 0]);
  });
});

describe('totais e formulários', () => {
  it('soma por grupo e total', () => {
    const t = totaisPorGrupo([{ regraId: 'visita', horas: 8 }, { regraId: 'grupo', horas: 2.5 }], new Map([['visita', 1], ['grupo', 1]]));
    expect(t.grupos.get(1)).toBe(10.5);
    expect(t.total).toBe(10.5);
    expect(formatarHoras(10.5)).toBe('10,5');
    expect(formatarHoras(8)).toBe('8');
  });

  it('valida solicitação (matrícula numérica)', () => {
    expect(SolicitacaoSchema.safeParse({ nomeEstudante: 'Maria Souza', matricula: '20261234567', turmaAtual: 'REDES-3' }).success).toBe(true);
    expect(SolicitacaoSchema.safeParse({ nomeEstudante: 'Maria Souza', matricula: '2026-12', turmaAtual: 'REDES-3' }).success).toBe(false);
  });

  it('valida atividade: data não futura, quantidade com vírgula, certificado em maiúsculas', () => {
    const S = criarAtividadeSchema('2026-11-24');
    const ok = S.parse({ regraId: 'visita', descricaoComprovante: 'Visita à operadora', codigoCertificado: 'cert-01', dataRealizacao: '2026-11-20', quantidadeInformada: '1,5' });
    expect(ok).toMatchObject({ codigoCertificado: 'CERT-01', quantidadeInformada: 1.5 });
    const erro = (campo: string, valor: string) =>
      S.safeParse({ regraId: 'visita', descricaoComprovante: 'Visita', codigoCertificado: 'C1X', dataRealizacao: '2026-11-20', quantidadeInformada: '1', [campo]: valor }).error?.issues.find((i) => i.path[0] === campo)?.message;
    expect(erro('dataRealizacao', '2026-11-25')).toMatch(/futura/);
    expect(erro('quantidadeInformada', '0')).toMatch(/maior que zero/);
    expect(erro('quantidadeInformada', 'dois')).toMatch(/quantidade/);
  });
});
