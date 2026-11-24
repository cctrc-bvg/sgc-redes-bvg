/**
 * Relatórios consolidados (FSD, Direção/CTP): só números agregados, nunca nomes de estudantes ou
 * motivos (LGPD). Funções puras sobre listas já buscadas no banco.
 */
import type { StatusAusencia, StatusPPE, StatusPpi, TipoCobertura } from '@prisma/client';

export interface AusenciaResumo {
  mes: string; // AAAA-MM
  status: StatusAusencia;
  coberturas: readonly TipoCobertura[];
  blocos: number;
}

export interface LinhaMensal {
  mes: string;
  ausencias: number;
  aulasPerdidas: number;
  substituidas: number;
  adiantadas: number;
  dispensadas: number;
  pendentes: number;
  /** Aulas cobertas (substituição ou adiantamento) ÷ aulas perdidas, em %. */
  cobertura: number;
}

export function resumoMensalAusencias(lista: readonly AusenciaResumo[]): LinhaMensal[] {
  const porMes = new Map<string, LinhaMensal>();
  for (const a of lista) {
    const l =
      porMes.get(a.mes) ?? { mes: a.mes, ausencias: 0, aulasPerdidas: 0, substituidas: 0, adiantadas: 0, dispensadas: 0, pendentes: 0, cobertura: 0 };
    l.ausencias += 1;
    l.aulasPerdidas += a.blocos;
    l.substituidas += a.coberturas.filter((c) => c === 'SUBSTITUICAO').length;
    l.adiantadas += a.coberturas.filter((c) => c === 'ADIANTAMENTO').length;
    l.dispensadas += a.coberturas.filter((c) => c === 'DISPENSA').length;
    l.pendentes += Math.max(0, a.blocos - a.coberturas.length);
    porMes.set(a.mes, l);
  }
  return [...porMes.values()]
    .map((l) => ({ ...l, cobertura: l.aulasPerdidas === 0 ? 0 : Math.round(((l.substituidas + l.adiantadas) / l.aulasPerdidas) * 100) }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

export function totalizar(linhas: readonly LinhaMensal[]): LinhaMensal {
  const t = linhas.reduce(
    (s, l) => ({
      ...s,
      ausencias: s.ausencias + l.ausencias,
      aulasPerdidas: s.aulasPerdidas + l.aulasPerdidas,
      substituidas: s.substituidas + l.substituidas,
      adiantadas: s.adiantadas + l.adiantadas,
      dispensadas: s.dispensadas + l.dispensadas,
      pendentes: s.pendentes + l.pendentes,
    }),
    { mes: 'Total', ausencias: 0, aulasPerdidas: 0, substituidas: 0, adiantadas: 0, dispensadas: 0, pendentes: 0, cobertura: 0 },
  );
  return { ...t, cobertura: t.aulasPerdidas === 0 ? 0 : Math.round(((t.substituidas + t.adiantadas) / t.aulasPerdidas) * 100) };
}

/** Contagem por chave, na ordem dada (chaves sem ocorrência aparecem com zero). */
export function contarPor<T extends string>(valores: readonly T[], ordem: readonly T[]): { chave: T; total: number }[] {
  return ordem.map((chave) => ({ chave, total: valores.filter((v) => v === chave).length }));
}

export const ORDEM_STATUS_PPE: readonly StatusPPE[] = ['AGUARDANDO_PROFESSOR', 'EM_ANDAMENTO', 'PRORROGADO', 'APROVADO', 'REPROVADO', 'LANCADO_ACADEMICO'];
export const ORDEM_STATUS_PPI: readonly StatusPpi[] = ['EM_ANALISE', 'DEFERIDA', 'INDEFERIDA'];

/** "2026-11" → "nov/2026". */
export function nomeMes(mes: string): string {
  const [ano, m] = mes.split('-').map(Number);
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[m - 1]}/${ano}`;
}
