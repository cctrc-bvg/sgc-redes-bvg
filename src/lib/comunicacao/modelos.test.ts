import { describe, expect, it } from 'vitest';
import { camposPendentes, preencherCampos } from './mensagem';
import { MODELOS_TEXTO, modeloPorId, modelosDoTipo, TIPOS_INTERACAO, VARIAVEIS } from './modelos';

describe('textos-padrão', () => {
  it('todo tipo de interação tem ao menos um modelo, com ids únicos', () => {
    for (const t of TIPOS_INTERACAO) expect(modelosDoTipo(t).length).toBeGreaterThan(0);
    expect(new Set(MODELOS_TEXTO.map((m) => m.id)).size).toBe(MODELOS_TEXTO.length);
  });

  it('assuntos com prefixo do sistema e sem dados sensíveis', () => {
    for (const m of MODELOS_TEXTO) {
      expect(m.assunto.startsWith('[SGC-Redes] ')).toBe(true);
      expect(`${m.assunto} ${m.texto}`).not.toMatch(/motivo|saúde|laudo|CID/i);
    }
  });

  it('variáveis conhecidas são preenchidas; as demais viram campos', () => {
    const m = modeloPorId('convite_individual:formal')!;
    const t = preencherCampos(m.texto, { nome: 'Carla', turma: 'Redes 1', data: '26/11/2026', dia: 'quinta-feira', horarios: '- Manhã A', link: 'https://x/grade/minha' });
    expect(t).toContain('Prezado(a) Carla,');
    expect(camposPendentes(t)).toEqual([]);
    const reuniao = modeloPorId('reuniao:colegiado')!;
    expect(camposPendentes(reuniao.texto)).toEqual(['destinatarios', 'data da reunião', 'horário', 'local', 'pauta']);
  });

  it('modelos das mensagens geradas só usam variáveis que o sistema conhece', () => {
    const geradas = ['convite_grupo', 'convite_individual', 'substituicao', 'adiantamento', 'aviso_turma', 'alimentacao', 'ctp', 'gestao', 'docente_ausente', 'lembrete_diario'] as const;
    for (const t of geradas)
      for (const m of modelosDoTipo(t)) for (const c of camposPendentes(m.texto, m.assunto)) expect(Object.keys(VARIAVEIS)).toContain(c);
  });
});
