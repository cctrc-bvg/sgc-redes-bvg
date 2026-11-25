import 'server-only';
import { prisma } from '@/lib/db';
import { ONDE_DOCENTES } from './regras';

/**
 * Disciplinas que aparecem na distribuição de uma turma num ano letivo: as ativas da matriz do ano
 * do curso da turma e, além delas, qualquer uma que já tenha oferta ali (mesmo desativada depois).
 * Inclui a oferta existente, com o uso (grade/ausências) que impede removê-la.
 */
export function disciplinasDaDistribuicao(turma: { id: string; anoCurso: number }, anoLetivo: number) {
  const daTurmaNoAno = { turmaId: turma.id, anoLetivo };
  return prisma.disciplina.findMany({
    where: { OR: [{ ativa: true, anoCurso: turma.anoCurso }, { ofertas: { some: daTurmaNoAno } }] },
    orderBy: [{ semestreCurso: { sort: 'asc', nulls: 'first' } }, { nucleo: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }],
    select: {
      id: true,
      codigo: true,
      nome: true,
      cargaHoraria: true,
      semestreCurso: true,
      ativa: true,
      ofertas: {
        where: daTurmaNoAno,
        select: { id: true, professorId: true, _count: { select: { horarios: true, ausencias: true } } },
      },
    },
  });
}

/** Docentes ativos que podem receber disciplinas. */
export function professoresAptos() {
  return prisma.user.findMany({
    where: ONDE_DOCENTES,
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });
}
