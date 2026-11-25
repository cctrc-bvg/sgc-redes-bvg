/**
 * Períodos especiais (jogos internos, encontro dos servidores, eventos externos): a rotina muda por alguns dias, com
 * grade temporária por turma e menos estudantes no campus. Funções puras: validação do período, grade que vale na
 * data e plano alimentar por turma e dia.
 */
import * as z from 'zod';
import type { TipoRefeicao } from '@prisma/client';
import { calcularRefeicoesPrevistas } from '@/lib/alimentacao-engine';
import { datasEntre, diasNoIntervalo } from '@/lib/calendario/regras';

export const TIPOS_PERIODO = [
  'JOGOS_INTERNOS',
  'ENCONTRO_SERVIDORES',
  'UNIVERSO_FCE',
  'SEMANA_DO_CURSO',
  'SEMANA_OUTROS_CURSOS',
  'ENCONTRO_EXTENSAO',
  'ENCONTRO_PESQUISA',
  'EVENTO_EXTERNO',
  'OUTRO',
] as const;
export type TipoPeriodo = (typeof TIPOS_PERIODO)[number];

export const NOME_TIPO_PERIODO: Record<TipoPeriodo, string> = {
  JOGOS_INTERNOS: 'Jogos internos',
  ENCONTRO_SERVIDORES: 'Encontro dos servidores',
  UNIVERSO_FCE: 'Universo e FCE',
  SEMANA_DO_CURSO: 'Semana do Curso de Redes',
  SEMANA_OUTROS_CURSOS: 'Semana de outros cursos',
  ENCONTRO_EXTENSAO: 'Encontro de extensão',
  ENCONTRO_PESQUISA: 'Encontro de pesquisa',
  EVENTO_EXTERNO: 'Evento externo',
  OUTRO: 'Outro',
};

export const MAX_DIAS_PERIODO = 15;

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Informe uma data válida.' });

export const PeriodoSchema = z
  .object({
    nome: z.string().trim().min(3, { error: 'Dê um nome com pelo menos 3 letras.' }).max(80, { error: 'Use no máximo 80 caracteres.' }),
    tipo: z.enum(TIPOS_PERIODO, { error: 'Escolha o tipo do período.' }),
    inicio: data,
    fim: data,
    observacao: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().trim().max(300, { error: 'Use no máximo 300 caracteres.' }).optional(),
    ),
  })
  .superRefine((p, ctx) => {
    if (p.fim < p.inicio) ctx.addIssue({ code: 'custom', path: ['fim'], message: 'O fim deve ser no mesmo dia ou depois do início.' });
    else if (diasNoIntervalo(p.inicio, p.fim) > MAX_DIAS_PERIODO) ctx.addIssue({ code: 'custom', path: ['fim'], message: `O período pode ter no máximo ${MAX_DIAS_PERIODO} dias.` });
  });

export interface IntervaloPeriodo {
  id: string;
  inicio: string;
  fim: string;
}

/** Período que cobre a data, se houver (o mais recente cadastrado vence em caso de sobreposição). */
export function periodoNaData<T extends IntervaloPeriodo>(dataISO: string, periodos: readonly T[]): T | null {
  return [...periodos].reverse().find((p) => p.inicio <= dataISO && dataISO <= p.fim) ?? null;
}

/** Dias de aula do período: segunda a sexta em que há dia letivo (feriados e suspensões ficam de fora). */
export function diasDoPeriodo(inicio: string, fim: string, letivos: ReadonlySet<string>): string[] {
  return [...datasEntre(inicio, fim)].filter((d) => letivos.has(d));
}

export interface CelulaEspecial {
  diaSemana: number;
  turno: 'MANHA' | 'TARDE';
  ofertaId: string | null;
}

/** Turnos em que a turma tem aula num dia da semana, pela grade especial. */
export function turnosComAula(celulas: readonly CelulaEspecial[], diaSemana: number) {
  const doDia = celulas.filter((c) => c.diaSemana === diaSemana && c.ofertaId !== null);
  return { temAulaManha: doDia.some((c) => c.turno === 'MANHA'), temAulaTarde: doDia.some((c) => c.turno === 'TARDE') };
}

export type QuantidadePorRefeicao = Record<TipoRefeicao, number>;
export const REFEICOES_ZERADAS = (): QuantidadePorRefeicao => ({ LANCHE_MANHA: 0, ALMOCO: 0, LANCHE_TARDE: 0 });

export interface TurmaDoPlano {
  codigo: string;
  /** Estimativa normal de refeições da turma (Turma.qtdMedia*), para comparar com o plano do período. */
  normal: QuantidadePorRefeicao;
  celulas: readonly CelulaEspecial[];
  /** Estudantes no campus por data (ISO). Sem registro, vale o total de estudantes ativos. */
  presentes: ReadonlyMap<string, number>;
  ativos: number;
}

export interface LinhaPlano {
  data: string;
  turmas: { codigo: string; presentes: number; refeicoes: QuantidadePorRefeicao }[];
  total: QuantidadePorRefeicao;
  /** Total de um dia normal (grade normal e todos presentes), para a diferença. */
  totalNormal: QuantidadePorRefeicao;
}

/**
 * Plano alimentar do período: por dia e turma, as refeições previstas pela regra do campus (só manhã, só tarde ou
 * integral) sobre a grade especial, vezes os estudantes presentes. Dia da semana vem de `diaDaSemana` (1 a 5).
 */
export function planoAlimentar(dias: readonly string[], turmas: readonly TurmaDoPlano[], diaDaSemana: (dataISO: string) => number): LinhaPlano[] {
  return dias.map((data) => {
    const total = REFEICOES_ZERADAS();
    const totalNormal = REFEICOES_ZERADAS();
    const linhas = turmas.map((t) => {
      const presentes = t.presentes.get(data) ?? t.ativos;
      const refeicoes = REFEICOES_ZERADAS();
      for (const r of calcularRefeicoesPrevistas(turnosComAula(t.celulas, diaDaSemana(data)))) {
        refeicoes[r] = presentes;
        total[r] += presentes;
      }
      for (const r of Object.keys(t.normal) as TipoRefeicao[]) totalNormal[r] += t.normal[r];
      return { codigo: t.codigo, presentes, refeicoes };
    });
    return { data, turmas: linhas, total, totalNormal };
  });
}

/** Valida a quantidade de estudantes presentes: inteiro entre 0 e o total de ativos da turma. */
export function validarPresentes(texto: string, ativos: number): { erro: string } | { valor: number } {
  if (!/^\d{1,3}$/.test(texto.trim())) return { erro: 'Informe um número inteiro.' };
  const valor = Number(texto);
  return valor > ativos ? { erro: `A turma tem ${ativos} estudantes ativos.` } : { valor };
}

const ROTULO_REFEICAO: Record<TipoRefeicao, string> = { LANCHE_MANHA: 'lanche da manhã', ALMOCO: 'almoço', LANCHE_TARDE: 'lanche da tarde' };

/** Texto do resumo ao CAE e à nutricionista: por dia, as quantidades de cada refeição e a diferença para o normal. */
export function mensagemPlanoAlimentar(p: { nome: string; inicio: string; fim: string; plano: readonly LinhaPlano[] }): string {
  const br = (iso: string) => iso.split('-').reverse().join('/');
  const L = [`Planejamento de refeições — ${p.nome} (${br(p.inicio)} a ${br(p.fim)}).`, 'As quantidades abaixo substituem a previsão normal nestes dias, conforme a grade temporária e os estudantes que ficam no campus.', ''];
  for (const d of p.plano) {
    const partes = (Object.keys(ROTULO_REFEICAO) as TipoRefeicao[]).map((r) => `${ROTULO_REFEICAO[r]}: ${d.total[r]} (normal ${d.totalNormal[r]})`);
    L.push(`*${br(d.data)}* — ${partes.join('; ')}.`);
  }
  L.push('', 'Qualquer ajuste será avisado com a antecedência possível. Obrigado!', 'Coordenação do Curso Técnico em Redes de Computadores');
  return L.join('\n');
}
