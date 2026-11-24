import 'server-only';
import type { Prisma, TipoRefeicao } from '@prisma/client';
import { prisma } from '@/lib/db';
import { diaDaGradeNaData, NOME_DIA_EXTENSO } from '@/lib/grade/regras';
import { PERFIS_DOCENTES } from '@/lib/ofertas/regras';
import {
  ACAO_DO_IMPACTO,
  blocosOcupadosDepois,
  codigoBloco,
  conciliarAlertas,
  dataDoBanco,
  dataParaBanco,
  descreverBloco,
  impactosFuturos,
  instanteDaRefeicao,
  periodoDaData,
  presencaPorTurno,
  somarDias,
  type AulaDia,
  type BlocoDia,
  type ContextoDia,
  type CoberturaDia,
} from './regras';
import { mensagensDaAusencia, type DadosMensagem, type LinhaHorario } from './mensagens';

type Tx = Prisma.TransactionClient;

export interface AulaDetalhada extends AulaDia {
  turma: string;
  disciplina: string;
  professor: string;
}

/** Grade que vale na data (G14), ausências registradas e coberturas decididas. */
export async function carregarDia(dataISO: string, db: Tx | typeof prisma = prisma) {
  const sabado = await db.sabadoLetivo.findUnique({ where: { data: dataParaBanco(dataISO) } });
  const sabados = new Map(sabado ? [[dataISO, sabado.diaSemanaReferente]] : []);
  const diaSemana = diaDaGradeNaData(dataISO, sabados);
  const { anoLetivo, semestreLetivo } = periodoDaData(dataISO);

  const [blocos, celulas, ausencias, docentes] = await Promise.all([
    db.blocoHorario.findMany({ orderBy: [{ turno: 'asc' }, { ordem: 'asc' }] }),
    diaSemana === null
      ? Promise.resolve([])
      : db.gradeHorario.findMany({
          where: { anoLetivo, semestreLetivo, diaSemana, ofertaId: { not: null } },
          select: {
            turmaId: true,
            blocoId: true,
            ofertaId: true,
            turma: { select: { nome: true } },
            oferta: { select: { professorId: true, professor: { select: { nome: true } }, disciplina: { select: { nome: true } } } },
          },
        }),
    db.ausenciaDocente.findMany({
      where: { dataAula: dataParaBanco(dataISO) },
      select: {
        id: true,
        turmaId: true,
        ofertaId: true,
        professorAusenteId: true,
        blocosAfetados: true,
        coberturas: { select: { blocoId: true, tipo: true, substitutoId: true, blocoOrigemId: true } },
      },
    }),
    db.user.findMany({ where: { ativo: true, role: { in: [...PERFIS_DOCENTES] } }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ]);

  const aulasDoDia: AulaDetalhada[] = celulas.map((c) => ({
    turmaId: c.turmaId,
    blocoId: c.blocoId,
    ofertaId: c.ofertaId!,
    professorId: c.oferta!.professorId,
    turma: c.turma.nome,
    disciplina: c.oferta!.disciplina.nome,
    professor: c.oferta!.professor.nome,
  }));
  const blocoPorCodigo = new Map(blocos.map((b) => [codigoBloco(b), b.id]));
  const blocosDaAusencia = (codigos: string) =>
    codigos
      .split(',')
      .map((c) => blocoPorCodigo.get(c.trim()))
      .filter((id): id is string => Boolean(id));

  // Professor da aula adiantada: dono da célula de origem na grade da turma.
  const professorDaCelula = new Map(aulasDoDia.map((a) => [`${a.turmaId}|${a.blocoId}`, a.professorId]));
  const coberturas: CoberturaDia[] = ausencias.flatMap((a) =>
    a.coberturas.map((c) => ({
      ausenciaId: a.id,
      turmaId: a.turmaId,
      blocoId: c.blocoId,
      tipo: c.tipo,
      substitutoId: c.substitutoId,
      blocoOrigemId: c.blocoOrigemId,
      professorOrigemId: c.blocoOrigemId ? (professorDaCelula.get(`${a.turmaId}|${c.blocoOrigemId}`) ?? null) : null,
    })),
  );

  return {
    dataISO,
    diaSemana,
    sabadoLetivo: sabado,
    blocos: blocos as BlocoDia[],
    aulasDoDia,
    ausencias: ausencias.map((a) => ({ ...a, blocoIds: blocosDaAusencia(a.blocosAfetados) })),
    coberturas,
    docentes,
  };
}

export type Dia = Awaited<ReturnType<typeof carregarDia>>;

/** Contexto de sugestões para uma ausência: as coberturas dela mesma ficam de fora (estão sendo redecididas). */
export function contextoDaAusencia(dia: Dia, ausenciaId: string): ContextoDia {
  return {
    blocos: dia.blocos,
    aulasDoDia: dia.aulasDoDia,
    coberturasOutras: dia.coberturas.filter((c) => c.ausenciaId !== ausenciaId),
    ausentes: new Set(dia.ausencias.map((a) => a.professorAusenteId)),
    blocosPerdidos: new Set(dia.ausencias.flatMap((a) => a.blocoIds.map((b) => `${a.turmaId}|${b}`))),
    docentes: dia.docentes,
  };
}

const CAMPO_QTD: Record<TipoRefeicao, 'qtdMediaLancheManha' | 'qtdMediaAlmoco' | 'qtdMediaLancheTarde'> = {
  LANCHE_MANHA: 'qtdMediaLancheManha',
  ALMOCO: 'qtdMediaAlmoco',
  LANCHE_TARDE: 'qtdMediaLancheTarde',
};

/** Intervalo [início, fim) do dia em Fortaleza, para buscar avisos pelo horário da refeição. */
export function intervaloDoDia(dataISO: string) {
  return { gte: new Date(`${dataISO}T00:00:00-03:00`), lt: new Date(`${somarDias(dataISO, 1)}T00:00:00-03:00`) };
}

/**
 * Impacto das coberturas da turma no dia, sem gravar: antes (grade) × depois (coberturas).
 * `coberturasDaTurma` substitui as gravadas quando se quer simular uma decisão ainda não salva.
 */
export function impactoDaTurma(dia: Dia, turmaId: string, agora: Date, coberturasDaTurma?: readonly Pick<CoberturaDia, 'tipo' | 'blocoId' | 'blocoOrigemId'>[]) {
  const daGrade = dia.aulasDoDia.filter((a) => a.turmaId === turmaId).map((a) => a.blocoId);
  const coberturas = coberturasDaTurma ?? dia.coberturas.filter((c) => c.turmaId === turmaId);
  const depois = blocosOcupadosDepois(daGrade, coberturas);
  return impactosFuturos(dia.dataISO, presencaPorTurno(daGrade, dia.blocos), presencaPorTurno(depois, dia.blocos), agora);
}

/**
 * Recalcula os avisos de refeição da turma no dia depois de uma mudança (decisão ou cancelamento),
 * dentro da transação. Cria os que faltam (quantidade = média da turma) e cancela os que deixaram de valer.
 */
export async function recalcularAlertasDaTurma(
  tx: Tx,
  params: { turmaId: string; dataISO: string; agora: Date; ausenciaId: string | null; justificativa: string | null },
) {
  const dia = await carregarDia(params.dataISO, tx);
  const necessarios = impactoDaTurma(dia, params.turmaId, params.agora);
  const [turma, existentes] = await Promise.all([
    tx.turma.findUniqueOrThrow({ where: { id: params.turmaId } }),
    tx.alertaAlimentacao.findMany({
      // Acréscimos manuais (G05) não dependem das ausências: ficam fora da conciliação.
      where: { turmaId: params.turmaId, dataRefeicao: intervaloDoDia(params.dataISO), canceladoEm: null, manual: false },
      select: { id: true, tipoRefeicao: true, acao: true, dataRefeicao: true },
    }),
  ]);
  const { criar, cancelarIds } = conciliarAlertas(existentes, necessarios, params.agora);
  if (cancelarIds.length > 0) {
    await tx.alertaAlimentacao.updateMany({ where: { id: { in: cancelarIds } }, data: { canceladoEm: params.agora } });
  }
  for (const i of criar) {
    await tx.alertaAlimentacao.create({
      data: {
        turmaId: params.turmaId,
        ausenciaId: params.ausenciaId,
        dataRefeicao: instanteDaRefeicao(params.dataISO, i.horarioReferencia),
        tipoRefeicao: i.tipoRefeicao,
        acao: ACAO_DO_IMPACTO[i.acao],
        qtdImpactada: turma[CAMPO_QTD[i.tipoRefeicao]],
        antecedenciaMin: i.antecedenciaMinutos,
        nivelSla: i.nivelSla,
        justificativa: params.justificativa,
      },
    });
  }
  return { criados: criar.length, cancelados: cancelarIds.length };
}

/** Ausência com tudo o que a página e as mensagens precisam. null se não existir. */
export async function carregarAusencia(ausenciaId: string) {
  const registro = await prisma.ausenciaDocente.findUnique({
    where: { id: ausenciaId },
    include: {
      turma: { select: { id: true, nome: true, codigo: true } },
      professorAusente: { select: { id: true, nome: true } },
      oferta: { select: { disciplina: { select: { nome: true } } } },
    },
  });
  if (!registro) return null;
  const dataISO = dataDoBanco(registro.dataAula);
  const [dia, alertas] = await Promise.all([
    carregarDia(dataISO),
    prisma.alertaAlimentacao.findMany({
      where: { turmaId: registro.turmaId, dataRefeicao: intervaloDoDia(dataISO), manual: false },
      orderBy: [{ dataRefeicao: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);
  const ausencia = dia.ausencias.find((a) => a.id === ausenciaId)!;
  const bloco = new Map(dia.blocos.map((b) => [b.id, b]));
  const nomeDocente = new Map(dia.docentes.map((d) => [d.id, d.nome]));
  const disciplinaDaCelula = new Map(dia.aulasDoDia.map((a) => [`${a.turmaId}|${a.blocoId}`, a.disciplina]));
  const minhas = new Map(dia.coberturas.filter((c) => c.ausenciaId === ausenciaId).map((c) => [c.blocoId, c]));

  const horarios: LinhaHorario[] = ausencia.blocoIds.map((b) => {
    const c = minhas.get(b);
    const rotulo = descreverBloco(bloco.get(b)!);
    if (!c) return { bloco: rotulo, situacao: 'pendente' };
    if (c.tipo === 'SUBSTITUICAO') return { bloco: rotulo, situacao: 'substituicao', detalhe: nomeDocente.get(c.substitutoId ?? '') ?? 'docente inativo' };
    if (c.tipo === 'ADIANTAMENTO') {
      const origem = bloco.get(c.blocoOrigemId ?? '');
      return {
        bloco: rotulo,
        situacao: 'adiantamento',
        detalhe: `${disciplinaDaCelula.get(`${registro.turmaId}|${c.blocoOrigemId}`) ?? 'aula'} (de ${origem ? descreverBloco(origem) : 'outro horário'})`,
      };
    }
    return { bloco: rotulo, situacao: 'dispensa' };
  });
  const ativos = alertas.filter((a) => !a.canceladoEm);
  const dados: DadosMensagem = {
    turma: registro.turma.nome,
    codigoTurma: registro.turma.codigo,
    dataISO,
    diaSemana: dia.diaSemana ? NOME_DIA_EXTENSO[dia.diaSemana] : 'dia sem grade',
    disciplina: registro.oferta.disciplina.nome,
    professor: registro.professorAusente.nome,
    motivoOperacional: registro.motivoOperacional,
    status: registro.status,
    horarios,
    refeicoes: ativos.map((a) => ({ tipo: a.tipoRefeicao, acao: a.acao, quantidade: a.qtdImpactada, nivel: a.nivelSla })),
  };
  return { registro, dataISO, dia, ausencia, alertas, horarios, dados, mensagens: mensagensDaAusencia(dados) };
}

export interface MudancaDoProfessor {
  dataISO: string;
  turma: string;
  bloco: string;
  tipo: 'substituicao' | 'adiantamento';
  detalhe: string;
}

/**
 * Mudanças que afetam o professor entre duas datas: aulas que ele vai cobrir como substituto e aulas
 * dele que foram adiantadas para outro horário. Sem motivo da ausência (LGPD).
 */
export async function mudancasDoProfessor(professorId: string, deISO: string, ateISO: string): Promise<MudancaDoProfessor[]> {
  const ausencias = await prisma.ausenciaDocente.findMany({
    where: {
      dataAula: { gte: dataParaBanco(deISO), lte: dataParaBanco(ateISO) },
      coberturas: { some: { OR: [{ substitutoId: professorId }, { tipo: 'ADIANTAMENTO' }] } },
    },
    select: { dataAula: true },
    distinct: ['dataAula'],
    orderBy: { dataAula: 'asc' },
  });
  const mudancas: MudancaDoProfessor[] = [];
  for (const { dataAula } of ausencias) {
    const dia = await carregarDia(dataDoBanco(dataAula));
    const bloco = new Map(dia.blocos.map((b) => [b.id, b]));
    const turma = new Map(dia.aulasDoDia.map((a) => [a.turmaId, a.turma]));
    const celula = new Map(dia.aulasDoDia.map((a) => [`${a.turmaId}|${a.blocoId}`, a]));
    for (const c of dia.coberturas) {
      const ausencia = dia.ausencias.find((a) => a.id === c.ausenciaId)!;
      const perdida = celula.get(`${c.turmaId}|${c.blocoId}`) ?? dia.aulasDoDia.find((a) => a.ofertaId === ausencia.ofertaId);
      if (c.tipo === 'SUBSTITUICAO' && c.substitutoId === professorId) {
        mudancas.push({
          dataISO: dia.dataISO,
          turma: turma.get(c.turmaId) ?? '',
          bloco: descreverBloco(bloco.get(c.blocoId)!),
          tipo: 'substituicao',
          detalhe: `Substituição na aula de ${perdida?.disciplina ?? 'outra disciplina'}`,
        });
      }
      if (c.tipo === 'ADIANTAMENTO' && c.professorOrigemId === professorId && c.blocoOrigemId) {
        mudancas.push({
          dataISO: dia.dataISO,
          turma: turma.get(c.turmaId) ?? '',
          bloco: descreverBloco(bloco.get(c.blocoId)!),
          tipo: 'adiantamento',
          detalhe: `Sua aula de ${celula.get(`${c.turmaId}|${c.blocoOrigemId}`)?.disciplina ?? ''} passa de ${descreverBloco(bloco.get(c.blocoOrigemId)!)} para este horário`,
        });
      }
    }
  }
  const pos = (m: MudancaDoProfessor) => m.dataISO + m.bloco;
  return mudancas.sort((a, b) => pos(a).localeCompare(pos(b)));
}
