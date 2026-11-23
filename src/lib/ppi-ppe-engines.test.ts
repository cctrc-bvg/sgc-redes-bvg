import { describe, expect, it } from 'vitest';
import { avaliarProgressoPpi, calcularHorasAtividadePpi, validarLimitePei } from './ppi-ppe-engines';
import { REGRAS_PPI_2022 } from './ppi-regras-2022';

describe('calcularHorasAtividadePpi (RF07 — teto por atividade)', () => {
  // Visita técnica: 8h por visita, até 4 visitas, teto de 8h.
  const visita = { horasPorUnidade: 8, qtdMaxima: 4, pontuacaoMaxima: 8 };
  // Grupo de estudo: 2h por semestre, até 6 semestres, teto de 8h.
  const grupoEstudo = { horasPorUnidade: 2, qtdMaxima: 6, pontuacaoMaxima: 8 };

  it('multiplica quantidade por horas por unidade quando abaixo dos limites', () => {
    expect(calcularHorasAtividadePpi({ ...grupoEstudo, quantidadeInformada: 3 })).toBe(6);
  });

  it('aplica o teto de pontuação da categoria', () => {
    expect(calcularHorasAtividadePpi({ ...visita, quantidadeInformada: 2 })).toBe(8);
    expect(calcularHorasAtividadePpi({ ...grupoEstudo, quantidadeInformada: 5 })).toBe(8);
  });

  it('limita a quantidade à quantidade máxima', () => {
    // Monitoria: 6h, no máximo 1, teto 6h — informar 3 conta como 1.
    expect(
      calcularHorasAtividadePpi({ horasPorUnidade: 6, qtdMaxima: 1, pontuacaoMaxima: 6, quantidadeInformada: 3 }),
    ).toBe(6);
    // Instrutor: 1h por hora-aula, no máximo 12, teto 12h.
    expect(
      calcularHorasAtividadePpi({ horasPorUnidade: 1, qtdMaxima: 12, pontuacaoMaxima: 12, quantidadeInformada: 20 }),
    ).toBe(12);
  });

  it('quantidade zero ou negativa resulta em zero horas', () => {
    expect(calcularHorasAtividadePpi({ ...visita, quantidadeInformada: 0 })).toBe(0);
    expect(calcularHorasAtividadePpi({ ...visita, quantidadeInformada: -2 })).toBe(0);
  });
});

describe('avaliarProgressoPpi (RF07 — meta de 40h)', () => {
  it('calcula restante e percentual', () => {
    expect(avaliarProgressoPpi(10)).toEqual({ meta: 40, totalValidado: 10, restante: 30, percentual: 25, concluido: false });
  });

  it('conclui ao atingir exatamente 40h', () => {
    expect(avaliarProgressoPpi(40)).toMatchObject({ restante: 0, percentual: 100, concluido: true });
  });

  it('não passa de 100% nem fica com restante negativo acima da meta', () => {
    expect(avaliarProgressoPpi(52)).toMatchObject({ restante: 0, percentual: 100, concluido: true });
  });

  it('nunca exibe 100% enquanto a meta não foi atingida', () => {
    // 39,9h: o estudante ainda deve horas; a barra não pode dizer 100%.
    const progresso = avaliarProgressoPpi(39.9);
    expect(progresso.concluido).toBe(false);
    expect(progresso.percentual).toBeLessThan(100);
  });

  it('aceita meta diferente de 40h', () => {
    expect(avaliarProgressoPpi(15, 60)).toMatchObject({ meta: 60, restante: 45, percentual: 25 });
  });
});

describe('validarLimitePei (RF06 — ROD Arts. 117 e 121)', () => {
  const pei = {
    cargaHorariaDisciplina: 80,
    cargaHorariaPeiInformada: 20,
    horasPresenciais: 10,
    horasPraticas: 0,
    exigePratica: false,
  };

  it('PEI dentro de 30% da carga horária é válido', () => {
    expect(validarLimitePei(pei)).toEqual({ valido: true, teto30Porcento: 24, erros: [] });
  });

  it('aceita exatamente 30% (Art. 117 §1º diz "até")', () => {
    expect(validarLimitePei({ ...pei, cargaHorariaPeiInformada: 24 }).valido).toBe(true);
  });

  it('bloqueia PEI acima de 30% e informa o máximo permitido', () => {
    const r = validarLimitePei({ ...pei, cargaHorariaPeiInformada: 25 });
    expect(r.valido).toBe(false);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toMatch(/Art\. 117 §1º/);
    expect(r.erros[0]).toMatch(/máximo 24h/);
  });

  it('arredonda o teto para baixo quando 30% não é inteiro', () => {
    // 50h × 30% = 15h; 33h × 30% = 9,9h → 9h.
    expect(validarLimitePei({ ...pei, cargaHorariaDisciplina: 50 }).teto30Porcento).toBe(15);
    expect(validarLimitePei({ ...pei, cargaHorariaDisciplina: 33, cargaHorariaPeiInformada: 9, horasPresenciais: 5 }).teto30Porcento).toBe(9);
  });

  it('carga horária zero ou negativa é inválida', () => {
    expect(validarLimitePei({ ...pei, cargaHorariaPeiInformada: 0, horasPresenciais: 0 }).erros).toContain(
      'A carga horária do PEI deve ser maior que zero.',
    );
  });

  it('horas presenciais não podem passar da carga do PEI', () => {
    const r = validarLimitePei({ ...pei, horasPresenciais: 21 });
    expect(r.valido).toBe(false);
    expect(r.erros[0]).toMatch(/presenciais/);
  });

  it('disciplina com prática exige horas práticas (Art. 121)', () => {
    const r = validarLimitePei({ ...pei, exigePratica: true, horasPraticas: 0 });
    expect(r.valido).toBe(false);
    expect(r.erros[0]).toMatch(/Art\. 121/);
    expect(validarLimitePei({ ...pei, exigePratica: true, horasPraticas: 4 }).valido).toBe(true);
  });

  it('acumula todos os erros para o usuário corrigir de uma vez', () => {
    const r = validarLimitePei({ ...pei, cargaHorariaPeiInformada: 30, horasPresenciais: 40, exigePratica: true });
    expect(r.erros).toHaveLength(3);
  });
});

describe('Tabela PPI — Manual 2022 (conformidade com o FSD)', () => {
  const porGrupo = (g: number) => REGRAS_PPI_2022.filter((r) => r.grupo === g).length;

  it('tem 32 categorias em 6 grupos', () => {
    expect(REGRAS_PPI_2022).toHaveLength(32);
    expect(new Set(REGRAS_PPI_2022.map((r) => r.grupo))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('distribui as categorias como no FSD (5/10/5/5/6/1)', () => {
    expect([1, 2, 3, 4, 5, 6].map(porGrupo)).toEqual([5, 10, 5, 5, 6, 1]);
  });

  it('cada categoria tem valores positivos e teto alcançável', () => {
    for (const r of REGRAS_PPI_2022) {
      expect(r.horasPorUnidade, r.descricao).toBeGreaterThan(0);
      expect(r.qtdMaxima, r.descricao).toBeGreaterThan(0);
      expect(r.pontuacaoMaxima, r.descricao).toBeGreaterThan(0);
      expect(r.pontuacaoMaxima, r.descricao).toBeLessThanOrEqual(r.qtdMaxima * r.horasPorUnidade);
    }
  });

  it('não tem descrições duplicadas', () => {
    const descricoes = REGRAS_PPI_2022.map((r) => r.descricao);
    expect(new Set(descricoes).size).toBe(descricoes.length);
  });
});
