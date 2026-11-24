import { describe, expect, it } from 'vitest';
import { linkWhatsapp, mensagemAssistencia, mensagemGestao, mensagemLideres, mensagemProfessores, mensagensDaAusencia, type DadosMensagem } from './mensagens';

const base: DadosMensagem = {
  turma: 'Redes 2º Ano (Integrado)',
  codigoTurma: 'REDES-2',
  dataISO: '2026-11-26',
  diaSemana: 'quinta-feira',
  disciplina: 'Redes de Computadores',
  professor: 'Ana Souza',
  motivoOperacional: 'Participação em evento',
  status: 'PENDENTE_DECISAO',
  horarios: [
    { bloco: 'Manhã A (07:30–08:30)', situacao: 'pendente' },
    { bloco: 'Manhã B (08:30–09:30)', situacao: 'pendente' },
  ],
  refeicoes: [],
};

describe('mensagens da ausência', () => {
  it('professores: convite só enquanto há horário sem cobertura', () => {
    const msg = mensagemProfessores(base)!;
    expect(msg).toContain('26/11/2026 (quinta-feira)');
    expect(msg).toContain('- Manhã A (07:30–08:30)');
    expect(mensagemProfessores({ ...base, horarios: [{ bloco: 'Manhã A', situacao: 'dispensa' }] })).toBeNull();
  });

  it('líderes: sem nomes de docentes nem motivo', () => {
    const msg = mensagemLideres({
      ...base,
      status: 'AULA_ADIANTADA',
      horarios: [
        { bloco: 'Manhã A', situacao: 'substituicao', detalhe: 'Bruno Lima' },
        { bloco: 'Manhã B', situacao: 'adiantamento', detalhe: 'Banco de Dados (de Tarde A)' },
        { bloco: 'Tarde A', situacao: 'dispensa' },
      ],
    })!;
    expect(msg).toContain('AVISO À TURMA REDES-2');
    expect(msg).toContain('Manhã A: aula normal, com professor(a) substituto(a)');
    expect(msg).toContain('Manhã B: aula adiantada: Banco de Dados (de Tarde A)');
    expect(msg).toContain('Tarde A: sem aula');
    expect(msg).not.toMatch(/Bruno|Ana|evento/);
    expect(mensagemLideres(base)).toBeNull();
  });

  it('gestão (G08): não avisa substituição sem impacto; avisa dispensa e pendência', () => {
    const coberta = { ...base, status: 'COBERTA_POR_SUBSTITUICAO' as const, horarios: [{ bloco: 'Manhã A', situacao: 'substituicao' as const, detalhe: 'Bruno' }] };
    expect(mensagemGestao(coberta)).toBeNull();
    expect(mensagemGestao(base)).toContain('Situação: Aguardando decisão');
    expect(mensagemGestao({ ...base, status: 'TURMA_DISPENSADA' })).toContain('Motivo operacional: Participação em evento');
  });

  it('assistência estudantil: refeições com quantidade e etiqueta de urgência, sem docente', () => {
    const msg = mensagemAssistencia({
      ...base,
      status: 'TURMA_DISPENSADA',
      refeicoes: [
        { tipo: 'ALMOCO', acao: 'CANCELAR_REFEICAO', quantidade: 30, nivel: 'AMARELO_4H_A_24H' },
        { tipo: 'LANCHE_TARDE', acao: 'CANCELAR_REFEICAO', quantidade: 28, nivel: 'VERMELHO_MENOS_4H' },
      ],
    })!;
    expect(msg).toContain('[EMERGÊNCIA]');
    expect(msg).toContain('- CANCELAR *Almoço (12:00)*: 30 estudante(s) — 🟡');
    expect(msg).toContain('Lanche da tarde (15:00)*: 28 estudante(s) — 🔴');
    expect(msg).not.toMatch(/Ana|Redes de Computadores\n/);
    expect(mensagemAssistencia(base)).toBeNull();
  });

  it('lista só as mensagens aplicáveis e gera link do WhatsApp', () => {
    expect(mensagensDaAusencia(base).map((m) => m.canal)).toEqual(['GRUPO_PROFESSORES', 'GRUPO_GESTAO_DIR_COORD']);
    expect(linkWhatsapp('Olá *turma*\nok')).toBe('https://wa.me/?text=Ol%C3%A1%20*turma*%0Aok');
  });
});
