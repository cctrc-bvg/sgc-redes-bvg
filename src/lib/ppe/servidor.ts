import 'server-only';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { temPermissao } from '@/lib/auth/rbac';
import { anoDoSemestre, excedeLimitePpe } from './regras';

type Db = Prisma.TransactionClient | typeof prisma;

/** Disciplinas que o docente leciona no ano letivo (é ele quem define a PPE delas — Arts. 117/118). */
export async function disciplinasDoDocente(professorId: string, anoLetivo: number, db: Db = prisma): Promise<Set<string>> {
  const ofertas = await db.disciplinaOferta.findMany({ where: { professorId, anoLetivo }, select: { disciplinaId: true } });
  return new Set(ofertas.map((o) => o.disciplinaId));
}

export type Acesso = { ver: boolean; definir: boolean; gerenciar: boolean };

/**
 * O que o usuário pode fazer com uma PPE: Coordenação gerencia tudo; docente define e acompanha as das
 * disciplinas que leciona no ano; CTP (e demais com ppe:ver) só consulta (Art. 127).
 */
export async function acessoAoPpe(usuario: { id: string; role: Role }, ppe: { disciplinaId: string; semestre: string }): Promise<Acesso> {
  const gerenciar = temPermissao(usuario.role, 'ppe:gerenciar');
  const ver = temPermissao(usuario.role, 'ppe:ver');
  if (gerenciar) return { ver: true, definir: true, gerenciar: true };
  const ehDocente = temPermissao(usuario.role, 'ppe:definir') && (await disciplinasDoDocente(usuario.id, anoDoSemestre(ppe.semestre))).has(ppe.disciplinaId);
  // Professor só vê as PPEs das próprias disciplinas; CTP vê todas.
  const verTodas = ver && !temPermissao(usuario.role, 'ppe:definir');
  return { ver: verTodas || ehDocente, definir: ehDocente, gerenciar: false };
}

/** Art. 115: marca (ou desmarca) o alerta de retenção em todas as PPEs do estudante no semestre. */
export async function recalcularRetencao(db: Db, matricula: string, semestre: string) {
  const total = await db.registroPPE.count({ where: { matricula, semestre } });
  await db.registroPPE.updateMany({ where: { matricula, semestre }, data: { alertaRetencao: excedeLimitePpe(total) } });
  return total;
}
