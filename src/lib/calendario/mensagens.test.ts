import { describe, expect, it } from 'vitest';
import { assuntoDoEvento, pedeComunicacao, textoDoEvento, type EventoComunicavel } from './mensagens';

const falta: EventoComunicavel = {
  tipo: 'SUSPENSAO_AULAS',
  inicio: '2027-03-10',
  fim: '2027-03-10',
  descricao: null,
  motivo: 'Falta de energia',
  suspendeAulas: true,
  imprevisto: true,
};

describe('mensagens de alteração do calendário', () => {
  it('suspensão imprevista pede comunicação; feriado previsto não', () => {
    expect(pedeComunicacao(falta)).toBe(true);
    expect(pedeComunicacao({ tipo: 'FERIADO', imprevisto: false })).toBe(false);
    expect(pedeComunicacao({ tipo: 'PONTO_FACULTATIVO', imprevisto: true })).toBe(true);
  });

  it('assunto com data e "sem aulas"', () => {
    expect(assuntoDoEvento(falta)).toBe('[SGC-Redes] Alteração no calendário: Sem aulas — 10/03/2027');
  });

  it('texto por público: refeições para a CAE, reposição para docentes, repasse às turmas', () => {
    expect(textoDoEvento(falta, 'cae')).toMatch(/refeições .* não serão necessárias/);
    expect(textoDoEvento(falta, 'docentes')).toMatch(/serão repostas/);
    expect(textoDoEvento(falta, 'turmas')).toMatch(/Repassem à turma/);
    expect(textoDoEvento(falta, 'gestao')).toContain('Motivo: Suspensão de aulas (força maior) — Falta de energia');
    expect(textoDoEvento(falta, 'docentes')).toContain('10/03/2027 (quarta-feira)');
  });

  it('aulas mantidas: sem pedido de ajuste de refeições', () => {
    const reuniao = { ...falta, tipo: 'REUNIAO' as const, motivo: null, descricao: 'Pais', suspendeAulas: false, imprevisto: false, fim: '2027-03-11' };
    expect(textoDoEvento(reuniao, 'cae')).not.toMatch(/refeições/);
    expect(textoDoEvento(reuniao, 'cae')).toMatch(/aulas estão \*mantidas\*/);
    expect(textoDoEvento(reuniao, 'cae')).toContain('Período:');
  });
});

describe('avaliações finais', () => {
  const finais: EventoComunicavel = { tipo: 'AVALIACOES_FINAIS', inicio: '2026-12-17', fim: '2026-12-22', descricao: null, motivo: null, suspendeAulas: true, imprevisto: false };
  it('dizem que não há aula regular nem dia letivo, com orientação por público', () => {
    expect(assuntoDoEvento(finais)).toContain('Avaliações finais');
    expect(textoDoEvento(finais, 'gestao')).toContain('não contam como letivos');
    expect(textoDoEvento(finais, 'docentes')).toContain('Art. 105');
    expect(textoDoEvento(finais, 'cae')).toContain('acréscimos');
    expect(textoDoEvento(finais, 'turmas')).not.toContain('reposição');
  });
});
