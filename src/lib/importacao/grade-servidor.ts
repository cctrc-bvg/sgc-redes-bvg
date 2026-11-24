import 'server-only';
import { prisma } from '@/lib/db';
import type { BlocoImportacao, CelulaAtual, OfertaImportacao } from './grade';

/** Turmas, blocos, ofertas do semestre (anuais + técnicas) e a grade cadastrada, para a importação. */
export async function dadosDaGrade(anoLetivo: number, semestreLetivo: number) {
  const [turmas, blocos, ofertas, atuais] = await Promise.all([
    prisma.turma.findMany({ where: { ativa: true }, select: { id: true, codigo: true }, orderBy: { codigo: 'asc' } }),
    prisma.blocoHorario.findMany({ orderBy: [{ turno: 'asc' }, { ordem: 'asc' }] }),
    prisma.disciplinaOferta.findMany({
      where: { anoLetivo, OR: [{ semestreLetivo: null }, { semestreLetivo }], turma: { ativa: true } },
      select: {
        id: true,
        turmaId: true,
        semestreLetivo: true,
        professorId: true,
        professor: { select: { nome: true, email: true } },
        disciplina: { select: { nome: true, codigo: true, cargaHoraria: true } },
        turma: { select: { codigo: true } },
      },
      orderBy: [{ turma: { codigo: 'asc' } }, { disciplina: { nome: 'asc' } }],
    }),
    prisma.gradeHorario.findMany({ where: { anoLetivo, semestreLetivo }, select: { turmaId: true, diaSemana: true, blocoId: true, ofertaId: true } }),
  ]);
  return {
    turmas,
    blocos: blocos as (BlocoImportacao & { horaFim: string })[],
    ofertasBd: ofertas,
    ofertas: ofertas.map(
      (o): OfertaImportacao => ({
        id: o.id,
        turmaId: o.turmaId,
        disciplina: o.disciplina.nome,
        codigo: o.disciplina.codigo,
        professorId: o.professorId,
        professorNome: o.professor.nome,
        professorEmail: o.professor.email,
      }),
    ),
    atuais: atuais as CelulaAtual[],
  };
}
