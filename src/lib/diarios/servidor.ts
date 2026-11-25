import 'server-only';
import { prisma } from '@/lib/db';
import { dataParaBanco } from '@/lib/ausencias/regras';
import { carregarAno } from '@/lib/calendario/servidor';
import { aulasPresumidas, deficitProjetado, aulasRestantesNaGrade, ministradasEfetivas } from './automatico';

export interface OfertaParaPresumir {
  id: string;
  semestreLetivo: number | null;
  aulasPrevistas: number;
  aulasMinistradas: number;
  ministradasManual: boolean;
}

export interface SituacaoAutomatica {
  /** Aulas dadas presumidas pela grade e pelo calendário (ou null sem período cadastrado). */
  presumido: number | null;
  /** Valor que vale: o manual, se marcado; senão o presumido (ou o lançado, sem período). */
  efetivas: number;
  /** Aulas que a grade ainda comporta de hoje ao fim do período (null sem período). */
  restantes: number | null;
}

/**
 * Aulas presumidas das ofertas do ano (RF08-A). Janela: o semestre da oferta (anuais: o ano inteiro). Dispensas
 * sem reposição agendada saem da conta; substituição e adiantamento contam como dadas.
 */
export async function situacoesAutomaticas(ano: number, ofertas: readonly OfertaParaPresumir[], hojeISO: string): Promise<Map<string, SituacaoAutomatica>> {
  const resultado = new Map<string, SituacaoAutomatica>();
  if (ofertas.length === 0) return resultado;
  const ids = ofertas.map((o) => o.id);
  const [calendario, celulas, dispensas] = await Promise.all([
    carregarAno(ano),
    prisma.gradeHorario.findMany({ where: { ofertaId: { in: ids }, anoLetivo: ano }, select: { ofertaId: true, diaSemana: true, semestreLetivo: true } }),
    prisma.coberturaBloco.findMany({
      where: { tipo: 'DISPENSA', ausencia: { ofertaId: { in: ids }, dataAula: { lt: dataParaBanco(hojeISO) }, status: { not: 'REPOSICAO_AGENDADA' } } },
      select: { ausencia: { select: { ofertaId: true } } },
    }),
  ]);
  const sabadosLetivos = new Map(calendario.sabados.map((s) => [s.data, s.diaSemanaReferente]));
  const dispensadasPor = new Map<string, number>();
  for (const d of dispensas) dispensadasPor.set(d.ausencia.ofertaId, (dispensadasPor.get(d.ausencia.ofertaId) ?? 0) + 1);

  for (const o of ofertas) {
    const sems = o.semestreLetivo === null ? calendario.semestres : [calendario.semestres[o.semestreLetivo - 1]];
    const janela = sems.every(Boolean)
      ? { inicio: sems[0]!.inicio, fim: sems[sems.length - 1]!.fim }
      : null;
    if (!janela) {
      resultado.set(o.id, { presumido: null, efetivas: o.aulasMinistradas, restantes: null });
      continue;
    }
    // Cada célula da grade do semestre vigente conta uma aula no seu dia da semana.
    const celulasPorDia = new Map<number, number>();
    for (const c of celulas) {
      if (c.ofertaId !== o.id) continue;
      if (o.semestreLetivo === null && c.semestreLetivo !== 1) continue; // anual aparece nos dois semestres: conta uma vez
      celulasPorDia.set(c.diaSemana, (celulasPorDia.get(c.diaSemana) ?? 0) + 1);
    }
    const letivos = calendario.contagem.letivos.filter((d) => d >= janela.inicio && d <= janela.fim);
    const base = { celulasPorDia, letivos, sabadosLetivos, hojeISO };
    const presumido = aulasPresumidas({ ...base, dispensadas: dispensadasPor.get(o.id) ?? 0, previstas: o.aulasPrevistas });
    resultado.set(o.id, { presumido, efetivas: ministradasEfetivas(o, presumido), restantes: aulasRestantesNaGrade(base) });
  }
  return resultado;
}

/** Quantas ofertas do semestre atual têm a grade curta para as aulas previstas (aviso da tela inicial). */
export async function diariosComGradeCurta(ano: number, semestre: 1 | 2, hojeISO: string): Promise<number> {
  const ofertas = await prisma.disciplinaOferta.findMany({
    where: { anoLetivo: ano, aulasPrevistas: { gt: 0 }, OR: [{ semestreLetivo: null }, { semestreLetivo: semestre }] },
    select: { id: true, semestreLetivo: true, aulasPrevistas: true, aulasMinistradas: true, ministradasManual: true },
  });
  const situacoes = await situacoesAutomaticas(ano, ofertas, hojeISO);
  return ofertas.filter((o) => {
    const r = situacoes.get(o.id)?.restantes;
    return r != null && deficitProjetado({ ministradas: situacoes.get(o.id)!.efetivas, restantesNaGrade: r, previstas: o.aulasPrevistas }) > 0;
  }).length;
}
