import { describe, expect, it } from 'vitest';
import { contarDiasLetivos } from '@/lib/calendario/regras';
import { aulasPresumidas, aulasRestantesNaGrade, deficitProjetado, ministradasEfetivas } from './automatico';

// Semana de 2026-03-02 (segunda) a 2026-03-08. Oferta: 2 aulas na segunda, 1 na quarta.
const celulasPorDia = new Map([[1, 2], [3, 1]]);
const letivosDe = (inicio: string, fim: string, extra: { eventos?: Parameters<typeof contarDiasLetivos>[0]['eventos']; sabados?: string[] } = {}) =>
  contarDiasLetivos({ inicio, fim, eventos: extra.eventos ?? [], sabadosLetivos: new Set(extra.sabados ?? []) }).letivos;

describe('aulas presumidas (RF08-A)', () => {
  it('conta a grade nos dias letivos anteriores a hoje', () => {
    const letivos = letivosDe('2026-03-02', '2026-03-13');
    const base = { celulasPorDia, letivos, sabadosLetivos: new Map<string, number>() };
    expect(aulasPresumidas({ ...base, hojeISO: '2026-03-02' })).toBe(0); // hoje não conta
    expect(aulasPresumidas({ ...base, hojeISO: '2026-03-03' })).toBe(2);
    expect(aulasPresumidas({ ...base, hojeISO: '2026-03-14' })).toBe(6);
  });

  it('suspensão de aulas tira o dia; dispensa sem reposição tira a aula; limita às previstas', () => {
    const eventos = [{ inicio: '2026-03-04', fim: '2026-03-04', suspendeAulas: true, imprevisto: false }];
    const base = { celulasPorDia, letivos: letivosDe('2026-03-02', '2026-03-13', { eventos }), sabadosLetivos: new Map<string, number>(), hojeISO: '2026-03-14' };
    expect(aulasPresumidas(base)).toBe(5);
    expect(aulasPresumidas({ ...base, dispensadas: 2 })).toBe(3);
    expect(aulasPresumidas({ ...base, dispensadas: 99 })).toBe(0);
    expect(aulasPresumidas({ ...base, previstas: 4 })).toBe(4);
  });

  it('sábado letivo usa a grade do dia de referência', () => {
    const sabado = '2026-03-07';
    const base = {
      celulasPorDia,
      letivos: letivosDe('2026-03-02', '2026-03-08', { sabados: [sabado] }),
      sabadosLetivos: new Map([[sabado, 1]]), // vale a grade da segunda
      hojeISO: '2026-03-09',
    };
    expect(aulasPresumidas(base)).toBe(5); // 2 (seg) + 1 (qua) + 2 (sábado como segunda)
  });

  it('restantes e déficit projetado', () => {
    const e = { celulasPorDia, letivos: letivosDe('2026-03-02', '2026-03-13'), sabadosLetivos: new Map<string, number>(), hojeISO: '2026-03-09' };
    expect(aulasRestantesNaGrade(e)).toBe(3);
    expect(deficitProjetado({ ministradas: 3, restantesNaGrade: 3, previstas: 10 })).toBe(4);
    expect(deficitProjetado({ ministradas: 3, restantesNaGrade: 7, previstas: 10 })).toBe(0);
  });

  it('valor efetivo: manual vence o presumido', () => {
    expect(ministradasEfetivas({ ministradasManual: true, aulasMinistradas: 7 }, 12)).toBe(7);
    expect(ministradasEfetivas({ ministradasManual: false, aulasMinistradas: 7 }, 12)).toBe(12);
  });
});

describe('creditosDeSubstituicao', () => {
  it('conta na disciplina registrada; sem registro, só se a oferta do substituto na turma é única', async () => {
    const { creditosDeSubstituicao } = await import('./automatico');
    const ofertas = [
      { id: 'o1', professorId: 'bruno', turmaId: 't1' },
      { id: 'o2', professorId: 'carla', turmaId: 't1' },
      { id: 'o3', professorId: 'carla', turmaId: 't1' },
    ];
    const r = creditosDeSubstituicao(
      [
        { substitutoId: 'bruno', turmaId: 't1', dataISO: '2026-03-02' },
        { substitutoId: 'carla', turmaId: 't1', ofertaId: 'o3', dataISO: '2026-03-03' },
        { substitutoId: 'carla', turmaId: 't1', dataISO: '2026-03-04' }, // duas disciplinas e nada registrado: sem crédito
        { substitutoId: 'bruno', turmaId: 't2', dataISO: '2026-03-05' }, // sem oferta nessa turma
      ],
      ofertas,
    );
    expect(Object.fromEntries(r)).toEqual({ o1: ['2026-03-02'], o3: ['2026-03-03'] });
  });
});

describe('aulasPresumidas a partir de um ponto de partida', () => {
  it('conta só os dias letivos desde a data do lançamento manual', () => {
    const base = { celulasPorDia: new Map([[1, 2]]), letivos: ['2026-03-02', '2026-03-09', '2026-03-16'], sabadosLetivos: new Map<string, number>(), hojeISO: '2026-03-20' };
    expect(aulasPresumidas(base)).toBe(6);
    expect(aulasPresumidas({ ...base, desdeISO: '2026-03-09' })).toBe(4);
  });
});
