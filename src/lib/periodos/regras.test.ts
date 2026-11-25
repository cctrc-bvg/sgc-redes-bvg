import { describe, expect, it } from 'vitest';
import { diasDoPeriodo, MAX_DIAS_PERIODO, mensagemPlanoAlimentar, periodoNaData, PeriodoSchema, planoAlimentar, turnosComAula, validarPresentes, type TurmaDoPlano } from './regras';

const dia = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

describe('períodos especiais', () => {
  it('valida nome, tipo e datas; limita a 15 dias', () => {
    const ok = { nome: 'Jogos internos 2027', tipo: 'JOGOS_INTERNOS', inicio: '2027-05-10', fim: '2027-05-14' };
    expect(PeriodoSchema.safeParse(ok).success).toBe(true);
    expect(PeriodoSchema.safeParse({ ...ok, fim: '2027-05-09' }).success).toBe(false);
    expect(PeriodoSchema.safeParse({ ...ok, nome: 'ab' }).success).toBe(false);
    expect(PeriodoSchema.safeParse({ ...ok, tipo: 'FESTA' }).success).toBe(false);
    for (const t of ['UNIVERSO_FCE', 'SEMANA_DO_CURSO', 'SEMANA_OUTROS_CURSOS', 'ENCONTRO_EXTENSAO', 'ENCONTRO_PESQUISA']) expect(PeriodoSchema.safeParse({ ...ok, tipo: t }).success, t).toBe(true);
    const longo = PeriodoSchema.safeParse({ ...ok, fim: '2027-05-30' });
    expect(longo.success).toBe(false);
    expect(MAX_DIAS_PERIODO).toBe(15);
  });

  it('período na data: o mais recente vence na sobreposição', () => {
    const ps = [{ id: 'a', inicio: '2027-05-10', fim: '2027-05-14' }, { id: 'b', inicio: '2027-05-12', fim: '2027-05-13' }];
    expect(periodoNaData('2027-05-11', ps)?.id).toBe('a');
    expect(periodoNaData('2027-05-12', ps)?.id).toBe('b');
    expect(periodoNaData('2027-05-15', ps)).toBeNull();
  });

  it('dias do período: só dias letivos', () => {
    const letivos = new Set(['2027-05-10', '2027-05-11', '2027-05-13', '2027-05-14']); // 12/05 é feriado, por exemplo
    expect(diasDoPeriodo('2027-05-10', '2027-05-14', letivos)).toEqual(['2027-05-10', '2027-05-11', '2027-05-13', '2027-05-14']);
  });

  const turma = (celulas: TurmaDoPlano['celulas'], presentes: [string, number][] = [], ativos = 30): TurmaDoPlano => ({
    codigo: 'REDES-1',
    ativos,
    normal: { LANCHE_MANHA: 30, ALMOCO: 30, LANCHE_TARDE: 30 },
    celulas,
    presentes: new Map(presentes),
  });

  it('turnos com aula pela grade especial', () => {
    const c = [{ diaSemana: 1, turno: 'MANHA' as const, ofertaId: 'o1' }, { diaSemana: 1, turno: 'TARDE' as const, ofertaId: null }];
    expect(turnosComAula(c, 1)).toEqual({ temAulaManha: true, temAulaTarde: false });
    expect(turnosComAula(c, 2)).toEqual({ temAulaManha: false, temAulaTarde: false });
  });

  it('plano alimentar: refeições pela regra do campus vezes os presentes', () => {
    const celulas = [
      { diaSemana: 1, turno: 'MANHA' as const, ofertaId: 'o1' }, // segunda: só manhã
      { diaSemana: 2, turno: 'MANHA' as const, ofertaId: 'o1' }, // terça: integral
      { diaSemana: 2, turno: 'TARDE' as const, ofertaId: 'o2' },
    ];
    const plano = planoAlimentar(['2027-05-10', '2027-05-11', '2027-05-12'], [turma(celulas, [['2027-05-10', 12], ['2027-05-11', 8]])], dia);
    expect(plano[0]!.total).toEqual({ LANCHE_MANHA: 12, ALMOCO: 0, LANCHE_TARDE: 0 });
    expect(plano[1]!.total).toEqual({ LANCHE_MANHA: 8, ALMOCO: 8, LANCHE_TARDE: 8 });
    expect(plano[2]!.total).toEqual({ LANCHE_MANHA: 0, ALMOCO: 0, LANCHE_TARDE: 0 }); // quarta sem aula
    expect(plano[0]!.totalNormal.ALMOCO).toBe(30);
  });

  it('sem registro de presença, valem os estudantes ativos; várias turmas somam', () => {
    const celulas = [{ diaSemana: 1, turno: 'TARDE' as const, ofertaId: 'o1' }];
    const plano = planoAlimentar(['2027-05-10'], [turma(celulas, [], 28), { ...turma(celulas, [['2027-05-10', 5]], 30), codigo: 'REDES-2' }], dia);
    expect(plano[0]!.total.LANCHE_TARDE).toBe(33);
    expect(plano[0]!.turmas.map((t) => t.presentes)).toEqual([28, 5]);
  });

  it('presentes: inteiro entre 0 e os ativos', () => {
    expect(validarPresentes('12', 30)).toEqual({ valor: 12 });
    expect(validarPresentes('0', 30)).toEqual({ valor: 0 });
    expect(validarPresentes('31', 30)).toEqual({ erro: 'A turma tem 30 estudantes ativos.' });
    expect(validarPresentes('-1', 30)).toEqual({ erro: 'Informe um número inteiro.' });
    expect(validarPresentes('', 30)).toEqual({ erro: 'Informe um número inteiro.' });
  });

  it('mensagem ao CAE traz as quantidades e o normal de cada dia', () => {
    const plano = planoAlimentar(['2027-05-10'], [turma([{ diaSemana: 1, turno: 'MANHA', ofertaId: 'o1' }], [['2027-05-10', 12]])], dia);
    const texto = mensagemPlanoAlimentar({ nome: 'Jogos internos', inicio: '2027-05-10', fim: '2027-05-14', plano });
    expect(texto).toContain('Jogos internos (10/05/2027 a 14/05/2027)');
    expect(texto).toContain('*10/05/2027* — lanche da manhã: 12 (normal 30); almoço: 0 (normal 30); lanche da tarde: 0 (normal 30).');
  });
});
