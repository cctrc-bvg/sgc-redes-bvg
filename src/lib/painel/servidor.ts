import 'server-only';
import { STATUS_COM_REPOSICAO } from '@/lib/reposicao/regras';
import { prisma } from '@/lib/db';
import { ehDocente, temPermissao, type Permissao, type Titular } from '@/lib/auth/rbac';
import { NOME_STATUS, dataDoBanco, dataParaBanco, hojeEmFortaleza, somarDias } from '@/lib/ausencias/regras';
import { mudancasDoProfessor } from '@/lib/ausencias/servidor';
import { NOME_TIPO_EVENTO } from '@/lib/calendario/regras';
import { blocosOrdenados, celulasDoProfessor } from '@/lib/grade/consultas';
import { anoLetivoAtual } from '@/lib/ofertas/regras';
import { carregarAno } from '@/lib/calendario/servidor';
import { prazoDeReposicao } from '@/lib/calendario/regras';
import { semestreLetivoAtual } from '@/lib/grade/regras';
import { andamentoDoPei } from '@/lib/ppe/andamento';
import { anoDoSemestre, semestreAtual } from '@/lib/ppe/regras';
import { diariosComGradeCurta } from '@/lib/diarios/servidor';
import { disciplinasDoDocente } from '@/lib/ppe/servidor';
import { CONTAGENS_ZERADAS, montarAcoes, type AcaoPrioritaria, type ContagensPainel } from './acoes';
import { chavePeriodo, inicioDaSemana, montarSemana, tituloDoEvento, type CelulaAgenda } from './agenda';

/**
 * Conta o que pede atenção do usuário. Cada consulta só roda se o perfil tiver a permissão correspondente,
 * e só devolve números (sem nomes de estudantes ou docentes).
 */
export async function contagensDoPainel(usuario: { id: string } & Exclude<Titular, string>, agora: Date = new Date()): Promise<ContagensPainel> {
  const pode = (p: Permissao) => temPermissao(usuario, p);
  const hojeISO = hojeEmFortaleza(agora);
  const hoje = dataParaBanco(hojeISO);
  const amanha = dataParaBanco(somarDias(hojeISO, 1));
  const ano = anoLetivoAtual(agora);
  const contar = (condicao: boolean, consulta: () => Promise<number>) => (condicao ? consulta() : Promise.resolve(0));
  const refeicaoAberta = { canceladoEm: null, confirmadoAE: false, dataRefeicao: { gte: agora } } as const;

  // Docência (Professor ou cargo que também leciona): só o que é dele, como nas telas "Minhas".
  const docente = ehDocente(usuario);
  const semestre = semestreAtual(agora);
  const minhasDisciplinas = docente ? [...(await disciplinasDoDocente(usuario.id, anoDoSemestre(semestre)))] : [];
  const ppeDoDocente = { semestre, disciplinaId: { in: minhasDisciplinas }, status: { not: 'LANCADO_ACADEMICO' as const } };

  const [
    emergenciasRefeicao,
    avisosRefeicao,
    ausenciasPendentes,
    ausenciasHojeOuAmanha,
    ausenciasInformadas,
    reposicoes,
    reposicoesParaCiencia,
    reposicoesAInformar,
    convitesPendentes,
    ppiEmAnalise,
    ppeRetencao,
    ppeParaDefinir,
    peiParaPreencher,
    diariosAtrasados,
    diariosGradeCurta,
    meusDiariosAtrasados,
    processosVencidos,
    etapas,
    processosAVencer,
    semestreComDatas,
    disciplinasSemProfessor,
    turmasSemGrade,
    ppeParaLancar,
    ppeAguardandoDocente,
    andamentoPeis,
  ] = await Promise.all([
    contar(pode('alimentacao:ver'), () => prisma.alertaAlimentacao.count({ where: { ...refeicaoAberta, nivelSla: 'VERMELHO_MENOS_4H' } })),
    contar(pode('alimentacao:ver'), () => prisma.alertaAlimentacao.count({ where: { ...refeicaoAberta, nivelSla: { not: 'VERMELHO_MENOS_4H' } } })),
    contar(pode('ausencias:registrar'), () => prisma.ausenciaDocente.count({ where: { status: 'PENDENTE_DECISAO', dataAula: { gte: hoje } } })),
    contar(pode('ausencias:registrar'), () => prisma.ausenciaDocente.count({ where: { status: 'PENDENTE_DECISAO', dataAula: { gte: hoje, lte: amanha } } })),
    contar(pode('ausencias:registrar'), () => prisma.ausenciaDocente.count({ where: { status: 'PENDENTE_DECISAO', dataAula: { gte: hoje }, informadaPeloDocente: true } })),
    pode('ausencias:registrar') ? reposicoesSemData(hojeISO) : Promise.resolve({ vencidas: 0, aVencer: 0 }),
    contar(pode('ausencias:registrar'), () => prisma.ausenciaDocente.count({ where: { reposicaoEm: { not: null }, reposicaoCienteEm: null } })),
    contar(docente, () =>
      prisma.ausenciaDocente.count({ where: { professorAusenteId: usuario.id, reposicaoEm: null, status: { in: [...STATUS_COM_REPOSICAO] }, dataAula: { gte: dataParaBanco(somarDias(hojeISO, -120)), lte: dataParaBanco(hojeISO) } } }),
    ),
    contar(docente, () =>
      prisma.conviteSubstituicao.count({ where: { professorId: usuario.id, status: 'PENDENTE', ausencia: { dataAula: { gte: hoje } } } }),
    ),
    contar(pode('ppi:gerenciar'), () => prisma.ppiSolicitacao.count({ where: { status: 'EM_ANALISE' } })),
    contar(pode('ppe:gerenciar'), () =>
      prisma.registroPPE.groupBy({ by: ['matricula'], where: { alertaRetencao: true, status: { not: 'LANCADO_ACADEMICO' } } }).then((g) => g.length),
    ),
    contar(minhasDisciplinas.length > 0, () => prisma.registroPPE.count({ where: { ...ppeDoDocente, modalidade: 'A_DEFINIR' } })),
    contar(minhasDisciplinas.length > 0, () => prisma.registroPPE.count({ where: { ...ppeDoDocente, modalidade: 'PEI', pei: null } })),
    contar(pode('diarios:ver-todos'), () => prisma.disciplinaOferta.count({ where: { anoLetivo: ano, diarioEmDia: false } })),
    contar(pode('diarios:ver-todos'), () => diariosComGradeCurta(ano, semestreLetivoAtual(agora), hojeISO)),
    contar(docente, () =>
      prisma.disciplinaOferta.count({ where: { anoLetivo: ano, professorId: usuario.id, diarioEmDia: false } }),
    ),
    contar(pode('kanban:ver'), () =>
      prisma.processoKanban.count({ where: { coluna: { not: 'CONCLUIDO' }, prazo: { lt: hoje }, ...(pode('kanban:ver-sigiloso') ? {} : { sigiloso: false }) } }),
    ),
    contar(pode('calendario:gerenciar'), () => prisma.etapaLetiva.count({ where: { anoLetivo: ano } })),
    contar(pode('kanban:ver'), () =>
      prisma.processoKanban.count({
        where: { coluna: { not: 'CONCLUIDO' }, prazo: { gte: hoje, lte: dataParaBanco(somarDias(hojeISO, 3)) }, ...(pode('kanban:ver-sigiloso') ? {} : { sigiloso: false }) },
      }),
    ),
    contar(pode('calendario:gerenciar'), () => prisma.periodoLetivo.count({ where: { anoLetivo: ano, semestreLetivo: semestreLetivoAtual(agora) } })),
    contar(pode('ofertas:gerenciar'), () => disciplinasSemProfessorNoAno(ano)),
    contar(pode('grade:editar'), () =>
      prisma.turma.count({
        where: { ativa: true, anoCurso: { not: null }, gradeHoraria: { none: { anoLetivo: ano, semestreLetivo: semestreLetivoAtual(agora) } } },
      }),
    ),
    contar(pode('ppe:gerenciar'), () => prisma.registroPPE.count({ where: { status: { in: ['APROVADO', 'REPROVADO'] } } })),
    contar(pode('ppe:gerenciar'), () => prisma.registroPPE.count({ where: { status: 'AGUARDANDO_PROFESSOR' } })),
    // PEI do docente em andamento: encontros a confirmar e PEI prontos para o resultado.
    minhasDisciplinas.length > 0
      ? prisma.planoEstudoIndividual
          .findMany({
            where: { ppe: { disciplinaId: { in: minhasDisciplinas }, modalidade: 'PEI', status: { in: ['EM_ANDAMENTO', 'PRORROGADO'] } } },
            select: { prorrogadoAte: true, encontros: { select: { data: true, conteudo: true, realizado: true } } },
          })
          .then((peis) =>
            peis.map((p) =>
              andamentoDoPei(
                p.encontros.map((e) => ({ data: dataDoBanco(e.data), conteudo: e.conteudo, realizado: e.realizado })),
                p.prorrogadoAte ? dataDoBanco(p.prorrogadoAte) : null,
                hojeISO,
              ),
            ),
          )
      : Promise.resolve([]),
  ]);

  return {
    ...CONTAGENS_ZERADAS,
    emergenciasRefeicao,
    avisosRefeicao,
    ausenciasPendentes,
    ausenciasHojeOuAmanha,
    ausenciasInformadas,
    reposicoesVencidas: reposicoes.vencidas,
    reposicoesAVencer: reposicoes.aVencer,
    reposicoesParaCiencia,
    reposicoesAInformar,
    convitesPendentes,
    ppiEmAnalise,
    ppeRetencao,
    ppeParaDefinir,
    peiParaPreencher,
    diariosAtrasados,
    diariosGradeCurta,
    meusDiariosAtrasados,
    processosVencidos,
    processosAVencer,
    etapasFaltando: pode('calendario:gerenciar') && etapas === 0,
    // Com as etapas faltando, o mesmo cadastro já é pedido: não repete o aviso.
    semestreSemDatas: pode('calendario:gerenciar') && etapas > 0 && semestreComDatas === 0,
    disciplinasSemProfessor,
    turmasSemGrade,
    ppeParaLancar,
    ppeAguardandoDocente,
    encontrosPeiAConfirmar: andamentoPeis.reduce((n, a) => n + a.encontrosAConfirmar, 0),
    peiParaConcluir: andamentoPeis.filter((a) => a.prontoParaConcluir).length,
  };
}

/**
 * Reposições (ROD, Art. 37, § 2º): ausências com turma dispensada e reposição ainda não agendada, dos últimos 90 dias,
 * contadas pelo prazo de cada uma (15 dias letivos ou fim da etapa). Vencidas e a vencer em até 5 dias.
 */
async function reposicoesSemData(hojeISO: string): Promise<{ vencidas: number; aVencer: number }> {
  const dispensadas = await prisma.ausenciaDocente.findMany({
    where: { status: { in: [...STATUS_COM_REPOSICAO] }, reposicaoEm: null, dataAula: { gte: dataParaBanco(somarDias(hojeISO, -90)), lte: dataParaBanco(hojeISO) } },
    select: { dataAula: true },
  });
  if (dispensadas.length === 0) return { vencidas: 0, aVencer: 0 };
  const datas = [...new Set(dispensadas.map((a) => dataDoBanco(a.dataAula)))];
  const anos = [...new Set(datas.map((d) => Number(d.slice(0, 4))))];
  const calendarios = new Map(await Promise.all(anos.map(async (a) => [a, await carregarAno(a)] as const)));
  const limite = somarDias(hojeISO, 5);
  let vencidas = 0;
  let aVencer = 0;
  for (const a of dispensadas) {
    const d = dataDoBanco(a.dataAula);
    const cal = calendarios.get(Number(d.slice(0, 4)))!;
    const prazo = prazoDeReposicao(d, cal.contagem.letivos, cal.etapas)?.prazo;
    if (!prazo) continue;
    if (prazo < hojeISO) vencidas++;
    else if (prazo <= limite) aVencer++;
  }
  return { vencidas, aVencer };
}

/** Disciplinas ativas da matriz sem oferta (professor) nas turmas ativas, no ano letivo (como em Ofertas). */
async function disciplinasSemProfessorNoAno(ano: number): Promise<number> {
  const [turmas, disciplinas, ofertas] = await Promise.all([
    prisma.turma.findMany({ where: { ativa: true, anoCurso: { not: null } }, select: { id: true, anoCurso: true } }),
    prisma.disciplina.findMany({ where: { ativa: true, anoCurso: { not: null } }, select: { id: true, anoCurso: true } }),
    prisma.disciplinaOferta.findMany({ where: { anoLetivo: ano }, select: { turmaId: true, disciplinaId: true } }),
  ]);
  const ofertadas = new Set(ofertas.map((o) => `${o.turmaId}|${o.disciplinaId}`));
  return turmas.reduce((n, t) => n + disciplinas.filter((d) => d.anoCurso === t.anoCurso && !ofertadas.has(`${t.id}|${d.id}`)).length, 0);
}

/** Ações prioritárias do usuário, da mais urgente para a menos. */
export async function acoesDoPainel(usuario: { id: string } & Exclude<Titular, string>): Promise<AcaoPrioritaria[]> {
  const c = await contagensDoPainel(usuario);
  return montarAcoes(c, { daCienciaRefeicao: temPermissao(usuario, 'alimentacao:confirmar') && !temPermissao(usuario, 'alimentacao:gerenciar') });
}

/** Semana do docente para a agenda do painel (aulas, sem-aula, eventos, mudanças e ausências dele). */
export async function semanaDoDocente(professorId: string, hojeISO: string = hojeEmFortaleza(), semanaDe?: string) {
  const inicio = semanaDe ?? inicioDaSemana(hojeISO);
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
    inicio,
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

/** Ausências do dia para a agenda da Coordenação: turma, horários e situação (com o docente, que ela já vê). */
export async function ausenciasDoDia(dataISO: string) {
  const lista = await prisma.ausenciaDocente.findMany({
    where: { dataAula: dataParaBanco(dataISO) },
    select: {
      id: true,
      blocosAfetados: true,
      status: true,
      turma: { select: { nome: true } },
      oferta: { select: { disciplina: { select: { nome: true } } } },
      professorAusente: { select: { nome: true } },
    },
  });
  return lista
    .map((a) => ({
      id: a.id,
      blocos: a.blocosAfetados.split(',').map((c) => c.trim()).join(', '),
      turma: a.turma.nome,
      disciplina: a.oferta.disciplina.nome,
      professor: a.professorAusente.nome,
      pendente: a.status === 'PENDENTE_DECISAO',
      situacao: NOME_STATUS[a.status],
    }))
    .sort((a, b) => Number(b.pendente) - Number(a.pendente) || a.blocos.localeCompare(b.blocos));
}
