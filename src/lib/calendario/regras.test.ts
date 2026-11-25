import { describe, expect, it } from 'vitest';
import { avisosAvaliacoesFinais, contarDiasLetivos, dentro, EventoSchema, situacaoDasAulas, intervaloDoAno, porMes, semanasDoMes, suspensaoNaData, validarSequencia } from './regras';

const ev = (inicio: string, fim: string, suspendeAulas = true, imprevisto = false) => ({ inicio, fim, suspendeAulas, imprevisto });

describe('contagem de dias letivos', () => {
  it('conta segunda a sexta e sábados letivos, descontando feriados e suspensões', () => {
    // 2/3/2026 é segunda-feira; semana de 2 a 8 de março.
    const c = contarDiasLetivos({
      inicio: '2026-03-02',
      fim: '2026-03-08',
      eventos: [ev('2026-03-04', '2026-03-04'), ev('2026-03-06', '2026-03-06', true, true), ev('2026-03-05', '2026-03-05', false)],
      sabadosLetivos: new Set(['2026-03-07']),
    });
    expect(c.letivos).toEqual(['2026-03-02', '2026-03-03', '2026-03-05', '2026-03-07']);
    expect(c.sabados).toEqual(['2026-03-07']);
    expect(c.perdidosImprevistos).toEqual(['2026-03-06']);
  });

  it('sábado letivo dentro de suspensão não conta; evento fora do intervalo é ignorado', () => {
    const c = contarDiasLetivos({
      inicio: '2026-03-06',
      fim: '2026-03-07',
      eventos: [ev('2026-03-07', '2026-03-20'), ev('2026-01-01', '2026-01-31')],
      sabadosLetivos: new Set(['2026-03-07']),
    });
    expect(c.letivos).toEqual(['2026-03-06']);
  });

  it('recesso entre etapas não conta como dia letivo', () => {
    // 2 a 13/3/2026: etapas de 2 a 4 e de 10 a 13 (recesso de 5 a 9).
    const c = contarDiasLetivos({
      inicio: '2026-03-02',
      fim: '2026-03-13',
      eventos: [],
      sabadosLetivos: new Set(['2026-03-07']),
      periodos: [
        { inicio: '2026-03-02', fim: '2026-03-04' },
        { inicio: '2026-03-10', fim: '2026-03-13' },
      ],
    });
    expect(c.letivos).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13']);
  });

  it('dia com evento previsto e imprevisto não conta como perda a repor', () => {
    const c = contarDiasLetivos({ inicio: '2026-03-02', fim: '2026-03-02', eventos: [ev('2026-03-02', '2026-03-02'), ev('2026-03-02', '2026-03-02', true, true)], sabadosLetivos: new Set() });
    expect(c.perdidosImprevistos).toEqual([]);
  });

  it('agrupa por mês e por intervalo', () => {
    const letivos = ['2026-03-30', '2026-03-31', '2026-04-01'];
    expect([...porMes(letivos)]).toEqual([
      ['2026-03', 2],
      ['2026-04', 1],
    ]);
    expect(dentro(letivos, { inicio: '2026-03-31', fim: '2026-04-30' })).toBe(2);
  });
});

describe('cadastro', () => {
  const base = { tipo: 'FERIADO', inicio: '2026-04-21', fim: '', descricao: 'Tiradentes', suspendeAulas: true, imprevisto: false, motivo: '' };
  it('evento de um dia usa o início como término', () => {
    const r = EventoSchema.safeParse(base);
    expect(r.success && r.data.fim).toBe('2026-04-21');
  });
  it('recusa término antes do início, suspensão sem motivo e "Outro" sem descrição', () => {
    expect(EventoSchema.safeParse({ ...base, fim: '2026-04-20' }).success).toBe(false);
    expect(EventoSchema.safeParse({ ...base, tipo: 'SUSPENSAO_AULAS', motivo: '' }).success).toBe(false);
    expect(EventoSchema.safeParse({ ...base, tipo: 'SUSPENSAO_AULAS', motivo: 'Falta de energia' }).success).toBe(true);
    expect(EventoSchema.safeParse({ ...base, tipo: 'OUTRO', descricao: '' }).success).toBe(false);
  });
  it('etapas em sequência, sem sobreposição', () => {
    const r = ['N1', 'N2'];
    expect(validarSequencia(r, [{ inicio: '2026-02-02', fim: '2026-04-17' }, { inicio: '2026-04-17', fim: '2026-06-30' }])).toEqual({ 1: 'Começa antes do fim de N1.' });
    expect(validarSequencia(r, [{ inicio: '2026-02-02', fim: '2026-04-17' }, null])).toEqual({});
  });
  it('intervalo do ano pelas etapas ou pelos semestres', () => {
    expect(intervaloDoAno([null, { inicio: '2026-04-20', fim: '2026-06-30' }, { inicio: '2026-08-03', fim: '2026-12-18' }], [])).toEqual({ inicio: '2026-04-20', fim: '2026-12-18' });
    expect(intervaloDoAno([], [{ inicio: '2026-02-02', fim: '2026-07-10' }])).toEqual({ inicio: '2026-02-02', fim: '2026-07-10' });
    expect(intervaloDoAno([], [])).toBeNull();
  });
});

describe('visualização', () => {
  it('semanas do mês começam no domingo', () => {
    const s = semanasDoMes(2026, 11); // 1/11/2026 é domingo
    expect(s[0][0]).toBe('2026-11-01');
    expect(s.at(-1)!.filter(Boolean).at(-1)).toBe('2026-11-30');
    expect(semanasDoMes(2026, 3)[0].slice(0, 1)).toEqual(['2026-03-01']);
  });
  it('suspensão que cobre a data', () => {
    const e = [ev('2026-03-02', '2026-03-04', false), ev('2026-03-03', '2026-03-03')];
    expect(suspensaoNaData('2026-03-03', e)).toBe(e[1]);
    expect(suspensaoNaData('2026-03-02', e)).toBeNull();
  });
});

describe('avaliações finais (ROD, Arts. 32 e 105)', () => {
  const ev = { tipo: 'AVALIACOES_FINAIS' as const, inicio: '2026-12-17', fim: '2026-12-22', descricao: '', suspendeAulas: false, imprevisto: false, motivo: '' };

  it('nunca contam como dias letivos, mesmo se o evento vier marcado com aula', () => {
    const r = EventoSchema.safeParse(ev);
    expect(r.success && r.data.suspendeAulas).toBe(true);
    expect(situacaoDasAulas({ tipo: 'AVALIACOES_FINAIS', suspendeAulas: true })).toBe('Não letivo (avaliações)');
    expect(situacaoDasAulas({ tipo: 'FERIADO', suspendeAulas: true })).toBe('Sem aula');
  });

  it('dentro do ano letivo, saem da contagem, inclusive num sábado letivo', () => {
    const c = contarDiasLetivos({
      inicio: '2026-12-14',
      fim: '2026-12-22',
      eventos: [{ inicio: ev.inicio, fim: ev.fim, suspendeAulas: true, imprevisto: false }],
      sabadosLetivos: new Set(['2026-12-19']),
    });
    expect(c.letivos).toEqual(['2026-12-14', '2026-12-15', '2026-12-16']);
  });

  it('avisa quando há dia letivo depois delas (ex.: cadastradas no meio do ano)', () => {
    expect(avisosAvaliacoesFinais([ev], ['2026-12-15', '2026-12-16'])).toEqual([]);
    const meio = avisosAvaliacoesFinais([{ ...ev, inicio: '2026-07-01', fim: '2026-07-03' }], ['2026-07-06', '2026-12-16']);
    expect(meio).toHaveLength(1);
    expect(meio[0]).toContain('último dia letivo: 16/12/2026');
  });
});
