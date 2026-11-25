import { describe, expect, it } from 'vitest';
import { aulasEsperadas, DiarioSchema, mensagemLembrete, numeroWhatsapp, percentual, semaforo, validarMinistradas } from './regras';

describe('semáforo de diários (RF08)', () => {
  const o = (aulasMinistradas: number, diarioEmDia = true) => ({ aulasPrevistas: 80, aulasMinistradas, diarioEmDia });

  it('carga cumprida vence tudo; diário atrasado é vermelho', () => {
    expect(semaforo(o(80, false), 80)).toBe('concluida');
    expect(semaforo(o(30, false), 10)).toBe('atrasado');
  });

  it('amarelo só quando fica abaixo do esperado além da folga de 10% (8 aulas em 80)', () => {
    expect(semaforo(o(32), 40)).toBe('em-dia'); // 40 − 8 = 32: no limite
    expect(semaforo(o(31), 40)).toBe('atencao');
    expect(semaforo(o(0), null)).toBe('em-dia'); // sem referência de calendário
  });

  it('déficit projetado da grade acende o amarelo, mas não vence atraso nem carga cumprida', () => {
    expect(semaforo(o(40), 40, 5)).toBe('atencao');
    expect(semaforo(o(40, false), 40, 5)).toBe('atrasado');
    expect(semaforo(o(80), 80, 5)).toBe('concluida');
  });

  it('percentual limitado a 100%', () => {
    expect(percentual(40, 80)).toBe(50);
    expect(percentual(90, 80)).toBe(100);
    expect(percentual(5, 0)).toBe(0);
  });
});

describe('aulasEsperadas', () => {
  it('proporcional ao tempo decorrido do período', () => {
    expect(aulasEsperadas(80, '2026-02-01', '2026-06-30', '2026-01-15')).toBe(0);
    expect(aulasEsperadas(80, '2026-02-01', '2026-06-30', '2026-07-10')).toBe(80);
    expect(aulasEsperadas(100, '2026-01-01', '2026-01-11', '2026-01-06')).toBe(50);
  });
});

describe('formulário e lembrete', () => {
  it('lê ministradas, situação e observação', () => {
    expect(DiarioSchema.parse({ aulasMinistradas: ' 24 ', diarioEmDia: 'on', observacaoDiario: '' })).toEqual({ aulasMinistradas: 24, diarioEmDia: true });
    expect(DiarioSchema.safeParse({ aulasMinistradas: '2,5' }).success).toBe(false);
    expect(validarMinistradas(121, 80)).toMatch(/alto demais/);
    expect(validarMinistradas(120, 80)).toBeNull();
  });

  it('lembrete sem dados de estudantes e número no formato wa.me', () => {
    const msg = mensagemLembrete({ professor: 'Ana', disciplina: 'Redes I', turma: 'REDES-2', ministradas: 20, previstas: 80 });
    expect(msg).toContain('*Redes I* (REDES-2): constam 20 de 80 aulas');
    expect(numeroWhatsapp('(88) 99999-0000')).toBe('5588999990000');
    expect(numeroWhatsapp('55 88 99999-0000')).toBe('5588999990000');
    expect(numeroWhatsapp('123')).toBeNull();
    expect(numeroWhatsapp(null)).toBeNull();
  });
});
