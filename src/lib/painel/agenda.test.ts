import { describe, expect, it } from 'vitest';
import { inicioDaSemana, montarSemana, periodoCurto, proximosEventos, tituloDoEvento, type CelulaAgenda, type EventoAgenda } from './agenda';

const bloco = (turno: 'MANHA' | 'TARDE', ordem: number, horaInicio: string, horaFim: string) => ({ id: `${turno}${ordem}`, turno, ordem, horaInicio, horaFim });
const M1 = bloco('MANHA', 1, '07:30', '08:30');
const T2 = bloco('TARDE', 2, '14:00', '15:00');

describe('inicioDaSemana', () => {
  it('segunda da semana atual nos dias úteis; a próxima no fim de semana', () => {
    expect(inicioDaSemana('2026-11-25')).toBe('2026-11-23'); // quarta
    expect(inicioDaSemana('2026-11-23')).toBe('2026-11-23'); // segunda
    expect(inicioDaSemana('2026-11-28')).toBe('2026-11-30'); // sábado
    expect(inicioDaSemana('2026-11-29')).toBe('2026-11-30'); // domingo
  });
});

describe('montarSemana', () => {
  const celulas: CelulaAgenda[] = [
    { diaSemana: 3, bloco: T2, turma: 'Redes 2', disciplina: 'Filosofia II' },
    { diaSemana: 3, bloco: M1, turma: 'Redes 1', disciplina: 'Matemática I' },
    { diaSemana: 2, bloco: M1, turma: 'Redes 3', disciplina: 'Geografia III' },
  ];
  const base = {
    hojeISO: '2026-11-25',
    sabados: new Map<string, number>(),
    eventos: [] as EventoAgenda[],
    celulas: new Map([['2026.2', celulas]]),
    ausencias: new Map<string, Set<string>>(),
    mudancas: [],
  };

  it('segunda a sexta, aulas em ordem do dia e hoje marcado', () => {
    const s = montarSemana(base);
    expect(s.map((d) => d.dataISO)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
    const quarta = s[2];
    expect(quarta).toMatchObject({ rotulo: 'Quarta, 25/11', ehHoje: true, semAula: null });
    expect(quarta.aulas.map((a) => a.turma)).toEqual(['Redes 1', 'Redes 2']);
    expect(s[1].aulas[0]).toMatchObject({ horario: 'Manhã A (07:30–08:30)', inicio: '07:30' });
  });

  it('feriado tira as aulas e diz o motivo; outros eventos aparecem', () => {
    const s = montarSemana({
      ...base,
      eventos: [
        { inicio: '2026-11-25', fim: '2026-11-25', titulo: 'Feriado: Exemplo', suspende: true },
        { inicio: '2026-11-24', fim: '2026-11-26', titulo: 'Reunião: pais', suspende: false },
      ],
    });
    expect(s[2]).toMatchObject({ semAula: 'Feriado: Exemplo', aulas: [], eventos: ['Reunião: pais'] });
    expect(s[1].eventos).toEqual(['Reunião: pais']);
  });

  it('sábado letivo entra com a grade do dia de referência; ausência registrada é marcada', () => {
    const s = montarSemana({ ...base, sabados: new Map([['2026-11-28', 3]]), ausencias: new Map([['2026-11-25', new Set(['M1'])]]) });
    const sabado = s[5];
    expect(sabado).toMatchObject({ dataISO: '2026-11-28', gradeDe: 'quarta-feira' });
    expect(sabado.aulas).toHaveLength(2);
    expect(s[2].aulas.map((a) => a.ausente)).toEqual([true, false]);
  });

  it('mudança num sábado comum faz o sábado aparecer', () => {
    const s = montarSemana({ ...base, mudancas: [{ dataISO: '2026-11-28', turma: 'Redes 1', bloco: 'Manhã A', tipo: 'substituicao', detalhe: '' }] });
    expect(s[5]).toMatchObject({ dataISO: '2026-11-28', semAula: 'Sem aula', mudancas: [{ tipo: 'substituicao' }] });
  });
});

describe('tituloDoEvento', () => {
  it('não repete o tipo quando a descrição já começa por ele', () => {
    expect(tituloDoEvento('Avaliações finais e entrega de diários', 'Avaliações finais e entrega dos diários')).toBe('Avaliações finais e entrega dos diários');
    expect(tituloDoEvento('Feriado', 'Tiradentes')).toBe('Feriado: Tiradentes');
    expect(tituloDoEvento('Reunião', null)).toBe('Reunião');
  });
});

describe('proximosEventos', () => {
  const ev = (inicio: string, fim: string, titulo: string): EventoAgenda => ({ inicio, fim, titulo, suspende: false });
  it('só o que ainda não acabou e começa em até 30 dias, em ordem', () => {
    const r = proximosEventos([ev('2027-01-10', '2027-01-10', 'longe'), ev('2026-12-01', '2026-12-02', 'b'), ev('2026-11-20', '2026-11-26', 'a'), ev('2026-11-01', '2026-11-02', 'passou')], '2026-11-25');
    expect(r.map((e) => e.titulo)).toEqual(['a', 'b']);
    expect(periodoCurto(r[1])).toBe('01/12 a 02/12');
    expect(periodoCurto(ev('2026-12-08', '2026-12-08', 'x'))).toBe('08/12');
  });
});
