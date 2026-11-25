import { describe, expect, it } from 'vitest';
import { andamentoDoPei, manterRealizados } from './andamento';

const e = (data: string, realizado = false, conteudo = 'Revisão') => ({ data, conteudo, realizado });

describe('andamentoDoPei', () => {
  it('conta os encontros que já passaram sem registro', () => {
    const a = andamentoDoPei([e('2026-11-10', true), e('2026-11-17'), e('2026-11-24'), e('2026-12-01')], null, '2026-11-25');
    expect(a).toEqual({ encontrosAConfirmar: 2, prazoFinal: '2026-12-01', prontoParaConcluir: false });
  });

  it('pronto para concluir: todos os encontros feitos ou prazo final passado', () => {
    expect(andamentoDoPei([e('2026-12-01', true)], null, '2026-11-25').prontoParaConcluir).toBe(true);
    expect(andamentoDoPei([e('2026-11-20')], null, '2026-11-25').prontoParaConcluir).toBe(true);
  });

  it('a prorrogação (Art. 124) estende o prazo final', () => {
    const a = andamentoDoPei([e('2026-11-20', true), e('2026-11-21')], '2026-12-10', '2026-11-25');
    expect(a.prazoFinal).toBe('2026-12-10');
    expect(a.prontoParaConcluir).toBe(false);
    expect(a.encontrosAConfirmar).toBe(1);
  });

  it('sem cronograma, nada a confirmar nem concluir', () => {
    expect(andamentoDoPei([], null, '2026-11-25')).toEqual({ encontrosAConfirmar: 0, prazoFinal: null, prontoParaConcluir: false });
  });
});

describe('manterRealizados', () => {
  it('mantém a marca só no encontro com a mesma data e o mesmo conteúdo', () => {
    const r = manterRealizados(
      [{ data: '2026-11-10', conteudo: 'Revisão' }, { data: '2026-11-17', conteudo: 'Lista 2' }],
      [e('2026-11-10', true, 'Revisão '), e('2026-11-17', true, 'Lista 1')],
    );
    expect(r.map((x) => x.realizado)).toEqual([true, false]);
  });
});
