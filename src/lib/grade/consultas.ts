import 'server-only';
import { prisma } from '@/lib/db';

/** Blocos na ordem do dia: manhã A–D, tarde A–D. */
export function blocosOrdenados() {
  return prisma.blocoHorario.findMany({ orderBy: [{ turno: 'asc' }, { ordem: 'asc' }] });
}

/** Ofertas da turma que entram na grade do semestre (anuais + técnicas do semestre). */
export function ofertasDoSemestre(turmaId: string, anoLetivo: number, semestreLetivo: number) {
  return prisma.disciplinaOferta.findMany({
    where: { turmaId, anoLetivo, OR: [{ semestreLetivo: null }, { semestreLetivo }] },
    orderBy: { disciplina: { nome: 'asc' } },
    select: {
      id: true,
      semestreLetivo: true,
      professorId: true,
      professor: { select: { nome: true } },
      disciplina: { select: { nome: true, codigo: true, cargaHoraria: true } },
    },
  });
}

/** Células preenchidas da grade de uma turma no período. */
export function celulasDaTurma(turmaId: string, anoLetivo: number, semestreLetivo: number) {
  return prisma.gradeHorario.findMany({
    where: { turmaId, anoLetivo, semestreLetivo },
    select: {
      id: true,
      diaSemana: true,
      blocoId: true,
      ofertaId: true,
      oferta: { select: { disciplina: { select: { nome: true } }, professor: { select: { nome: true } } } },
    },
  });
}

/** Aulas de um professor em todas as turmas no período ("minha grade"). */
export function celulasDoProfessor(professorId: string, anoLetivo: number, semestreLetivo: number) {
  return prisma.gradeHorario.findMany({
    where: { anoLetivo, semestreLetivo, oferta: { professorId } },
    select: {
      diaSemana: true,
      blocoId: true,
      turma: { select: { nome: true } },
      oferta: { select: { disciplina: { select: { nome: true } } } },
    },
  });
}

/** Sábados letivos do semestre (jan–jun ou jul–dez). */
export function sabadosDoSemestre(anoLetivo: number, semestreLetivo: number) {
  const inicio = new Date(Date.UTC(anoLetivo, semestreLetivo === 1 ? 0 : 6, 1));
  const fim = new Date(Date.UTC(semestreLetivo === 1 ? anoLetivo : anoLetivo + 1, semestreLetivo === 1 ? 6 : 0, 1));
  return prisma.sabadoLetivo.findMany({ where: { data: { gte: inicio, lt: fim } }, orderBy: { data: 'asc' } });
}
