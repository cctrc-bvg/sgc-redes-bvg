/**
 * Mensagens das alterações de refeição de um dia (painel de Alimentação): depois de acrescentar,
 * ajustar ou dar ciência, a Coordenação encaminha o resumo à CAE, à nutricionista, à Gestão e às turmas.
 * Só turma, refeição, quantidade e urgência (sem docente nem estudante: LGPD).
 */
import type { AcaoAlimentacao, CanalWhatsapp, NivelUrgenciaSla, TipoRefeicao } from '@prisma/client';
import { ETIQUETA_SLA, NOME_CANAL, NOME_REFEICAO_HORARIO, CAMPO_SAUDACAO, type CanalMensagem } from '@/lib/ausencias/mensagens';
import { formatarData } from '@/lib/ausencias/regras';
import { saudacao, type MensagemPronta } from '@/lib/comunicacao/mensagem';
import type { TipoInteracao } from '@/lib/comunicacao/modelos';

export interface AvisoDoDia {
  codigoTurma: string;
  tipo: TipoRefeicao;
  acao: AcaoAlimentacao;
  quantidade: number;
  nivel: NivelUrgenciaSla;
  manual: boolean;
  /** Motivo do acréscimo (ex.: "Encontro de PEI"), sem dados de estudante. */
  descricao: string | null;
  confirmado: boolean;
}

export const GATILHOS = {
  acrescimo: 'Refeição acrescentada',
  ajuste: 'Quantidade ajustada',
  ciencia: 'Ciência da Assistência Estudantil registrada',
} as const;
export type Gatilho = keyof typeof GATILHOS;
export const lerGatilho = (v: unknown): Gatilho | null => (typeof v === 'string' && v in GATILHOS ? (v as Gatilho) : null);

/** Ordem de envio: quem prepara a refeição primeiro, depois a Gestão e as turmas. */
const CANAIS: { canal: CanalWhatsapp; titulo: string }[] = [
  { canal: 'ASSISTENCIA_ESTUDANTIL', titulo: 'AVISO DE ALIMENTAÇÃO' },
  { canal: 'NUTRICIONISTA', titulo: 'AVISO À NUTRICIONISTA — ALIMENTAÇÃO' },
  { canal: 'GRUPO_GESTAO_DIR_COORD', titulo: 'INFORME À GESTÃO — ALIMENTAÇÃO' },
  { canal: 'LIDERES_TURMA', titulo: 'AVISO ÀS TURMAS — LANCHES E ALMOÇO' },
];

const linha = (a: AvisoDoDia, paraTurma: boolean) => {
  const acao = a.acao === 'CANCELAR_REFEICAO' ? (paraTurma ? 'sem' : 'CANCELAR') : paraTurma ? 'com' : 'ADICIONAR';
  const extra = paraTurma ? '' : ` — ${ETIQUETA_SLA[a.nivel]}${a.descricao ? ` · ${a.descricao}` : ''}${a.confirmado ? ' · ✔ ciência da CAE' : ' · ⏳ aguardando ciência'}`;
  return `- ${a.codigoTurma}: ${acao} ${NOME_REFEICAO_HORARIO[a.tipo]}${paraTurma ? '' : `: ${a.quantidade} estudante(s)`}${extra}`;
};

/** Mensagens do dia para os grupos/setores ativos; nada quando não há aviso ativo. */
export function mensagensDeAlimentacao(p: {
  dataISO: string;
  diaSemana: string;
  avisos: readonly AvisoDoDia[];
  canais: readonly CanalMensagem[];
  gatilho: Gatilho | null;
}): MensagemPronta[] {
  if (p.avisos.length === 0) return [];
  const cfg = new Map(p.canais.map((c) => [c.canal, c]));
  const data = `${formatarData(p.dataISO)} (${p.diaSemana})`;
  const turmas = [...new Set(p.avisos.map((a) => a.codigoTurma))].sort();
  const emergencia = p.avisos.some((a) => a.nivel === 'VERMELHO_MENOS_4H');
  const tipo: TipoInteracao = 'alimentacao';
  const lista: MensagemPronta[] = [];
  for (const { canal, titulo } of CANAIS) {
    const c = cfg.get(canal);
    if (c && !c.ativo) continue;
    const paraTurma = canal === 'LIDERES_TURMA';
    const linhas = p.avisos.map((a) => linha(a, paraTurma));
    const corpo = [
      `*${titulo} — COORD. REDES DE COMPUTADORES*${emergencia && !paraTurma ? ' [EMERGÊNCIA]' : ''}`,
      `Data: *${data}*`,
      ...(p.gatilho && !paraTurma ? [`Atualização: ${GATILHOS[p.gatilho]}.`] : []),
      paraTurma ? 'Refeições do dia:' : 'Alterações de refeição:',
      ...linhas,
      paraTurma ? 'Repassem à turma, por favor.' : '_Detalhes no painel de Alimentação do SGC-Redes._',
    ].join('\n');
    lista.push({
      chave: `alimentacao:${canal}`,
      titulo: NOME_CANAL[canal],
      canal,
      destino: NOME_CANAL[canal],
      para: c?.email ?? null,
      whatsapp: null,
      aceitaWhatsapp: true,
      assunto: `[SGC-Redes] ${emergencia ? 'URGENTE: ' : ''}Alimentação — ${turmas.join(', ')} — ${formatarData(p.dataISO)}`,
      texto: `${saudacao(c?.saudacao, CAMPO_SAUDACAO[canal])}\n\n${corpo}`,
      tipo,
      variaveis: {
        data: formatarData(p.dataISO),
        dia: p.diaSemana,
        'codigo da turma': turmas.join(', '),
        refeicoes: linhas.join('\n'),
        ...(c?.saudacao ? { destinatarios: c.saudacao } : {}),
      },
    });
  }
  return lista;
}
