import 'server-only';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { temPermissao, type Permissao } from '@/lib/auth/rbac';
import { dataDoBanco, dataParaBanco, hojeEmFortaleza, somarDias } from '@/lib/ausencias/regras';
import { mudancasDoProfessor } from '@/lib/ausencias/servidor';
import { NOME_TIPO_EVENTO } from '@/lib/calendario/regras';
import { blocosOrdenados, celulasDoProfessor } from '@/lib/grade/consultas';
import { anoLetivoAtual } from '@/lib/ofertas/regras';
import { anoDoSemestre, semestreAtual } from '@/lib/ppe/regras';
import { disciplinasDoDocente } from '@/lib/ppe/servidor';
import { CONTAGENS_ZERADAS, montarAcoes, type AcaoPrioritaria, type ContagensPainel } from './acoes';
import { chavePeriodo, inicioDaSemana, montarSemana, tituloDoEvento, type CelulaAgenda } from './agenda';

/**
 * Conta o que pede atenção do usuário. Cada consulta só roda se o perfil tiver a permissão correspondente,
 * e só devolve números (sem nomes de estudantes ou docentes).
 */
export async function contagensDoPainel(usuario: { id: string; role: Role }, agora: Date = new Date()): Promise<ContagensPainel> {
  const pode = (p: Permissao) => temPermissao(usuario.role, p);
  const hojeISO = hojeEmFortaleza(agora);
  const hoje = dataParaBanco(hojeISO);
  const amanha = dataParaBanco(somarDias(hojeISO, 1));
  const ano = anoLetivoAtual(agora);
  const contar = (condicao: boolean, consulta: () => Promise<number>) => (condicao ? consulta() : Promise.resolve(0));
  const refeicaoAberta = { canceladoEm: null, confirmadoAE: false, dataRefeicao: { gte: agora } } as const;

  // PPE do docente: só as das disciplinas que ele leciona no ano do semestre atual (como na lista de PPE).
  const semestre = semestreAtual(agora);
  const minhasDisciplinas = pode('ppe:definir') && !pode('ppe:gerenciar') ? [...(await disciplinasDoDocente(usuario.id, anoDoSemestre(semestre)))] : [];
  const ppeDoDocente = { semestre, disciplinaId: { in: minhasDisciplinas }, status: { not: 'LANCADO_ACADEMICO' as const } };

  const [
    emergenciasRefeicao,
    avisosRefeicao,
    ausenciasPendentes,
    ausenciasHojeOuAmanha,
    convitesPendentes,
    ppiEmAnalise,
    ppeRetencao,
    ppeParaDefinir,
    peiParaPreencher,
    diariosAtrasados,
    meusDiariosAtrasados,
    processosVencidos,
    etapas,
  ] = await Promise.all([
    contar(pode('alimentacao:ver'), () => prisma.alertaAlimentacao.count({ where: { ...refeicaoAberta, nivelSla: 'VERMELHO_MENOS_4H' } })),
    contar(pode('alimentacao:ver'), () => prisma.alertaAlimentacao.count({ where: { ...refeicaoAberta, nivelSla: { not: 'VERMELHO_MENOS_4H' } } })),
    contar(pode('ausencias:registrar'), () => prisma.ausenciaDocente.count({ where: { status: 'PENDENTE_DECISAO', dataAula: { gte: hoje } } })),
    contar(pode('ausencias:registrar'), () => prisma.ausenciaDocente.count({ where: { status: 'PENDENTE_DECISAO', dataAula: { gte: hoje, lte: amanha } } })),
    contar(pode('substituicao:responder'), () =>
      prisma.conviteSubstituicao.count({ where: { professorId: usuario.id, status: 'PENDENTE', ausencia: { dataAula: { gte: hoje } } } }),
    ),
    contar(pode('ppi:gerenciar'), () => prisma.ppiSolicitacao.count({ where: { status: 'EM_ANALISE' } })),
    contar(pode('ppe:gerenciar'), () =>
      prisma.registroPPE.groupBy({ by: ['matricula'], where: { alertaRetencao: true, status: { not: 'LANCADO_ACADEMICO' } } }).then((g) => g.length),
    ),
    contar(minhasDisciplinas.length > 0, () => prisma.registroPPE.count({ where: { ...ppeDoDocente, modalidade: 'A_DEFINIR' } })),
    contar(minhasDisciplinas.length > 0, () => prisma.registroPPE.count({ where: { ...ppeDoDocente, modalidade: 'PEI', pei: null } })),
    contar(pode('diarios:ver-todos'), () => prisma.disciplinaOferta.count({ where: { anoLetivo: ano, diarioEmDia: false } })),
    contar(pode('diarios:ver-proprios') && !pode('diarios:ver-todos'), () =>
      prisma.disciplinaOferta.count({ where: { anoLetivo: ano, professorId: usuario.id, diarioEmDia: false } }),
    ),
    contar(pode('kanban:ver'), () =>
      prisma.processoKanban.count({ where: { coluna: { not: 'CONCLUIDO' }, prazo: { lt: hoje }, ...(pode('kanban:ver-sigiloso') ? {} : { sigiloso: false }) } }),
    ),
    contar(pode('calendario:gerenciar'), () => prisma.etapaLetiva.count({ where: { anoLetivo: ano } })),
  ]);

  return {
    ...CONTAGENS_ZERADAS,
    emergenciasRefeicao,
    avisosRefeicao,
    ausenciasPendentes,
    ausenciasHojeOuAmanha,
    convitesPendentes,
    ppiEmAnalise,
    ppeRetencao,
    ppeParaDefinir,
    peiParaPreencher,
    diariosAtrasados,
    meusDiariosAtrasados,
    processosVencidos,
    etapasFaltando: pode('calendario:gerenciar') && etapas === 0,
  };
}

/** Ações prioritárias do usuário, da mais urgente para a menos. */
export async function acoesDoPainel(usuario: { id: string; role: Role }): Promise<AcaoPrioritaria[]> {
  const c = await contagensDoPainel(usuario);
  return montarAcoes(c, { daCienciaRefeicao: temPermissao(usuario.role, 'alimentacao:confirmar') && !temPermissao(usuario.role, 'alimentacao:gerenciar') });
}

/** Semana do docente para a agenda do painel (aulas, sem-aula, eventos, mudanças e ausências dele). */
export async function semanaDoDocente(professorId: string, hojeISO: string = hojeEmFortaleza()) {
  const inicio = inicioDaSemana(hojeISO);
  const fim = somarDias(inicio, 5);
  const [blocos, sabados, eventos, ausencias, mudancas] = await Promise.all([
    blocosOrdenados(),
    prisma.sabadoLetivo.findMany({ where: { data: { gte: dataParaBanco(inicio), lte: dataParaBanco(fim) } } }),
    prisma.eventoCalendario.findMany({ where: { inicio: { lte: dataParaBanco(fim) }, fim: { gte: dataParaBanco(inicio) } }, orderBy: { inicio: 'asc' } }),
    prisma.ausenciaDocente.findMany({
      where: { professorAusenteId: professorId, dataAula: { gte: dataParaBanco(inicio), lte: dataParaBanco(fim) } },
      select: { dataAula: true, blocosAfetados: true },
    }),
    mudancasDoProfessor(professorId, inicio, fim),
  ]);
  const bloco = new Map(blocos.map((b) => [b.id, b]));
  const periodos = [...new Set([0, 1, 2, 3, 4, 5].map((n) => chavePeriodo(somarDias(inicio, n))))];
  const celulas = new Map<string, CelulaAgenda[]>();
  await Promise.all(
    periodos.map(async (p) => {
      const [ano, sem] = p.split('.').map(Number);
      const lista = await celulasDoProfessor(professorId, ano, sem);
      celulas.set(
        p,
        lista.flatMap((c) => {
          const b = bloco.get(c.blocoId);
          return b ? [{ diaSemana: c.diaSemana, bloco: b, turma: c.turma.nome, disciplina: c.oferta?.disciplina.nome ?? '' }] : [];
        }),
      );
    }),
  );
  const porData = new Map<string, Set<string>>();
  for (const a of ausencias) {
    const d = dataDoBanco(a.dataAula);
    const codigos = porData.get(d) ?? new Set<string>();
    a.blocosAfetados.split(',').forEach((c) => codigos.add(c.trim()));
    porData.set(d, codigos);
  }
  return montarSemana({
    hojeISO,
    sabados: new Map(sabados.map((s) => [dataDoBanco(s.data), s.diaSemanaReferente])),
    eventos: eventos.map((e) => ({
      inicio: dataDoBanco(e.inicio),
      fim: dataDoBanco(e.fim),
      titulo: tituloDoEvento(NOME_TIPO_EVENTO[e.tipo], e.descricao),
      suspende: e.suspendeAulas,
    })),
    celulas,
    ausencias: porData,
    mudancas,
  });
}
