import { describe, expect, it } from 'vitest';
import type { CanalMensagem } from '@/lib/ausencias/mensagens';
import { mensagensDeAlimentacao, type AvisoDoDia } from './mensagens';

const aviso = (mudar: Partial<AvisoDoDia> = {}): AvisoDoDia => ({
  codigoTurma: 'REDES-2',
  tipo: 'LANCHE_MANHA',
  acao: 'ADICIONAR_REFEICAO',
  quantidade: 22,
  nivel: 'VERDE_24H_MAIS',
  manual: true,
  descricao: 'Encontro de PEI',
  confirmado: false,
  ...mudar,
});
const canais: CanalMensagem[] = [
  { canal: 'ASSISTENCIA_ESTUDANTIL', email: 'cae@ifce.edu.br', saudacao: 'equipe da CAE', ativo: true },
  { canal: 'NUTRICIONISTA', email: 'nutri@ifce.edu.br', saudacao: null, ativo: true },
  { canal: 'GRUPO_GESTAO_DIR_COORD', email: null, saudacao: 'Gestão', ativo: true },
  { canal: 'LIDERES_TURMA', email: null, saudacao: 'líderes de turma', ativo: false },
];

describe('mensagens de alimentação do dia', () => {
  it('CAE, nutricionista e Gestão recebem o resumo; canal inativo fica de fora', () => {
    const msgs = mensagensDeAlimentacao({ dataISO: '2026-11-30', diaSemana: 'segunda-feira', avisos: [aviso()], canais, gatilho: 'acrescimo' });
    expect(msgs.map((m) => m.canal)).toEqual(['ASSISTENCIA_ESTUDANTIL', 'NUTRICIONISTA', 'GRUPO_GESTAO_DIR_COORD']);
    const cae = msgs[0];
    expect(cae.para).toBe('cae@ifce.edu.br');
    expect(cae.texto).toContain('Olá, equipe da CAE!');
    expect(cae.texto).toContain('Atualização: Refeição acrescentada.');
    expect(cae.texto).toContain('- REDES-2: ADICIONAR Lanche da manhã (09:30): 22 estudante(s) — 🟢 Planejado (24h+) · Encontro de PEI · ⏳ aguardando ciência');
    expect(cae.assunto).toBe('[SGC-Redes] Alimentação — REDES-2 — 30/11/2026');
    expect(msgs[1].texto).toContain('Olá, {{nome da nutricionista}}!');
  });

  it('turmas: sem quantidade, urgência nem motivo; emergência marcada para os setores', () => {
    const msgs = mensagensDeAlimentacao({
      dataISO: '2026-11-30',
      diaSemana: 'segunda-feira',
      avisos: [aviso({ acao: 'CANCELAR_REFEICAO', tipo: 'ALMOCO', nivel: 'VERMELHO_MENOS_4H', manual: false, descricao: null })],
      canais: canais.map((c) => ({ ...c, ativo: true })),
      gatilho: null,
    });
    const turma = msgs.find((m) => m.canal === 'LIDERES_TURMA')!;
    expect(turma.texto).toContain('- REDES-2: sem Almoço (12:00)');
    expect(turma.texto).not.toMatch(/estudante\(s\)|EMERGÊNCIA|🔴/);
    expect(msgs[0].texto).toContain('[EMERGÊNCIA]');
    expect(msgs[0].assunto.startsWith('[SGC-Redes] URGENTE:')).toBe(true);
  });

  it('sem avisos, nenhuma mensagem', () => {
    expect(mensagensDeAlimentacao({ dataISO: '2026-11-30', diaSemana: 'segunda-feira', avisos: [], canais, gatilho: null })).toEqual([]);
  });
});
