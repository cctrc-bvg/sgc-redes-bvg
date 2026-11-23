'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { disciplinasDaDistribuicao, professoresAptos } from '@/lib/ofertas/consultas';
import { PREFIXO_CAMPO, lerAnoLetivo, planejarDistribuicao, resumirPlano, semestreLetivoDaDisciplina, type OfertaAtual } from '@/lib/ofertas/regras';

// turmaId e ano letivo chegam por campos ocultos, nunca por `acao.bind(...)` (ver usuarios/actions.ts).

export type EstadoDistribuicao = {
  /** Erro por disciplinaId. */
  erros?: Record<string, string>;
  mensagem?: string;
  sucesso?: boolean;
  /** Professor escolhido por disciplinaId, para não perder o que foi preenchido após erro. */
  valores?: Record<string, string>;
};

export async function salvarDistribuicao(_estado: EstadoDistribuicao | undefined, formData: FormData): Promise<EstadoDistribuicao> {
  const { usuario: editor } = await exigirPermissao('ofertas:gerenciar');
  const anoLetivo = lerAnoLetivo(formData.get('anoLetivo'));
  const turma = await prisma.turma.findUnique({ where: { id: String(formData.get('turmaId') ?? '') } });
  if (!anoLetivo || !turma) return { mensagem: 'Turma ou ano letivo inválido. Volte à lista de ofertas e tente de novo.' };
  if (!turma.anoCurso) return { mensagem: 'Esta turma não tem o ano do curso definido.' };

  // A lista de disciplinas vem do banco; ids extras enviados no formulário são ignorados.
  const disciplinas = await disciplinasDaDistribuicao({ id: turma.id, anoCurso: turma.anoCurso }, anoLetivo);
  const desejado = new Map<string, string>();
  const atuais = new Map<string, OfertaAtual>();
  for (const d of disciplinas) {
    const campo = formData.get(PREFIXO_CAMPO + d.id);
    // Campo ausente (disciplina incluída depois que a página abriu): mantém como está.
    if (campo !== null) desejado.set(d.id, String(campo));
    const oferta = d.ofertas[0];
    if (oferta) {
      atuais.set(d.id, {
        id: oferta.id,
        professorId: oferta.professorId,
        emUso: oferta._count.horarios > 0 || oferta._count.ausencias > 0,
      });
    }
  }
  const valores = Object.fromEntries(desejado);
  const aptos = new Set((await professoresAptos()).map((p) => p.id));

  const plano = planejarDistribuicao({ atuais, desejado, professoresAptos: aptos });
  if (Object.keys(plano.erros).length > 0) {
    return { erros: plano.erros, valores, mensagem: 'Nada foi salvo. Corrija as disciplinas indicadas abaixo.' };
  }
  const mensagem = resumirPlano(plano);
  if (plano.criar.length + plano.alterar.length + plano.remover.length === 0) return { sucesso: true, mensagem, valores };

  const porId = new Map(disciplinas.map((d) => [d.id, d]));
  try {
    await prisma.$transaction([
      ...plano.criar.map(({ disciplinaId, professorId }) => {
        const d = porId.get(disciplinaId)!;
        return prisma.disciplinaOferta.create({
          data: {
            anoLetivo,
            semestreLetivo: semestreLetivoDaDisciplina(d.semestreCurso),
            turmaId: turma.id,
            disciplinaId,
            professorId,
            // Blocos de 60 min (G01): 1 aula = 1 hora da carga horária.
            aulasPrevistas: d.cargaHoraria,
          },
        });
      }),
      ...plano.alterar.map((a) => prisma.disciplinaOferta.update({ where: { id: a.ofertaId }, data: { professorId: a.professorNovo } })),
      prisma.disciplinaOferta.deleteMany({ where: { id: { in: plano.remover.map((r) => r.ofertaId) } } }),
    ]);
  } catch (e) {
    // Outra pessoa salvou a mesma turma ao mesmo tempo (oferta duplicada ou já usada).
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || e.code === 'P2003')) {
      return { valores, mensagem: 'A distribuição desta turma mudou enquanto você editava. Recarregue a página e confira antes de salvar.' };
    }
    throw e;
  }

  await registrarAuditoria({
    userId: editor.id,
    acao: 'DISTRIBUIU_DISCIPLINAS',
    entidade: 'Turma',
    entidadeId: turma.id,
    detalhes: {
      anoLetivo,
      criadas: plano.criar,
      alteradas: plano.alterar.map(({ disciplinaId, professorAnterior, professorNovo }) => ({ disciplinaId, professorAnterior, professorNovo })),
      removidas: plano.remover.map((r) => r.disciplinaId),
    },
  });
  revalidatePath('/ofertas');
  return { sucesso: true, mensagem, valores };
}
