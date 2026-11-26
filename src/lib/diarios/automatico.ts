/**
 * Progressão automática dos diários (RF08-A, G25). O docente pode não usar o sistema: as aulas são
 * presumidas dadas pela grade vigente nos dias letivos já decorridos, e só as exceções são registradas.
 * Regras puras: quem chama entrega os dias letivos (`contarDiasLetivos`) e as células da grade da oferta.
 */
import { diaDaGradeNaData } from '@/lib/grade/regras';

export interface EntradaPresumido {
  /** Aulas (células da grade) da oferta em cada dia da semana (1=segunda … 5=sexta). */
  celulasPorDia: ReadonlyMap<number, number>;
  /** Dias letivos do período, em ISO (já sem feriados, suspensões e avaliações finais). */
  letivos: readonly string[];
  /** Sábados letivos: data → dia de referência da grade (G14). */
  sabadosLetivos: ReadonlyMap<string, number>;
}

/** Aulas que a grade gera nos dias informados. */
export function aulasNaGrade(e: EntradaPresumido, filtro: (dataISO: string) => boolean = () => true): number {
  let total = 0;
  for (const d of e.letivos) {
    if (!filtro(d)) continue;
    const dia = diaDaGradeNaData(d, e.sabadosLetivos);
    if (dia !== null) total += e.celulasPorDia.get(dia) ?? 0;
  }
  return total;
}

/**
 * Aulas presumidas dadas até hoje: só os dias anteriores a hoje (a aula de hoje ainda pode não ter ocorrido),
 * menos as dispensadas sem reposição. Substituição e adiantamento contam como dadas. Nunca passa das previstas.
 */
export function aulasPresumidas(e: EntradaPresumido & { hojeISO: string; desdeISO?: string; dispensadas?: number; previstas?: number }): number {
  const dadas = aulasNaGrade(e, (d) => d < e.hojeISO && (!e.desdeISO || d >= e.desdeISO)) - (e.dispensadas ?? 0);
  const liquido = Math.max(0, dadas);
  return e.previstas === undefined ? liquido : Math.min(liquido, e.previstas);
}

/** Aulas que a grade ainda comporta de hoje até o fim do período (hoje incluído). */
export function aulasRestantesNaGrade(e: EntradaPresumido & { hojeISO: string }): number {
  return aulasNaGrade(e, (d) => d >= e.hojeISO);
}

/**
 * Problema estrutural: o que já foi dado mais o que a grade ainda comporta não chega às previstas.
 * Devolve quantas aulas faltam na projeção (0 = a grade comporta).
 */
export function deficitProjetado(p: { ministradas: number; restantesNaGrade: number; previstas: number }): number {
  return Math.max(0, p.previstas - (p.ministradas + p.restantesNaGrade));
}

/** Valor efetivo: o lançado à mão, se a Coordenação marcou; senão o presumido. */
export const ministradasEfetivas = (o: { ministradasManual: boolean; aulasMinistradas: number }, presumido: number) =>
  o.ministradasManual ? o.aulasMinistradas : presumido;

/**
 * Datas das aulas que o substituto conta na própria disciplina, por oferta. Vale a disciplina registrada na decisão;
 * em registros antigos (sem ela), só quando ele tem uma única oferta na turma.
 */
export function creditosDeSubstituicao(
  coberturas: readonly { substitutoId: string; turmaId: string; ofertaId?: string | null; dataISO: string }[],
  ofertas: readonly { id: string; professorId: string; turmaId: string }[],
): Map<string, string[]> {
  const ofertasDoPar = new Map<string, string[]>();
  for (const o of ofertas) ofertasDoPar.set(`${o.professorId}|${o.turmaId}`, [...(ofertasDoPar.get(`${o.professorId}|${o.turmaId}`) ?? []), o.id]);
  const creditos = new Map<string, string[]>();
  for (const c of coberturas) {
    const doPar = ofertasDoPar.get(`${c.substitutoId}|${c.turmaId}`);
    const alvo = c.ofertaId && doPar?.includes(c.ofertaId) ? c.ofertaId : doPar?.length === 1 ? doPar[0] : undefined;
    if (alvo) creditos.set(alvo, [...(creditos.get(alvo) ?? []), c.dataISO]);
  }
  return creditos;
}

export interface CelulaDeGrade {
  ofertaId: string;
  turmaId: string;
  diaSemana: number;
}

/**
 * Períodos especiais (G14): nos dias do período, a turma com grade especial deixa a grade normal. Para cada oferta,
 * as datas (uma por aula) que saem da conta pela grade normal e as que entram pela grade especial. Só dias anteriores
 * a hoje e letivos. `periodos` vem da prioridade maior para a menor (vale o primeiro que cobre a data).
 */
export function ajusteDeGradeEspecial(e: {
  periodos: readonly { inicio: string; fim: string; celulas: readonly CelulaDeGrade[] }[];
  /** Células da grade normal, por semestre (1 ou 2). */
  normais: readonly (CelulaDeGrade & { semestreLetivo: number })[];
  letivos: readonly string[];
  sabadosLetivos: ReadonlyMap<string, number>;
  hojeISO: string;
}): Map<string, { saem: string[]; entram: string[] }> {
  const resultado = new Map<string, { saem: string[]; entram: string[] }>();
  const de = (id: string) => {
    const r = resultado.get(id) ?? { saem: [], entram: [] };
    resultado.set(id, r);
    return r;
  };
  for (const d of e.letivos) {
    if (d >= e.hojeISO) continue;
    const periodo = e.periodos.find((p) => p.inicio <= d && p.fim >= d && p.celulas.length > 0);
    if (!periodo) continue;
    const dia = diaDaGradeNaData(d, e.sabadosLetivos);
    if (dia === null) continue;
    const turmas = new Set(periodo.celulas.map((c) => c.turmaId));
    const semestre = Number(d.slice(5, 7)) <= 6 ? 1 : 2;
    for (const c of e.normais) if (c.semestreLetivo === semestre && c.diaSemana === dia && turmas.has(c.turmaId)) de(c.ofertaId).saem.push(d);
    for (const c of periodo.celulas) if (c.diaSemana === dia) de(c.ofertaId).entram.push(d);
  }
  return resultado;
}
