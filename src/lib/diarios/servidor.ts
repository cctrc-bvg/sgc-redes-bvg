import 'server-only';
import { prisma } from '@/lib/db';
import { dataDoBanco, dataParaBanco } from '@/lib/ausencias/regras';
import { carregarAno } from '@/lib/calendario/servidor';
import { ajusteDeGradeEspecial, aulasPresumidas, creditosDeSubstituicao, deficitProjetado, aulasRestantesNaGrade, ministradasEfetivas } from './automatico';

export interface OfertaParaPresumir {
  id: string;
  semestreLetivo: number | null;
  aulasPrevistas: number;
  aulasMinistradas: number;
  ministradasManual: boolean;
  /** Data do lançamento manual (ponto de partida); vazio = valor fixo. */
  ministradasEm?: Date | null;
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
 * sem reposição agendada saem da conta; adiantamento conta como dada. Substituição: a aula sai da conta de quem faltou (que ainda deve repô-la) e entra na do substituto.
 */
export async function situacoesAutomaticas(ano: number, ofertas: readonly OfertaParaPresumir[], hojeISO: string): Promise<Map<string, SituacaoAutomatica>> {
  const resultado = new Map<string, SituacaoAutomatica>();
  if (ofertas.length === 0) return resultado;
  const ids = ofertas.map((o) => o.id);
  const [calendario, celulas, dispensas, substituidas, daSubstituicao, periodosEspeciais] = await Promise.all([
    carregarAno(ano),
    prisma.gradeHorario.findMany({ where: { ofertaId: { in: ids }, anoLetivo: ano }, select: { ofertaId: true, diaSemana: true, semestreLetivo: true } }),
    prisma.coberturaBloco.findMany({
      where: { tipo: 'DISPENSA', ausencia: { ofertaId: { in: ids }, dataAula: { lt: dataParaBanco(hojeISO) }, status: { not: 'REPOSICAO_AGENDADA' }, reposicaoEm: null } },
      select: { ausencia: { select: { ofertaId: true, dataAula: true } } },
    }),
    // Horário ocupado por outro docente: a aula não foi dada na disciplina de quem faltou; ele ainda deve repô-la.
    prisma.coberturaBloco.findMany({
      where: { tipo: 'SUBSTITUICAO', ausencia: { ofertaId: { in: ids }, dataAula: { lt: dataParaBanco(hojeISO) }, reposicaoEm: null } },
      select: { ausencia: { select: { ofertaId: true, dataAula: true } } },
    }),
    // E o docente que ocupou o horário pode contá-lo na disciplina dele (crédito automático só se ele tem uma única disciplina na turma).
    prisma.coberturaBloco.findMany({
      where: { tipo: 'SUBSTITUICAO', substitutoId: { not: null }, ausencia: { dataAula: { lt: dataParaBanco(hojeISO) }, oferta: { anoLetivo: ano } } },
      select: { substitutoId: true, ofertaSubstitutaId: true, ausencia: { select: { turmaId: true, dataAula: true } } },
    }),
    // Período especial: a turma com grade especial deixa a grade normal nos dias dele.
    prisma.periodoEspecial.findMany({
      where: { inicio: { lte: dataParaBanco(hojeISO) }, fim: { gte: dataParaBanco(`${ano}-01-01`) }, grades: { some: { ofertaId: { not: null } } } },
      orderBy: { createdAt: 'desc' },
      select: { inicio: true, fim: true, grades: { where: { ofertaId: { not: null } }, select: { ofertaId: true, turmaId: true, diaSemana: true } } },
    }),
  ]);
  // A grade normal só interessa às turmas que têm grade especial em algum período (quase sempre nenhuma).
  const turmasEspeciais = [...new Set(periodosEspeciais.flatMap((p) => p.grades.map((g) => g.turmaId)))];
  const celulasNormaisDasTurmas = turmasEspeciais.length
    ? await prisma.gradeHorario.findMany({ where: { anoLetivo: ano, turmaId: { in: turmasEspeciais }, ofertaId: { not: null } }, select: { ofertaId: true, turmaId: true, diaSemana: true, semestreLetivo: true } })
    : [];
  const ajustes = ajusteDeGradeEspecial({
    periodos: periodosEspeciais.map((p) => ({ inicio: dataDoBanco(p.inicio), fim: dataDoBanco(p.fim), celulas: p.grades.map((g) => ({ ofertaId: g.ofertaId!, turmaId: g.turmaId, diaSemana: g.diaSemana })) })),
    normais: celulasNormaisDasTurmas.map((c) => ({ ofertaId: c.ofertaId!, turmaId: c.turmaId, diaSemana: c.diaSemana, semestreLetivo: c.semestreLetivo })),
    letivos: calendario.contagem.letivos,
    sabadosLetivos: new Map(calendario.sabados.map((s) => [s.data, s.diaSemanaReferente])),
    hojeISO,
  });
  const ofertasDoAno = daSubstituicao.length
    ? await prisma.disciplinaOferta.findMany({ where: { anoLetivo: ano, professorId: { in: [...new Set(daSubstituicao.map((c) => c.substitutoId!))] } }, select: { id: true, professorId: true, turmaId: true } })
    : [];
  const creditos = creditosDeSubstituicao(daSubstituicao.map((c) => ({ substitutoId: c.substitutoId!, turmaId: c.ausencia.turmaId, ofertaId: c.ofertaSubstitutaId, dataISO: dataDoBanco(c.ausencia.dataAula) })), ofertasDoAno);
  const sabadosLetivos = new Map(calendario.sabados.map((s) => [s.data, s.diaSemanaReferente]));
  const dispensadasPor = new Map<string, string[]>();
  for (const d of [...dispensas, ...substituidas]) dispensadasPor.set(d.ausencia.ofertaId, [...(dispensadasPor.get(d.ausencia.ofertaId) ?? []), dataDoBanco(d.ausencia.dataAula)]);

  for (const o of ofertas) {
    // Anual: cada semestre vale com a sua própria grade e a sua janela; semestral: só o semestre da oferta.
    const numeros = o.semestreLetivo === null ? [1, 2] : [o.semestreLetivo];
    const janelas = numeros.map((n) => calendario.semestres[n - 1]);
    if (janelas.some((j) => !j)) {
      resultado.set(o.id, { presumido: null, efetivas: o.aulasMinistradas, restantes: null });
      continue;
    }
    const desde = o.ministradasManual && o.ministradasEm ? dataDoBanco(o.ministradasEm) : null;
    let dadas = 0;
    let dadasDesde = 0;
    let restantes = 0;
    numeros.forEach((n, i) => {
      const janela = janelas[i]!;
      const celulasPorDia = new Map<number, number>();
      for (const c of celulas) {
        if (c.ofertaId === o.id && c.semestreLetivo === n) celulasPorDia.set(c.diaSemana, (celulasPorDia.get(c.diaSemana) ?? 0) + 1);
      }
      const letivos = calendario.contagem.letivos.filter((d) => d >= janela.inicio && d <= janela.fim);
      const base = { celulasPorDia, letivos, sabadosLetivos, hojeISO };
      dadas += aulasPresumidas(base);
      if (desde) dadasDesde += aulasPresumidas({ ...base, desdeISO: desde });
      restantes += aulasRestantesNaGrade(base);
    });
    const saem = [...(dispensadasPor.get(o.id) ?? []), ...(ajustes.get(o.id)?.saem ?? [])];
    const entram = [...(creditos.get(o.id) ?? []), ...(ajustes.get(o.id)?.entram ?? [])];
    const presumido = Math.min(Math.max(0, dadas - saem.length + entram.length), o.aulasPrevistas);
    // Lançamento manual com data: vale como ponto de partida e o automático segue a partir dela.
    const efetivas = desde
      ? Math.min(o.aulasMinistradas + Math.max(0, dadasDesde - saem.filter((d) => d >= desde).length + entram.filter((d) => d >= desde).length), o.aulasPrevistas)
      : ministradasEfetivas(o, presumido);
    resultado.set(o.id, { presumido, efetivas, restantes });
  }
  return resultado;
}

/** Quantas ofertas do semestre atual têm a grade curta para as aulas previstas (aviso da tela inicial). */
export async function diariosComGradeCurta(ano: number, semestre: 1 | 2, hojeISO: string): Promise<number> {
  const ofertas = await prisma.disciplinaOferta.findMany({
    where: { anoLetivo: ano, aulasPrevistas: { gt: 0 }, OR: [{ semestreLetivo: null }, { semestreLetivo: semestre }] },
    select: { id: true, semestreLetivo: true, aulasPrevistas: true, aulasMinistradas: true, ministradasManual: true, ministradasEm: true },
  });
  const situacoes = await situacoesAutomaticas(ano, ofertas, hojeISO);
  return ofertas.filter((o) => {
    const r = situacoes.get(o.id)?.restantes;
    return r != null && deficitProjetado({ ministradas: situacoes.get(o.id)!.efetivas, restantesNaGrade: r, previstas: o.aulasPrevistas }) > 0;
  }).length;
}
