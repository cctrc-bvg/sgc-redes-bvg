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
export function aulasPresumidas(e: EntradaPresumido & { hojeISO: string; dispensadas?: number; previstas?: number }): number {
  const dadas = aulasNaGrade(e, (d) => d < e.hojeISO) - (e.dispensadas ?? 0);
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
