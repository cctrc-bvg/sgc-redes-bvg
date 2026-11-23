import { describe, expect, it } from 'vitest';
import {
  calcularImpactoAlimentacao,
  calcularRefeicoesPrevistas,
  classificarSla,
  gerarMensagemAssistenciaEstudantil,
  validarDataISO,
} from './alimentacao-engine';

const SO_MANHA = { temAulaManha: true, temAulaTarde: false };
const SO_TARDE = { temAulaManha: false, temAulaTarde: true };
const INTEGRAL = { temAulaManha: true, temAulaTarde: true };
const SEM_AULA = { temAulaManha: false, temAulaTarde: false };

/** Instante em horário de Fortaleza (UTC-03:00), independente do fuso da máquina. */
const fortaleza = (dataHora: string) => new Date(`${dataHora}-03:00`);

describe('calcularRefeicoesPrevistas (RF03 / RN01)', () => {
  it('só manhã prevê apenas o lanche das 09:30', () => {
    expect(calcularRefeicoesPrevistas(SO_MANHA)).toEqual(['LANCHE_MANHA']);
  });

  it('só tarde prevê apenas o lanche das 15:00', () => {
    expect(calcularRefeicoesPrevistas(SO_TARDE)).toEqual(['LANCHE_TARDE']);
  });

  it('regime integral prevê lanche da manhã, almoço e lanche da tarde', () => {
    expect(calcularRefeicoesPrevistas(INTEGRAL)).toEqual(['LANCHE_MANHA', 'ALMOCO', 'LANCHE_TARDE']);
  });

  it('sem aula no dia não prevê refeição', () => {
    expect(calcularRefeicoesPrevistas(SEM_AULA)).toEqual([]);
  });

  it('regra crítica: almoço só existe quando a turma fica nos dois turnos', () => {
    expect(calcularRefeicoesPrevistas(SO_MANHA)).not.toContain('ALMOCO');
    expect(calcularRefeicoesPrevistas(SO_TARDE)).not.toContain('ALMOCO');
  });
});

describe('classificarSla (RF04)', () => {
  it.each([
    [48 * 60, 'VERDE_24H_MAIS'],
    [24 * 60, 'VERDE_24H_MAIS'], // exatamente 24h ainda é planejado
    [24 * 60 - 1, 'AMARELO_4H_A_24H'],
    [4 * 60, 'AMARELO_4H_A_24H'], // exatamente 4h ainda é imprevisto moderado
    [4 * 60 - 1, 'VERMELHO_MENOS_4H'],
    [0, 'VERMELHO_MENOS_4H'],
  ])('%i minutos de antecedência → %s', (minutos, nivel) => {
    expect(classificarSla(minutos).nivel).toBe(nivel);
  });

  it('a etiqueta traz texto além do emoji (status não depende só da cor)', () => {
    expect(classificarSla(24 * 60).etiqueta).toMatch(/Planejado/);
    expect(classificarSla(5 * 60).etiqueta).toMatch(/Imprevisto/);
    expect(classificarSla(60).etiqueta).toMatch(/Emergência/);
  });
});

describe('calcularImpactoAlimentacao (RF03 + RF04)', () => {
  it('sem mudança de turnos não gera impacto', () => {
    const impactos = calcularImpactoAlimentacao({
      dataAulaISO: '2026-11-25',
      antes: INTEGRAL,
      depois: INTEGRAL,
      agora: fortaleza('2026-11-20T08:00:00'),
    });
    expect(impactos).toEqual([]);
  });

  it('queda do turno da tarde em dia integral cancela almoço e lanche da tarde, mantendo o da manhã', () => {
    const impactos = calcularImpactoAlimentacao({
      dataAulaISO: '2026-11-25',
      antes: INTEGRAL,
      depois: SO_MANHA,
      agora: fortaleza('2026-11-20T08:00:00'),
    });
    expect(impactos.map((i) => [i.tipoRefeicao, i.acao])).toEqual([
      ['ALMOCO', 'CANCELAR'],
      ['LANCHE_TARDE', 'CANCELAR'],
    ]);
    expect(impactos.every((i) => i.nivelSla === 'VERDE_24H_MAIS')).toBe(true);
  });

  it('dia que passa a ser integral (ex.: encontro de PEI) adiciona almoço e lanche da tarde', () => {
    const impactos = calcularImpactoAlimentacao({
      dataAulaISO: '2026-11-25',
      antes: SO_MANHA,
      depois: INTEGRAL,
      agora: fortaleza('2026-11-20T08:00:00'),
    });
    expect(impactos.map((i) => [i.tipoRefeicao, i.acao])).toEqual([
      ['ALMOCO', 'ADICIONAR'],
      ['LANCHE_TARDE', 'ADICIONAR'],
    ]);
  });

  it('troca de turno (manhã → tarde) cancela um lanche e adiciona o outro', () => {
    const impactos = calcularImpactoAlimentacao({
      dataAulaISO: '2026-11-25',
      antes: SO_MANHA,
      depois: SO_TARDE,
      agora: fortaleza('2026-11-20T08:00:00'),
    });
    expect(impactos.map((i) => [i.tipoRefeicao, i.acao])).toEqual([
      ['LANCHE_MANHA', 'CANCELAR'],
      ['LANCHE_TARDE', 'ADICIONAR'],
    ]);
  });

  it('calcula a antecedência por refeição no horário de Fortaleza', () => {
    // Registro às 08:00 do próprio dia: almoço (12:00) em 4h, lanche da tarde (15:00) em 7h.
    const impactos = calcularImpactoAlimentacao({
      dataAulaISO: '2026-11-25',
      antes: INTEGRAL,
      depois: SO_MANHA,
      agora: fortaleza('2026-11-25T08:00:00'),
    });
    const porRefeicao = Object.fromEntries(impactos.map((i) => [i.tipoRefeicao, i]));
    expect(porRefeicao.ALMOCO.antecedenciaMinutos).toBe(4 * 60);
    expect(porRefeicao.ALMOCO.horarioReferencia).toBe('12:00');
    expect(porRefeicao.LANCHE_TARDE.antecedenciaMinutos).toBe(7 * 60);
  });

  it('cada refeição recebe seu próprio nível de SLA', () => {
    // Registro às 09:00: almoço em 3h (emergência), lanche da tarde em 6h (imprevisto).
    const impactos = calcularImpactoAlimentacao({
      dataAulaISO: '2026-11-25',
      antes: INTEGRAL,
      depois: SO_MANHA,
      agora: fortaleza('2026-11-25T09:00:00'),
    });
    const niveis = Object.fromEntries(impactos.map((i) => [i.tipoRefeicao, i.nivelSla]));
    expect(niveis).toEqual({ ALMOCO: 'VERMELHO_MENOS_4H', LANCHE_TARDE: 'AMARELO_4H_A_24H' });
  });

  it('o resultado não depende do fuso do servidor (instante em UTC)', () => {
    // 2026-11-24T15:00Z = 12:00 em Fortaleza, exatamente 24h antes do almoço do dia 25.
    const impactos = calcularImpactoAlimentacao({
      dataAulaISO: '2026-11-25',
      antes: INTEGRAL,
      depois: SO_MANHA,
      agora: new Date('2026-11-24T15:00:00Z'),
    });
    const almoco = impactos.find((i) => i.tipoRefeicao === 'ALMOCO');
    expect(almoco?.antecedenciaMinutos).toBe(24 * 60);
    expect(almoco?.nivelSla).toBe('VERDE_24H_MAIS');
  });
});

describe('validarDataISO', () => {
  it('aceita datas válidas, inclusive 29/02 em ano bissexto', () => {
    expect(() => validarDataISO('2026-11-25')).not.toThrow();
    expect(() => validarDataISO('2028-02-29')).not.toThrow();
    expect(() => validarDataISO('2026-12-31')).not.toThrow();
  });

  it.each(['25/11/2026', '2026-11-5', '2026/11/25', '2026-11-25T12:00', '', ' 2026-11-25'])(
    'rejeita formato fora de AAAA-MM-DD: "%s"',
    (data) => {
      expect(() => validarDataISO(data)).toThrow(/formato AAAA-MM-DD/);
    },
  );

  it.each(['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-00'])(
    'rejeita data inexistente no calendário: %s',
    (data) => {
      expect(() => validarDataISO(data)).toThrow(/inexistente/);
    },
  );
});

describe('calcularImpactoAlimentacao — entradas inválidas', () => {
  const base = { antes: INTEGRAL, depois: SO_MANHA, agora: fortaleza('2026-11-24T08:00') };

  it('lança erro em vez de classificar data malformada como emergência', () => {
    expect(() => calcularImpactoAlimentacao({ ...base, dataAulaISO: '25/11/2026' })).toThrow(RangeError);
  });

  it('não desloca data inexistente para o mês seguinte', () => {
    expect(() => calcularImpactoAlimentacao({ ...base, dataAulaISO: '2026-02-30' })).toThrow(RangeError);
  });

  it('lança erro quando o instante de referência é inválido', () => {
    expect(() =>
      calcularImpactoAlimentacao({ ...base, dataAulaISO: '2026-11-25', agora: new Date('inválida') }),
    ).toThrow(/agora/);
  });
});

describe('gerarMensagemAssistenciaEstudantil (RF05 / LGPD)', () => {
  const base = { nomeTurma: 'REDES-2', dataFormatada: '25/11/2026', qtdAlunos: 32, motivoOperacional: 'Participação em evento' };

  it('sem impactos, informa que a alimentação está mantida', () => {
    const msg = gerarMensagemAssistenciaEstudantil({ ...base, impactos: [] });
    expect(msg).toContain('REDES-2');
    expect(msg).toContain('Alimentação mantida');
  });

  it('lista cada alteração com refeição, horário e etiqueta de SLA', () => {
    const impactos = calcularImpactoAlimentacao({
      dataAulaISO: '2026-11-25',
      antes: INTEGRAL,
      depois: SO_MANHA,
      agora: fortaleza('2026-11-20T08:00:00'),
    });
    const msg = gerarMensagemAssistenciaEstudantil({ ...base, impactos });
    expect(msg).toContain('Turma: *REDES-2* (~32 estudantes)');
    expect(msg).toContain('Data: *25/11/2026*');
    expect(msg).toContain('- CANCELAR *Almoço (12:00)* — 🟢 Planejado (24h+)');
    expect(msg).toContain('- CANCELAR *Lanche da Tarde (15:00)*');
    expect(msg).toContain('Motivo operacional: Participação em evento');
  });

  it('contém apenas a turma e a quantidade, sem nomes de estudantes ou professores', () => {
    const msg = gerarMensagemAssistenciaEstudantil({ ...base, impactos: [] });
    // A função não recebe dados pessoais; a mensagem só pode conter o que foi passado.
    expect(Object.keys(base)).toEqual(['nomeTurma', 'dataFormatada', 'qtdAlunos', 'motivoOperacional']);
    expect(msg).not.toMatch(/matr[ií]cula|cpf/i);
  });
});
