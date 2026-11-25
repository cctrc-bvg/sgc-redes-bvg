import { describe, expect, it } from 'vitest';
import {
  datasDoPeriodo,
  DIAS_MAXIMOS_PERIODO,
  lerChaveDoPeriodo,
  agruparAulasEscolhidas,
  blocosOcupadosDepois,
  chaveAula,
  codigoBloco,
  conciliarAlertas,
  criarRegistroAusenciaSchema,
  deveAvisarGestao,
  descreverBloco,
  hojeEmFortaleza,
  impactosFuturos,
  ocupacoesEfetivas,
  periodoDaData,
  planejarCoberturas,
  presencaPorTurno,
  somarDias,
  statusDaAusencia,
  sugerirAdiantamentos,
  sugerirSubstitutos,
  type AulaDia,
  type BlocoDia,
  type ContextoDia,
} from './regras';

const blocos: BlocoDia[] = [
  { id: 'm1', turno: 'MANHA', ordem: 1, horaInicio: '07:30', horaFim: '08:30' },
  { id: 'm2', turno: 'MANHA', ordem: 2, horaInicio: '08:30', horaFim: '09:30' },
  { id: 'm3', turno: 'MANHA', ordem: 3, horaInicio: '09:45', horaFim: '10:45' },
  { id: 'm4', turno: 'MANHA', ordem: 4, horaInicio: '10:45', horaFim: '11:45' },
  { id: 't1', turno: 'TARDE', ordem: 1, horaInicio: '13:00', horaFim: '14:00' },
  { id: 't2', turno: 'TARDE', ordem: 2, horaInicio: '14:00', horaFim: '15:00' },
];

// Turma R1: Ana (m1, m2), Bruno (m3), Carla (t1, t2). Turma R2: Bruno (m1), Davi (m2).
const aula = (turmaId: string, blocoId: string, professorId: string, ofertaId = `${turmaId}-${professorId}`): AulaDia => ({
  turmaId,
  blocoId,
  professorId,
  ofertaId,
});
const aulasDoDia: AulaDia[] = [
  aula('R1', 'm1', 'ana'),
  aula('R1', 'm2', 'ana'),
  aula('R1', 'm3', 'bruno'),
  aula('R1', 't1', 'carla'),
  aula('R1', 't2', 'carla'),
  aula('R2', 'm1', 'bruno'),
  aula('R2', 'm2', 'davi'),
];
const docentes = ['ana', 'bruno', 'carla', 'davi', 'elisa'].map((id) => ({ id, nome: id[0].toUpperCase() + id.slice(1) }));

/** Ana falta em m1 e m2 da R1. */
const contexto = (extra: Partial<ContextoDia> = {}): ContextoDia => ({
  blocos,
  aulasDoDia,
  coberturasOutras: [],
  ausentes: new Set(['ana']),
  blocosPerdidos: new Set(['R1|m1', 'R1|m2']),
  docentes,
  ...extra,
});

describe('utilidades de data e bloco', () => {
  it('códigos e descrição dos blocos', () => {
    expect(codigoBloco(blocos[0])).toBe('M1');
    expect(codigoBloco(blocos[5])).toBe('T2');
    expect(descreverBloco(blocos[2])).toBe('Manhã C (09:45–10:45)');
  });

  it('hoje no fuso de Fortaleza, soma de dias e período letivo', () => {
    expect(hojeEmFortaleza(new Date('2026-11-25T02:00:00Z'))).toBe('2026-11-24'); // 23h em Fortaleza
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(periodoDaData('2026-06-30')).toEqual({ anoLetivo: 2026, semestreLetivo: 1 });
    expect(periodoDaData('2026-07-01')).toEqual({ anoLetivo: 2026, semestreLetivo: 2 });
  });
});

describe('registro da ausência', () => {
  const Schema = criarRegistroAusenciaSchema('2026-11-24');
  const valido = { professorId: 'ana', data: '2026-11-26', motivoOperacional: 'Participação em evento', aulas: ['x'] };

  it('aceita motivo operacional da lista e data na janela', () => {
    expect(Schema.safeParse(valido).success).toBe(true);
    expect(Schema.safeParse({ ...valido, data: '2026-10-25' }).success).toBe(true); // 30 dias atrás
  });

  it('recusa motivo livre (LGPD), data fora da janela ou inválida e nenhuma aula', () => {
    const erro = (dados: object, campo: string) => Schema.safeParse(dados).error?.issues.find((i) => i.path[0] === campo)?.message;
    expect(erro({ ...valido, motivoOperacional: 'Consulta médica' }, 'motivoOperacional')).toMatch(/motivo operacional/);
    expect(erro({ ...valido, data: '2026-10-24' }, 'data')).toMatch(/entre 25\/10\/2026 e/);
    expect(erro({ ...valido, data: '2026-02-30' }, 'data')).toMatch(/data válida/);
    expect(erro({ ...valido, aulas: [] }, 'aulas')).toMatch(/pelo menos uma aula/);
  });

  it('agrupa as aulas escolhidas por oferta, em ordem, ignorando chaves estranhas', () => {
    const daAna = [aula('R1', 'm2', 'ana'), aula('R1', 'm1', 'ana'), aula('R2', 't1', 'ana', 'R2-ana')];
    const grupos = agruparAulasEscolhidas(daAna, [chaveAula(daAna[0]), chaveAula(daAna[1]), 'forjada|m3'], blocos);
    expect(grupos).toEqual([{ ofertaId: 'R1-ana', turmaId: 'R1', blocoIds: ['m1', 'm2'] }]);
  });
});

describe('sugestões de cobertura (RF02, G03)', () => {
  it('substitutos: livres no bloco, quem leciona na turma primeiro, sem o ausente', () => {
    // Em m1: Bruno dá aula na R2; livres: Carla (da R1), Davi e Elisa.
    expect(sugerirSubstitutos(contexto(), 'R1', 'm1').map((s) => [s.id, s.daTurma])).toEqual([
      ['carla', true],
      ['davi', false],
      ['elisa', false],
    ]);
  });

  it('substituto já escalado em outra ausência no mesmo bloco não aparece', () => {
    const ctx = contexto({ coberturasOutras: [{ ausenciaId: 'outra', turmaId: 'R3', blocoId: 'm1', tipo: 'SUBSTITUICAO', substitutoId: 'elisa' }] });
    expect(sugerirSubstitutos(ctx, 'R1', 'm1').map((s) => s.id)).not.toContain('elisa');
  });

  it('adiantamentos: aulas posteriores da turma, de professor livre no bloco vago', () => {
    // m1: Bruno (m3) está ocupado na R2 em m1 → não; Carla (t1, t2) está livre → sim.
    expect(sugerirAdiantamentos(contexto(), 'R1', 'm1')).toEqual([
      { blocoOrigemId: 't1', ofertaId: 'R1-carla', professorId: 'carla' },
      { blocoOrigemId: 't2', ofertaId: 'R1-carla', professorId: 'carla' },
    ]);
    // m2: Bruno está livre → m3 entra; blocos perdidos (m1/m2) nunca são origem.
    expect(sugerirAdiantamentos(contexto(), 'R1', 'm2').map((s) => s.blocoOrigemId)).toEqual(['m3', 't1', 't2']);
  });

  it('aula já adiantada em outra ausência some das origens e libera o professor', () => {
    const ctx = contexto({
      coberturasOutras: [{ ausenciaId: 'x', turmaId: 'R2', blocoId: 'm1', tipo: 'ADIANTAMENTO', blocoOrigemId: 'm2', professorOrigemId: 'davi' }],
    });
    const efetivas = ocupacoesEfetivas(ctx.aulasDoDia, ctx.coberturasOutras);
    expect(efetivas.filter((o) => o.professorId === 'davi').map((o) => o.blocoId)).toEqual(['m1']);
    // Davi agora está ocupado em m1 e livre em m2.
    expect(sugerirSubstitutos(ctx, 'R1', 'm1').map((s) => s.id)).not.toContain('davi');
    expect(sugerirSubstitutos(ctx, 'R1', 'm2').map((s) => s.id)).toContain('davi');
  });
});

describe('planejarCoberturas', () => {
  it('aceita escolhas válidas e deixa vazio como pendente', () => {
    const { coberturas, erros } = planejarCoberturas(contexto(), 'R1', ['m1', 'm2'], { m1: 'sub:carla', m2: '' });
    expect(erros).toEqual({});
    expect(coberturas).toEqual([{ blocoId: 'm1', tipo: 'SUBSTITUICAO', substitutoId: 'carla', blocoOrigemId: null, professorOrigemId: null }]);
  });

  it('adiantamento guarda a origem e o professor da aula movida', () => {
    const { coberturas } = planejarCoberturas(contexto(), 'R1', ['m1', 'm2'], { m1: 'adi:t1', m2: 'dispensa' });
    expect(coberturas).toEqual([
      { blocoId: 'm1', tipo: 'ADIANTAMENTO', substitutoId: null, blocoOrigemId: 't1', professorOrigemId: 'carla' },
      { blocoId: 'm2', tipo: 'DISPENSA', substitutoId: null, blocoOrigemId: null, professorOrigemId: null },
    ]);
  });

  it('recusa substituto ocupado, origem inválida, origem repetida e valor forjado', () => {
    const { erros } = planejarCoberturas(contexto(), 'R1', ['m1', 'm2'], { m1: 'sub:bruno', m2: 'adi:m1' });
    expect(erros.m1).toMatch(/não está mais livre/);
    expect(erros.m2).toMatch(/não pode mais ser adiantada/);
    expect(planejarCoberturas(contexto(), 'R1', ['m1', 'm2'], { m1: 'adi:t1', m2: 'adi:t1' }).erros.m2).toMatch(/dois horários/);
    expect(planejarCoberturas(contexto(), 'R1', ['m1'], { m1: 'qualquer' }).erros.m1).toMatch(/inválida/);
  });
});

describe('status da ausência', () => {
  it('pendente até decidir todos os blocos; dispensa domina; depois adiantamento', () => {
    expect(statusDaAusencia(2, [{ tipo: 'SUBSTITUICAO' }], false)).toBe('PENDENTE_DECISAO');
    expect(statusDaAusencia(2, [{ tipo: 'SUBSTITUICAO' }, { tipo: 'SUBSTITUICAO' }], false)).toBe('COBERTA_POR_SUBSTITUICAO');
    expect(statusDaAusencia(2, [{ tipo: 'SUBSTITUICAO' }, { tipo: 'ADIANTAMENTO' }], false)).toBe('AULA_ADIANTADA');
    expect(statusDaAusencia(2, [{ tipo: 'ADIANTAMENTO' }, { tipo: 'DISPENSA' }], false)).toBe('TURMA_DISPENSADA');
    expect(statusDaAusencia(1, [{ tipo: 'DISPENSA' }], true)).toBe('REPOSICAO_AGENDADA');
  });
});

describe('impacto nas refeições', () => {
  const daGrade = ['m1', 'm2', 'm3', 't1', 't2'];

  it('dispensa e adiantamento esvaziam blocos; pendente continua ocupado', () => {
    const depois = blocosOcupadosDepois(daGrade, [
      { tipo: 'ADIANTAMENTO', blocoId: 'm1', blocoOrigemId: 't1' },
      { tipo: 'DISPENSA', blocoId: 'm2', blocoOrigemId: null },
    ]);
    expect([...depois].sort()).toEqual(['m1', 'm3', 't2']);
    expect(presencaPorTurno(depois, blocos)).toEqual({ temAulaManha: true, temAulaTarde: true });
  });

  it('adiantar toda a tarde para a manhã cancela almoço e lanche da tarde', () => {
    const depois = blocosOcupadosDepois(daGrade, [
      { tipo: 'ADIANTAMENTO', blocoId: 'm1', blocoOrigemId: 't1' },
      { tipo: 'ADIANTAMENTO', blocoId: 'm2', blocoOrigemId: 't2' },
    ]);
    const impactos = impactosFuturos('2026-11-26', presencaPorTurno(daGrade, blocos), presencaPorTurno(depois, blocos), new Date('2026-11-24T12:00:00-03:00'));
    expect(impactos.map((i) => [i.tipoRefeicao, i.acao, i.nivelSla])).toEqual([
      ['ALMOCO', 'CANCELAR', 'VERDE_24H_MAIS'],
      ['LANCHE_TARDE', 'CANCELAR', 'VERDE_24H_MAIS'],
    ]);
  });

  it('G02: perder só a última aula antes do intervalo mantém o lanche do turno', () => {
    const depois = blocosOcupadosDepois(['m1', 'm2'], [{ tipo: 'DISPENSA', blocoId: 'm2', blocoOrigemId: null }]);
    expect(impactosFuturos('2026-11-26', presencaPorTurno(['m1', 'm2'], blocos), presencaPorTurno(depois, blocos), new Date('2026-11-24T12:00:00-03:00'))).toEqual([]);
  });

  it('G13: refeição que já passou não gera aviso', () => {
    // Registro às 13h da dispensa da tarde: o almoço (12h) já foi servido; só o lanche da tarde é avisado.
    const impactos = impactosFuturos(
      '2026-11-26',
      { temAulaManha: true, temAulaTarde: true },
      { temAulaManha: true, temAulaTarde: false },
      new Date('2026-11-26T13:00:00-03:00'),
    );
    expect(impactos.map((i) => [i.tipoRefeicao, i.nivelSla])).toEqual([['LANCHE_TARDE', 'VERMELHO_MENOS_4H']]);
  });
});

describe('conciliarAlertas', () => {
  const agora = new Date('2026-11-26T10:00:00-03:00');
  const alerta = (id: string, tipoRefeicao: 'LANCHE_MANHA' | 'ALMOCO' | 'LANCHE_TARDE', hora: string) => ({
    id,
    tipoRefeicao,
    acao: 'CANCELAR_REFEICAO' as const,
    dataRefeicao: new Date(`2026-11-26T${hora}:00-03:00`),
  });
  const impactos = impactosFuturos('2026-11-26', { temAulaManha: true, temAulaTarde: true }, { temAulaManha: true, temAulaTarde: false }, agora);

  it('cria os que faltam e mantém os que continuam valendo', () => {
    const r = conciliarAlertas([alerta('a1', 'ALMOCO', '12:00')], impactos, agora);
    expect(r.criar.map((i) => i.tipoRefeicao)).toEqual(['LANCHE_TARDE']);
    expect(r.cancelarIds).toEqual([]);
  });

  it('cancela os futuros que deixaram de valer e preserva o histórico já passado', () => {
    const r = conciliarAlertas([alerta('passado', 'LANCHE_MANHA', '09:30'), alerta('a2', 'ALMOCO', '12:00')], [], agora);
    expect(r.cancelarIds).toEqual(['a2']);
    expect(r.criar).toEqual([]);
  });
});

describe('G08: aviso ao grupo da Gestão', () => {
  it('só para dispensa, impacto alimentar ou aula sem cobertura', () => {
    expect(deveAvisarGestao('COBERTA_POR_SUBSTITUICAO', false)).toBe(false);
    expect(deveAvisarGestao('AULA_ADIANTADA', false)).toBe(false);
    expect(deveAvisarGestao('AULA_ADIANTADA', true)).toBe(true);
    expect(deveAvisarGestao('PENDENTE_DECISAO', false)).toBe(true);
    expect(deveAvisarGestao('TURMA_DISPENSADA', false)).toBe(true);
  });
});

describe('período de ausência (vários dias)', () => {
  it('lista as datas do período, inclusive as pontas', () => {
    expect(datasDoPeriodo('2026-11-27', '2026-11-30')).toEqual(['2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30']);
    expect(datasDoPeriodo('2026-11-27', '')).toEqual(['2026-11-27']);
    expect(datasDoPeriodo('2026-11-27', '2026-11-27')).toEqual(['2026-11-27']);
  });

  it('recusa fim antes do início e período acima do máximo', () => {
    expect(datasDoPeriodo('2026-11-27', '2026-11-26')).toBeNull();
    expect(datasDoPeriodo('2026-11-01', '2026-11-15')).toHaveLength(DIAS_MAXIMOS_PERIODO);
    expect(datasDoPeriodo('2026-11-01', '2026-11-16')).toBeNull();
  });

  it('lê a data da chave da aula, ou usa a data informada', () => {
    expect(lerChaveDoPeriodo('2026-11-28#of1|b2', '2026-11-27')).toEqual({ data: '2026-11-28', chave: 'of1|b2' });
    expect(lerChaveDoPeriodo('of1|b2', '2026-11-27')).toEqual({ data: '2026-11-27', chave: 'of1|b2' });
  });
});
