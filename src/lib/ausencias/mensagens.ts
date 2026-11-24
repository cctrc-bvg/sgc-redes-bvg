/**
 * Mensagens de WhatsApp geradas a partir de uma ausência (RF05, G07: modo semiautomático).
 * Sem dados sensíveis: só o motivo operacional escolhido numa lista fechada (RF02, LGPD).
 */
import type { CanalWhatsapp, NivelUrgenciaSla, StatusAusencia, TipoRefeicao } from '@prisma/client';
import { deveAvisarGestao, formatarData, NOME_STATUS } from './regras';

export const NOME_REFEICAO_HORARIO: Record<TipoRefeicao, string> = {
  LANCHE_MANHA: 'Lanche da manhã (09:30)',
  ALMOCO: 'Almoço (12:00)',
  LANCHE_TARDE: 'Lanche da tarde (15:00)',
};

export const ETIQUETA_SLA: Record<NivelUrgenciaSla, string> = {
  VERDE_24H_MAIS: '🟢 Planejado (24h+)',
  AMARELO_4H_A_24H: '🟡 Imprevisto moderado (4h–24h)',
  VERMELHO_MENOS_4H: '🔴 Emergência (< 4h)',
};

/** Linha de cada horário perdido, já descrita (ex.: "Manhã A (07:30–08:30): aula com substituto"). */
export interface LinhaHorario {
  bloco: string;
  situacao: 'pendente' | 'substituicao' | 'adiantamento' | 'dispensa';
  /** Substituição: nome do substituto. Adiantamento: "Disciplina (de Tarde A)". */
  detalhe?: string;
}

export interface DadosMensagem {
  turma: string;
  codigoTurma: string;
  dataISO: string;
  diaSemana: string; // "quinta-feira"
  disciplina: string;
  professor: string;
  motivoOperacional: string;
  status: StatusAusencia;
  horarios: readonly LinhaHorario[];
  /** Avisos de refeição ativos da turma no dia. */
  refeicoes: readonly { tipo: TipoRefeicao; acao: 'CANCELAR_REFEICAO' | 'ADICIONAR_REFEICAO'; quantidade: number; nivel: NivelUrgenciaSla }[];
}

const cabecalhoData = (d: DadosMensagem) => `${formatarData(d.dataISO)} (${d.diaSemana})`;

function textoHorario(h: LinhaHorario, paraEstudantes: boolean): string {
  switch (h.situacao) {
    case 'substituicao':
      return paraEstudantes ? 'aula normal, com professor(a) substituto(a)' : `substituição por ${h.detalhe}`;
    case 'adiantamento':
      return `aula adiantada: ${h.detalhe}`;
    case 'dispensa':
      return 'sem aula (turma dispensada neste horário)';
    default:
      return paraEstudantes ? 'a confirmar' : 'sem cobertura definida';
  }
}

/** Grupo de professores: convite para cobrir os horários ainda sem decisão. */
export function mensagemProfessores(d: DadosMensagem): string | null {
  const pendentes = d.horarios.filter((h) => h.situacao === 'pendente');
  if (pendentes.length === 0) return null;
  return [
    '*CONVITE DE SUBSTITUIÇÃO — COORD. REDES DE COMPUTADORES*',
    `Turma: *${d.turma}*`,
    `Data: *${cabecalhoData(d)}*`,
    `Disciplina: ${d.disciplina}`,
    'Horários sem cobertura:',
    ...pendentes.map((h) => `- ${h.bloco}`),
    'Quem puder assumir ou adiantar uma aula, por favor responda à Coordenação.',
  ].join('\n');
}

/** Líderes de turma: o que muda no horário da turma (sem nomes de docentes). */
export function mensagemLideres(d: DadosMensagem): string | null {
  const decididos = d.horarios.filter((h) => h.situacao !== 'pendente');
  if (decididos.length === 0) return null;
  return [
    `*AVISO À TURMA ${d.codigoTurma}* — Coord. Redes de Computadores`,
    `Data: *${cabecalhoData(d)}*`,
    'Mudanças no horário:',
    ...d.horarios.map((h) => `- ${h.bloco}: ${textoHorario(h, true)}`),
    'Repassem à turma, por favor.',
  ].join('\n');
}

/** Grupo da Gestão (G08): só dispensas, impacto alimentar ou aula sem cobertura. */
export function mensagemGestao(d: DadosMensagem): string | null {
  if (!deveAvisarGestao(d.status, d.refeicoes.length > 0)) return null;
  return [
    '*INFORME À GESTÃO — COORD. REDES DE COMPUTADORES*',
    `Turma: *${d.turma}* · ${cabecalhoData(d)}`,
    `Docente: ${d.professor} · ${d.disciplina}`,
    `Motivo operacional: ${d.motivoOperacional}`,
    `Situação: ${NOME_STATUS[d.status]}`,
    ...d.horarios.map((h) => `- ${h.bloco}: ${textoHorario(h, false)}`),
    ...(d.refeicoes.length > 0 ? ['Alimentação: Assistência Estudantil avisada pelo sistema.'] : []),
  ].join('\n');
}

/** Assistência Estudantil: só turma, data, refeições, quantidades e urgência (minimização, LGPD). */
export function mensagemAssistencia(d: DadosMensagem): string | null {
  if (d.refeicoes.length === 0) return null;
  const emergencia = d.refeicoes.some((r) => r.nivel === 'VERMELHO_MENOS_4H');
  return [
    `*AVISO DE REPLANEJAMENTO ALIMENTAR — COORD. REDES DE COMPUTADORES*${emergencia ? ' [EMERGÊNCIA]' : d.refeicoes.some((r) => r.nivel === 'AMARELO_4H_A_24H') ? ' [IMPREVISTO]' : ''}`,
    `Turma: *${d.codigoTurma}*`,
    `Data: *${cabecalhoData(d)}*`,
    ...d.refeicoes.map(
      (r) => `- ${r.acao === 'CANCELAR_REFEICAO' ? 'CANCELAR' : 'ADICIONAR'} *${NOME_REFEICAO_HORARIO[r.tipo]}*: ${r.quantidade} estudante(s) — ${ETIQUETA_SLA[r.nivel]}`,
    ),
    `Motivo operacional: ${d.motivoOperacional}`,
    '_Aviso também disponível no painel de Alimentação do SGC-Redes._',
  ].join('\n');
}

export const NOME_CANAL: Record<CanalWhatsapp, string> = {
  GRUPO_PROFESSORES: 'Grupo de professores',
  GRUPO_GESTAO_DIR_COORD: 'Gestão (Direção e Coordenações)',
  ASSISTENCIA_ESTUDANTIL: 'Assistência Estudantil',
  CTP: 'CTP',
  LIDERES_TURMA: 'Líderes das turmas',
};

/** Mensagens aplicáveis à ausência, na ordem em que costumam ser enviadas. */
export function mensagensDaAusencia(d: DadosMensagem): { canal: CanalWhatsapp; texto: string }[] {
  const lista: { canal: CanalWhatsapp; texto: string | null }[] = [
    { canal: 'GRUPO_PROFESSORES', texto: mensagemProfessores(d) },
    { canal: 'ASSISTENCIA_ESTUDANTIL', texto: mensagemAssistencia(d) },
    { canal: 'LIDERES_TURMA', texto: mensagemLideres(d) },
    { canal: 'GRUPO_GESTAO_DIR_COORD', texto: mensagemGestao(d) },
  ];
  return lista.filter((m): m is { canal: CanalWhatsapp; texto: string } => m.texto !== null);
}

/** Link do WhatsApp com o texto pronto; o usuário escolhe o grupo ao abrir (modo semiautomático). */
export const linkWhatsapp = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
