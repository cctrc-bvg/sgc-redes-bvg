/**
 * Calendário acadêmico: eventos, etapas (N1–N4) e contagem de dias letivos.
 * Dia letivo = segunda a sexta (ou sábado letivo) dentro do ano letivo e fora de evento que suspende aulas.
 * Meta do IF: 200 dias letivos no ano, em geral 50 por etapa.
 */
import type { TipoEventoCalendario } from '@prisma/client';
import * as z from 'zod';

export const DIAS_LETIVOS_ANO = 200;
export const DIAS_POR_ETAPA = 50;
export const ETAPAS = [1, 2, 3, 4] as const;
export const nomeEtapa = (n: number) => `N${n}`;

export const TIPOS_EVENTO = [
  'FERIAS_DOCENTES',
  'MATRICULA',
  'ENCONTRO_PEDAGOGICO',
  'AVALIACOES_FINAIS',
  'FERIADO',
  'PONTO_FACULTATIVO',
  'ACOLHIDA',
  'PITS_RITS',
  'REUNIAO',
  'SUSPENSAO_AULAS',
  'OUTRO',
] as const satisfies readonly TipoEventoCalendario[];

export const NOME_TIPO_EVENTO: Record<TipoEventoCalendario, string> = {
  FERIAS_DOCENTES: 'Férias docentes',
  MATRICULA: 'Matrícula',
  ENCONTRO_PEDAGOGICO: 'Encontro pedagógico',
  AVALIACOES_FINAIS: 'Avaliações finais e entrega de diários',
  FERIADO: 'Feriado',
  PONTO_FACULTATIVO: 'Ponto facultativo',
  ACOLHIDA: 'Acolhida',
  PITS_RITS: 'PITs/RITs',
  REUNIAO: 'Reunião',
  SUSPENSAO_AULAS: 'Suspensão de aulas (força maior)',
  OUTRO: 'Outro',
};

/** Se o tipo, por padrão, tira o dia do calendário letivo (pode ser mudado em cada evento, salvo os de SEMPRE_NAO_LETIVO). */
export const SUSPENDE_POR_PADRAO: Record<TipoEventoCalendario, boolean> = {
  FERIAS_DOCENTES: true,
  MATRICULA: false,
  ENCONTRO_PEDAGOGICO: true,
  AVALIACOES_FINAIS: true,
  FERIADO: true,
  PONTO_FACULTATIVO: true,
  ACOLHIDA: false,
  PITS_RITS: false,
  REUNIAO: false,
  SUSPENSAO_AULAS: true,
  OUTRO: false,
};

/**
 * Tipos que nunca contam como dias letivos e não têm aula regular pela grade, qualquer que seja a marcação do evento.
 * Avaliações finais (decisão de 25/11/2026): só no fim do ano, depois da última semana letiva (também nas disciplinas
 * semestrais), podendo cair em sábado; esses dias não são letivos.
 */
export const SEMPRE_NAO_LETIVO: readonly TipoEventoCalendario[] = ['AVALIACOES_FINAIS'];

/** Situação das aulas num evento, para listas e impressão. */
export function situacaoDasAulas(e: { tipo: TipoEventoCalendario; suspendeAulas: boolean }): string {
  if (SEMPRE_NAO_LETIVO.includes(e.tipo)) return 'Não letivo (avaliações)';
  return e.suspendeAulas ? 'Sem aula' : 'Mantidas';
}

/** Classes de cor (fundo + borda) por tipo; sempre acompanhadas de texto (não só cor). */
export const COR_TIPO_EVENTO: Record<TipoEventoCalendario, string> = {
  FERIAS_DOCENTES: 'bg-sky-100 border-sky-400',
  MATRICULA: 'bg-violet-100 border-violet-400',
  ENCONTRO_PEDAGOGICO: 'bg-amber-100 border-amber-400',
  AVALIACOES_FINAIS: 'bg-orange-100 border-orange-400',
  FERIADO: 'bg-red-100 border-red-400',
  PONTO_FACULTATIVO: 'bg-rose-100 border-rose-400',
  ACOLHIDA: 'bg-teal-100 border-teal-400',
  PITS_RITS: 'bg-indigo-100 border-indigo-400',
  REUNIAO: 'bg-slate-200 border-slate-400',
  SUSPENSAO_AULAS: 'bg-red-200 border-red-600',
  OUTRO: 'bg-stone-100 border-stone-400',
};

/** Motivos de suspensão não prevista (força maior); sem dados pessoais. */
export const MOTIVOS_SUSPENSAO = [
  'Ponto facultativo municipal',
  'Falta de energia',
  'Falta de água',
  'Falta de transporte',
  'Luto oficial',
  'Condições climáticas',
  'Outro motivo de força maior',
] as const;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (v: string) => DATA.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().startsWith(v);

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Datas como "aaaa-mm-dd" (sem fuso). */
export function somarDiasISO(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export const diaDaSemanaISO = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0=domingo
export function* datasEntre(inicio: string, fim: string): Generator<string> {
  for (let d = inicio; d <= fim; d = somarDiasISO(d, 1)) yield d;
}
export const diasNoIntervalo = (inicio: string, fim: string) => Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86_400_000) + 1;

export const EventoSchema = z
  .object({
    tipo: z.enum(TIPOS_EVENTO, { error: 'Escolha o tipo.' }),
    inicio: z.string().trim().refine(dataValida, { error: 'Informe a data de início.' }),
    fim: z.string().trim().refine((v) => v === '' || dataValida(v), { error: 'Data de término inválida.' }),
    descricao: z.string().trim().max(120, { error: 'Use até 120 caracteres.' }),
    suspendeAulas: z.boolean(),
    imprevisto: z.boolean(),
    motivo: z.string().trim().max(60),
  })
  .transform((v) => ({ ...v, fim: v.fim || v.inicio, suspendeAulas: SEMPRE_NAO_LETIVO.includes(v.tipo) || v.suspendeAulas }))
  .superRefine((v, ctx) => {
    if (v.fim < v.inicio) ctx.addIssue({ code: 'custom', path: ['fim'], message: 'O término não pode ser antes do início.' });
    else if (diasNoIntervalo(v.inicio, v.fim) > 120) ctx.addIssue({ code: 'custom', path: ['fim'], message: 'Use períodos de até 120 dias.' });
    if (v.tipo === 'SUSPENSAO_AULAS' && !(MOTIVOS_SUSPENSAO as readonly string[]).includes(v.motivo))
      ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Escolha o motivo da suspensão.' });
    if (v.tipo === 'OUTRO' && v.descricao.length < 3) ctx.addIssue({ code: 'custom', path: ['descricao'], message: 'Descreva o evento.' });
  });
export type DadosEvento = z.output<typeof EventoSchema>;

/** Períodos de um ano letivo: 2 semestres e 4 etapas, sem sobreposição e em ordem. */
export interface Intervalo {
  inicio: string;
  fim: string;
}
export function validarSequencia(rotulos: readonly string[], intervalos: readonly (Intervalo | null)[]): Record<number, string> {
  const erros: Record<number, string> = {};
  let anterior: Intervalo | null = null;
  intervalos.forEach((i, k) => {
    if (!i) return;
    if (!dataValida(i.inicio) || !dataValida(i.fim)) erros[k] = 'Informe início e término.';
    else if (i.fim < i.inicio) erros[k] = 'O término não pode ser antes do início.';
    else if (anterior && i.inicio <= anterior.fim) erros[k] = `Começa antes do fim de ${rotulos[k - 1]}.`;
    if (!erros[k]) anterior = i;
  });
  return erros;
}

export interface EventoContagem extends Intervalo {
  suspendeAulas: boolean;
  imprevisto: boolean;
}

export interface Contagem {
  /** Dias letivos do intervalo, em ordem. */
  letivos: string[];
  /** Dias que seriam letivos, mas foram suspensos por evento imprevisto (a repor). */
  perdidosImprevistos: string[];
  /** Sábados letivos contados. */
  sabados: string[];
  /** Domingos letivos contados (situação extraordinária). */
  domingos: string[];
}

/**
 * Conta os dias letivos entre início e fim: segunda a sexta, sábados e domingos letivos, menos os dias cobertos por
 * eventos que suspendem aulas. Um sábado letivo dentro de suspensão também não conta.
 */
export function contarDiasLetivos(p: {
  inicio: string;
  fim: string;
  eventos: readonly EventoContagem[];
  sabadosLetivos: ReadonlySet<string>;
  /** Períodos com aula (etapas ou semestres); datas fora deles (recesso) não contam. */
  periodos?: readonly Intervalo[];
}): Contagem {
  const suspensos = new Map<string, boolean>(); // data → só imprevisto?
  for (const e of p.eventos) {
    if (!e.suspendeAulas) continue;
    const de = e.inicio > p.inicio ? e.inicio : p.inicio;
    const ate = e.fim < p.fim ? e.fim : p.fim;
    for (const d of datasEntre(de, ate)) suspensos.set(d, (suspensos.get(d) ?? true) && e.imprevisto);
  }
  const c: Contagem = { letivos: [], perdidosImprevistos: [], sabados: [], domingos: [] };
  if (p.fim < p.inicio) return c;
  for (const d of datasEntre(p.inicio, p.fim)) {
    const dia = diaDaSemanaISO(d);
    const seria = (dia >= 1 && dia <= 5) || ((dia === 6 || dia === 0) && p.sabadosLetivos.has(d));
    if (!seria) continue;
    if (p.periodos?.length && !p.periodos.some((i) => i.inicio <= d && d <= i.fim)) continue;
    if (suspensos.has(d)) {
      if (suspensos.get(d)) c.perdidosImprevistos.push(d);
      continue;
    }
    c.letivos.push(d);
    if (dia === 6) c.sabados.push(d);
    if (dia === 0) c.domingos.push(d);
  }
  return c;
}

/**
 * Avaliações finais fora do lugar: elas acontecem só no fim do ano, depois da última semana letiva. Avisa quando
 * ainda há dia letivo depois do fim de um período de avaliações finais (ex.: cadastrado no meio do ano).
 */
export function avisosAvaliacoesFinais(eventos: readonly (Intervalo & { tipo: TipoEventoCalendario })[], letivos: readonly string[]): string[] {
  const ultimoLetivo = letivos.length ? letivos[letivos.length - 1] : null;
  if (!ultimoLetivo) return [];
  return eventos
    .filter((e) => e.tipo === 'AVALIACOES_FINAIS' && e.fim < ultimoLetivo)
    .map(
      (e) =>
        `Avaliações finais de ${formatarISO(e.inicio)} a ${formatarISO(e.fim)} estão antes do fim do ano letivo (último dia letivo: ${formatarISO(ultimoLetivo)}). Elas acontecem só no fim do ano, depois da última semana letiva, também para as disciplinas semestrais.`,
    );
}

/**
 * Início sugerido para as avaliações finais: o dia seguinte ao último dia letivo (domingo passa para segunda).
 * Elas costumam vir encadeadas depois da última semana letiva; os prazos entre elas são combinados pelos docentes.
 */
export function inicioSugeridoAvaliacoes(letivos: readonly string[]): string | null {
  if (letivos.length === 0) return null;
  let d = somarDiasISO(letivos[letivos.length - 1], 1);
  if (diaDaSemanaISO(d) === 0) d = somarDiasISO(d, 1);
  return d;
}

const formatarISO = (iso: string) => iso.split('-').reverse().join('/');

/** Reposição de aulas (ROD, Art. 37, § 2º): 15 dias letivos ou até o fim da etapa, o que ocorrer primeiro. */
export const DIAS_LETIVOS_REPOSICAO = 15;

export interface PrazoReposicao {
  /** Último dia para repor ("AAAA-MM-DD"). */
  prazo: string;
  /** O que fechou o prazo: os 15 dias letivos, o fim da etapa ou o fim do ano letivo (sem mais dias letivos). */
  motivo: 'dias' | 'etapa' | 'fim-do-ano';
  /** Número da etapa (N1–N4) quando o prazo é o fim dela. */
  etapa?: number;
}

/**
 * Prazo para repor aulas perdidas em `dataAula`: o 15º dia letivo depois dela ou o último dia da etapa em que ela
 * caiu, o que vier primeiro. `letivos` são os dias letivos do ano em ordem (de `contarDiasLetivos`). Sem etapas
 * cadastradas, só vale a contagem de dias; sem dias letivos depois da aula, o prazo é o último dia letivo.
 */
export function prazoDeReposicao(dataAula: string, letivos: readonly string[], etapas: readonly (Intervalo | null)[]): PrazoReposicao | null {
  const depois = letivos.filter((d) => d > dataAula);
  const dosDias = depois.length >= DIAS_LETIVOS_REPOSICAO ? depois[DIAS_LETIVOS_REPOSICAO - 1] : null;
  const i = etapas.findIndex((e) => e !== null && e.inicio <= dataAula && dataAula <= e.fim);
  const fimDaEtapa = i >= 0 ? etapas[i]!.fim : null;
  if (dosDias && (!fimDaEtapa || dosDias <= fimDaEtapa)) return { prazo: dosDias, motivo: 'dias' };
  if (fimDaEtapa) return { prazo: fimDaEtapa, motivo: 'etapa', etapa: i + 1 };
  if (depois.length > 0) return { prazo: depois[depois.length - 1], motivo: 'fim-do-ano' };
  return null;
}

/** "até 12/12/2026 (15 dias letivos)" ou "(fim da N2)". */
export function textoPrazoReposicao(p: PrazoReposicao): string {
  const motivo = p.motivo === 'dias' ? `${DIAS_LETIVOS_REPOSICAO} dias letivos` : p.motivo === 'etapa' ? `fim da ${nomeEtapa(p.etapa!)}` : 'fim do ano letivo';
  return `até ${p.prazo.split('-').reverse().join('/')} (${motivo})`;
}

/** Dias letivos por mês ("aaaa-mm" → quantidade). */
export function porMes(letivos: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of letivos) m.set(d.slice(0, 7), (m.get(d.slice(0, 7)) ?? 0) + 1);
  return m;
}

/** Quantos dias da lista caem no intervalo. */
export const dentro = (lista: readonly string[], i: Intervalo) => lista.filter((d) => d >= i.inicio && d <= i.fim).length;

/** Evento que suspende aulas numa data (o primeiro, se houver vários). */
export function suspensaoNaData<T extends EventoContagem>(dataISO: string, eventos: readonly T[]): T | null {
  return eventos.find((e) => e.suspendeAulas && e.inicio <= dataISO && dataISO <= e.fim) ?? null;
}

/** Semanas de um mês para a grade do calendário (domingo a sábado); null fora do mês. */
export function semanasDoMes(ano: number, mes: number): (string | null)[][] {
  const primeiro = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const semanas: (string | null)[][] = [];
  let semana: (string | null)[] = Array(diaDaSemanaISO(primeiro)).fill(null);
  for (let d = 1; d <= dias; d++) {
    semana.push(`${primeiro.slice(0, 8)}${String(d).padStart(2, '0')}`);
    if (semana.length === 7) {
      semanas.push(semana);
      semana = [];
    }
  }
  if (semana.length > 0) semanas.push([...semana, ...Array(7 - semana.length).fill(null)]);
  return semanas;
}

/** Intervalo do ano letivo: das etapas (N1 a N4) ou, sem elas, dos semestres. */
export function intervaloDoAno(etapas: readonly (Intervalo | null)[], semestres: readonly (Intervalo | null)[]): Intervalo | null {
  for (const lista of [etapas, semestres]) {
    const v = lista.filter((x): x is Intervalo => x !== null);
    if (v.length > 0) return { inicio: v.map((x) => x.inicio).sort()[0], fim: v.map((x) => x.fim).sort().at(-1)! };
  }
  return null;
}
