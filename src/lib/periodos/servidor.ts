import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { dataDoBanco, dataParaBanco, periodoDaData } from '@/lib/ausencias/regras';
import { carregarAno } from '@/lib/calendario/servidor';
import { diaDaSemanaISO } from '@/lib/calendario/regras';
import { diasDoPeriodo, planoAlimentar, type TurmaDoPlano } from './regras';

type Db = Prisma.TransactionClient | typeof prisma;

const SELECAO_CELULA = {
  turmaId: true,
  blocoId: true,
  ofertaId: true,
  turma: { select: { nome: true } },
  oferta: { select: { professorId: true, professor: { select: { nome: true } }, disciplina: { select: { nome: true } } } },
} as const;

export type CelulaDoDia = Prisma.GradeHorarioGetPayload<{ select: typeof SELECAO_CELULA }>;

/**
 * Grade que vale na data: nas turmas com grade especial no período que cobre a data, as células especiais substituem
 * as normais; as demais turmas seguem a grade normal. `diaSemana` já é o dia da grade (G14).
 */
export async function aplicarGradeEspecial(dataISO: string, diaSemana: number, normais: CelulaDoDia[], db: Db = prisma): Promise<CelulaDoDia[]> {
  const d = dataParaBanco(dataISO);
  const periodos = await db.periodoEspecial.findMany({ where: { inicio: { lte: d }, fim: { gte: d } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  if (periodos.length === 0) return normais;
  const periodoId = periodos[0]!.id;
  const turmasEspeciais = await db.gradeEspecial.findMany({ where: { periodoId }, distinct: ['turmaId'], select: { turmaId: true } });
  if (turmasEspeciais.length === 0) return normais;
  const especiais = new Set(turmasEspeciais.map((t) => t.turmaId));
  const doDia = await db.gradeEspecial.findMany({
    where: { periodoId, diaSemana, ofertaId: { not: null } },
    select: SELECAO_CELULA,
  });
  return [...normais.filter((c) => !especiais.has(c.turmaId)), ...(doDia as CelulaDoDia[])];
}

export async function listarPeriodos() {
  const lista = await prisma.periodoEspecial.findMany({ orderBy: { inicio: 'desc' }, include: { _count: { select: { grades: true } } } });
  return lista.map((p) => ({ id: p.id, nome: p.nome, tipo: p.tipo, inicio: dataDoBanco(p.inicio), fim: dataDoBanco(p.fim), observacao: p.observacao, comGrade: p._count.grades > 0 }));
}

/** Tudo de um período: turmas ativas com a grade especial, presenças e o plano alimentar. */
export async function carregarPeriodo(id: string) {
  const p = await prisma.periodoEspecial.findUnique({ where: { id } });
  if (!p) return null;
  const inicio = dataDoBanco(p.inicio);
  const fim = dataDoBanco(p.fim);
  const { anoLetivo, semestreLetivo } = periodoDaData(inicio);
  const [turmas, blocos, cels, pres, calendario] = await Promise.all([
    prisma.turma.findMany({ where: { ativa: true }, orderBy: { codigo: 'asc' } }),
    prisma.blocoHorario.findMany({ orderBy: [{ turno: 'asc' }, { ordem: 'asc' }] }),
    prisma.gradeEspecial.findMany({ where: { periodoId: id }, select: { turmaId: true, diaSemana: true, blocoId: true, ofertaId: true, bloco: { select: { turno: true } } } }),
    prisma.presencaEspecial.findMany({ where: { periodoId: id } }),
    carregarAno(Number(inicio.slice(0, 4))),
  ]);
  const ofertas = await prisma.disciplinaOferta.findMany({
    where: { anoLetivo, OR: [{ semestreLetivo: null }, { semestreLetivo }] },
    select: { id: true, turmaId: true, disciplina: { select: { nome: true } }, professor: { select: { nome: true } } },
    orderBy: { disciplina: { nome: 'asc' } },
  });
  const dias = diasDoPeriodo(inicio, fim, new Set(calendario.contagem.letivos));
  const turmasDoPlano: TurmaDoPlano[] = turmas.map((t) => ({
    codigo: t.codigo,
    ativos: t.qtdAlunosAtivos,
    normal: { LANCHE_MANHA: t.qtdMediaLancheManha, ALMOCO: t.qtdMediaAlmoco, LANCHE_TARDE: t.qtdMediaLancheTarde },
    celulas: cels.filter((c) => c.turmaId === t.id).map((c) => ({ diaSemana: c.diaSemana, turno: c.bloco.turno === 'MANHA' ? ('MANHA' as const) : ('TARDE' as const), ofertaId: c.ofertaId })),
    presentes: new Map(pres.filter((x) => x.turmaId === t.id).map((x) => [dataDoBanco(x.data), x.qtdAlunos])),
  }));
  const comGrade = new Set(cels.map((c) => c.turmaId));
  // Turma sem grade especial segue a grade normal nesses dias: o plano só considera quem tem grade especial.
  const plano = planoAlimentar(dias, turmasDoPlano.filter((t) => comGrade.has(turmas.find((x) => x.codigo === t.codigo)!.id)), diaDaSemanaISO);
  return {
    periodo: { id: p.id, nome: p.nome, tipo: p.tipo, inicio, fim, observacao: p.observacao },
    anoLetivo,
    semestreLetivo,
    turmas,
    blocos,
    ofertas,
    dias,
    celulas: cels,
    presencas: pres.map((x) => ({ turmaId: x.turmaId, data: dataDoBanco(x.data), qtdAlunos: x.qtdAlunos })),
    plano,
  };
}
