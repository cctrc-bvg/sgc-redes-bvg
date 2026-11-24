import { describe, expect, it } from 'vitest';
import { contarPor, linhasDoRelatorio, NIVEIS_SLA, nomeMes, resumoMensalAusencias, totalizar } from './agregacoes';

describe('resumo mensal de ausências', () => {
  const lista = [
    { mes: '2026-11', status: 'COBERTA_POR_SUBSTITUICAO' as const, coberturas: ['SUBSTITUICAO', 'SUBSTITUICAO'] as const, blocos: 2 },
    { mes: '2026-11', status: 'TURMA_DISPENSADA' as const, coberturas: ['ADIANTAMENTO', 'DISPENSA'] as const, blocos: 3 },
    { mes: '2026-10', status: 'PENDENTE_DECISAO' as const, coberturas: [] as const, blocos: 1 },
  ];

  it('agrupa por mês, soma aulas e calcula a cobertura', () => {
    const r = resumoMensalAusencias(lista);
    expect(r.map((l) => l.mes)).toEqual(['2026-10', '2026-11']);
    expect(r[1]).toMatchObject({ ausencias: 2, aulasPerdidas: 5, substituidas: 2, adiantadas: 1, dispensadas: 1, pendentes: 1, cobertura: 60 });
    expect(r[0]).toMatchObject({ pendentes: 1, cobertura: 0 });
  });

  it('total geral', () => {
    expect(totalizar(resumoMensalAusencias(lista))).toMatchObject({ mes: 'Total', ausencias: 3, aulasPerdidas: 6, cobertura: 50 });
    expect(totalizar([])).toMatchObject({ aulasPerdidas: 0, cobertura: 0 });
  });
});

describe('utilidades', () => {
  it('conta na ordem dada, com zeros', () => {
    expect(contarPor(['A', 'C', 'A'], ['A', 'B', 'C'])).toEqual([
      { chave: 'A', total: 2 },
      { chave: 'B', total: 0 },
      { chave: 'C', total: 1 },
    ]);
  });

  it('nome do mês', () => {
    expect(nomeMes('2026-11')).toBe('nov/2026');
    expect(nomeMes('2027-01')).toBe('jan/2027');
  });
});

describe('linhasDoRelatorio (planilha)', () => {
  it('formato longo: meses, total e demais seções', () => {
    const linhas = linhasDoRelatorio({
      ano: 2026,
      linhas: [{ mes: '2026-03', ausencias: 2, aulasPerdidas: 4, substituidas: 2, adiantadas: 1, dispensadas: 0, pendentes: 1, cobertura: 75 }],
      total: { mes: 'total', ausencias: 2, aulasPerdidas: 4, substituidas: 2, adiantadas: 1, dispensadas: 0, pendentes: 1, cobertura: 75 },
      alertas: 3,
      sla: NIVEIS_SLA.map((n) => ({ ...n, total: 1 })),
      ppes: 0,
      ppePorStatus: [],
      retidos: 0,
      ppis: 1,
      ppiPorStatus: [{ rotulo: 'Deferida', total: 1 }],
      ppiConcluidas: 1,
    });
    expect(linhas[0]).toEqual(['Ausências docentes', 'mar/2026', 'Ausências', '2']);
    expect(linhas).toContainEqual(['Ausências docentes', 'Total 2026', 'Cobertura (%)', '75']);
    expect(linhas).toContainEqual(['Alimentação', '2026', 'Emergências (< 4h)', '1']);
    expect(linhas.at(-1)).toEqual(['PPI', 'Todas', 'Com 40h ou mais validadas', '1']);
  });
});
