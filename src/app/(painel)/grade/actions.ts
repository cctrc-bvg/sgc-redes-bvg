'use server';

import * as z from 'zod';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { blocosOrdenados, ofertasDoSemestre } from '@/lib/grade/consultas';
import { garantirRevisaoInicial, registrarRevisaoSeMudou } from '@/lib/calendario/revisoes';
import { DIAS_SEMANA, PREFIXO_CELULA, SabadoLetivoSchema, chaveCelula, lerSemestreLetivo, planejarGrade, type PlanoGrade } from '@/lib/grade/regras';
import { lerAnoLetivo } from '@/lib/ofertas/regras';

// turmaId, ano e semestre chegam por campos ocultos, nunca por `acao.bind(...)` (ver usuarios/actions.ts).

export type EstadoGrade = {
  erros?: Record<string, string>;
  mensagem?: string;
  sucesso?: boolean;
  valores?: Record<string, string>;
};

async function contexto(formData: FormData) {
  const anoLetivo = lerAnoLetivo(formData.get('anoLetivo'));
  const semestreLetivo = lerSemestreLetivo(formData.get('semestreLetivo'));
  const turma = await prisma.turma.findUnique({ where: { id: String(formData.get('turmaId') ?? '') }, select: { id: true } });
  return anoLetivo && semestreLetivo && turma ? { anoLetivo, semestreLetivo, turmaId: turma.id } : null;
}

/** Professor|célula → nome da turma, para as aulas das OUTRAS turmas no mesmo período. */
async function ocupacaoDeOutrasTurmas(turmaId: string, anoLetivo: number, semestreLetivo: number) {
  const outras = await prisma.gradeHorario.findMany({
    where: { anoLetivo, semestreLetivo, turmaId: { not: turmaId }, ofertaId: { not: null } },
    select: { diaSemana: true, blocoId: true, turma: { select: { nome: true } }, oferta: { select: { professorId: true } } },
  });
  return new Map(outras.map((c) => [`${c.oferta!.professorId}|${chaveCelula(c.diaSemana, c.blocoId)}`, c.turma.nome]));
}

/** Grava o plano numa transação (upsert pela chave única da célula). */
async function aplicarPlano(plano: PlanoGrade, ctx: { anoLetivo: number; semestreLetivo: number; turmaId: string }) {
  const onde = (chave: string) => {
    const [dia, blocoId] = chave.split(':');
    return { anoLetivo: ctx.anoLetivo, semestreLetivo: ctx.semestreLetivo, turmaId: ctx.turmaId, diaSemana: Number(dia), blocoId };
  };
  await prisma.$transaction([
    ...plano.gravar.map(({ chave, ofertaId }) =>
      prisma.gradeHorario.upsert({
        where: { anoLetivo_semestreLetivo_turmaId_diaSemana_blocoId: onde(chave) },
        create: { ...onde(chave), ofertaId },
        update: { ofertaId },
      }),
    ),
    ...plano.remover.map((chave) => prisma.gradeHorario.deleteMany({ where: onde(chave) })),
  ]);
}

export async function salvarGrade(_estado: EstadoGrade | undefined, formData: FormData): Promise<EstadoGrade> {
  const { usuario: editor } = await exigirPermissao('grade:editar');
  const ctx = await contexto(formData);
  if (!ctx) return { mensagem: 'Turma ou período inválido. Volte à grade e tente de novo.' };

  const [blocos, ofertas, atuais, ocupacao] = await Promise.all([
    blocosOrdenados(),
    ofertasDoSemestre(ctx.turmaId, ctx.anoLetivo, ctx.semestreLetivo),
    prisma.gradeHorario.findMany({
      where: { turmaId: ctx.turmaId, anoLetivo: ctx.anoLetivo, semestreLetivo: ctx.semestreLetivo },
      select: { diaSemana: true, blocoId: true, ofertaId: true },
    }),
    ocupacaoDeOutrasTurmas(ctx.turmaId, ctx.anoLetivo, ctx.semestreLetivo),
  ]);

  // Só células de blocos reais; campo ausente mantém a célula como está.
  const desejado = new Map<string, string>();
  for (const dia of DIAS_SEMANA) {
    for (const b of blocos) {
      const valor = formData.get(PREFIXO_CELULA + chaveCelula(dia, b.id));
      if (valor !== null) desejado.set(chaveCelula(dia, b.id), String(valor));
    }
  }
  const valores = Object.fromEntries(desejado);
  const plano = planejarGrade({
    atuais: new Map(atuais.map((c) => [chaveCelula(c.diaSemana, c.blocoId), c.ofertaId])),
    desejado,
    ofertas: new Map(ofertas.map((o) => [o.id, { professorId: o.professorId }])),
    ocupacao,
  });
  if (Object.keys(plano.erros).length > 0) {
    return { erros: plano.erros, valores, mensagem: 'Nada foi salvo. Corrija os horários indicados na grade.' };
  }
  if (plano.gravar.length + plano.remover.length === 0) return { sucesso: true, mensagem: 'Nenhuma alteração para salvar.', valores };

  try {
    await aplicarPlano(plano, ctx);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || e.code === 'P2003')) {
      return { valores, mensagem: 'A grade mudou enquanto você editava. Recarregue a página e confira antes de salvar.' };
    }
    throw e;
  }
  await registrarAuditoria({
    userId: editor.id,
    acao: 'EDITOU_GRADE',
    entidade: 'Turma',
    entidadeId: ctx.turmaId,
    detalhes: { anoLetivo: ctx.anoLetivo, semestreLetivo: ctx.semestreLetivo, gravadas: plano.gravar.length, removidas: plano.remover.length },
  });
  revalidatePath('/grade');
  return {
    sucesso: true,
    mensagem: `Grade salva: ${plano.gravar.length} horário(s) preenchido(s) ou trocado(s), ${plano.remover.length} liberado(s).`,
    valores,
  };
}

/**
 * Copia para o 2º semestre as aulas das disciplinas ANUAIS do 1º, só nas células ainda vazias.
 * Células com choque de horário são puladas e informadas.
 */
export async function copiarAnuaisDoPrimeiroSemestre(_estado: EstadoGrade | undefined, formData: FormData): Promise<EstadoGrade> {
  const { usuario: editor } = await exigirPermissao('grade:editar');
  const ctx = await contexto(formData);
  if (!ctx || ctx.semestreLetivo !== 2) return { mensagem: 'A cópia só vale para a grade do 2º semestre.' };

  const [origem, destino, ocupacao] = await Promise.all([
    prisma.gradeHorario.findMany({
      where: { turmaId: ctx.turmaId, anoLetivo: ctx.anoLetivo, semestreLetivo: 1, oferta: { semestreLetivo: null } },
      select: { diaSemana: true, blocoId: true, ofertaId: true, oferta: { select: { professorId: true } } },
    }),
    prisma.gradeHorario.findMany({
      where: { turmaId: ctx.turmaId, anoLetivo: ctx.anoLetivo, semestreLetivo: 2 },
      select: { diaSemana: true, blocoId: true, ofertaId: true },
    }),
    ocupacaoDeOutrasTurmas(ctx.turmaId, ctx.anoLetivo, 2),
  ]);
  const ocupadas = new Set(destino.filter((c) => c.ofertaId).map((c) => chaveCelula(c.diaSemana, c.blocoId)));
  const aCopiar = origem.filter((c) => !ocupadas.has(chaveCelula(c.diaSemana, c.blocoId)));
  if (aCopiar.length === 0) return { sucesso: true, mensagem: 'Nada a copiar: as aulas anuais do 1º semestre já estão na grade ou as células estão ocupadas.' };

  const plano = planejarGrade({
    atuais: new Map(destino.map((c) => [chaveCelula(c.diaSemana, c.blocoId), c.ofertaId])),
    desejado: new Map(aCopiar.map((c) => [chaveCelula(c.diaSemana, c.blocoId), c.ofertaId!])),
    ofertas: new Map(aCopiar.map((c) => [c.ofertaId!, { professorId: c.oferta!.professorId }])),
    ocupacao,
  });
  const puladas = Object.keys(plano.erros).length;
  await aplicarPlano({ ...plano, erros: {} }, ctx);
  await registrarAuditoria({
    userId: editor.id,
    acao: 'COPIOU_GRADE_ANUAIS',
    entidade: 'Turma',
    entidadeId: ctx.turmaId,
    detalhes: { anoLetivo: ctx.anoLetivo, copiadas: plano.gravar.length, puladas },
  });
  revalidatePath('/grade');
  return {
    sucesso: true,
    mensagem: `${plano.gravar.length} aula(s) anual(is) copiada(s) do 1º semestre.${puladas ? ` ${puladas} pulada(s) por choque de horário do professor.` : ''}`,
  };
}

export type EstadoSabado = { erros?: Partial<Record<'data' | 'diaSemanaReferente' | 'observacao', string[]>>; mensagem?: string; sucesso?: boolean; valores?: Record<string, string> };

export async function cadastrarSabado(_estado: EstadoSabado | undefined, formData: FormData): Promise<EstadoSabado> {
  const { usuario: editor } = await exigirPermissao('grade:editar');
  const valores = Object.fromEntries(['data', 'diaSemanaReferente', 'observacao'].map((c) => [c, String(formData.get(c) ?? '')]));
  const validacao = SabadoLetivoSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };
  const ano = Number(validacao.data.data.slice(0, 4));
  await garantirRevisaoInicial(ano);
  let criado: { id: string };
  try {
    criado = await prisma.sabadoLetivo.create({
      data: {
        data: new Date(`${validacao.data.data}T00:00:00Z`),
        diaSemanaReferente: validacao.data.diaSemanaReferente,
        observacao: validacao.data.observacao ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { erros: { data: ['Este sábado já está cadastrado.'] }, valores };
    }
    throw e;
  }
  // Fora do try acima: um conflito na revisão (índice único) não pode virar "sábado já cadastrado".
  await registrarRevisaoSeMudou({ ano, autorId: editor.id, origem: 'SABADO' });
  await registrarAuditoria({ userId: editor.id, acao: 'CADASTROU_SABADO_LETIVO', entidade: 'SabadoLetivo', entidadeId: criado.id });
  revalidatePath('/grade');
  return { sucesso: true, mensagem: 'Sábado letivo cadastrado.' };
}

export async function excluirSabado(formData: FormData): Promise<void> {
  const { usuario: editor } = await exigirPermissao('grade:editar');
  const id = String(formData.get('sabadoId') ?? '');
  const antes = await prisma.sabadoLetivo.findUnique({ where: { id }, select: { data: true } });
  if (antes) await garantirRevisaoInicial(antes.data.getUTCFullYear());
  const { count } = await prisma.sabadoLetivo.deleteMany({ where: { id } });
  if (count > 0 && antes) await registrarRevisaoSeMudou({ ano: antes.data.getUTCFullYear(), autorId: editor.id, origem: 'SABADO' });
  if (count > 0) await registrarAuditoria({ userId: editor.id, acao: 'EXCLUIU_SABADO_LETIVO', entidade: 'SabadoLetivo', entidadeId: id });
  revalidatePath('/grade');
}
