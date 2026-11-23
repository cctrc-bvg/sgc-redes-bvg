'use server';

import * as z from 'zod';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { DisciplinaSchema, verificarExclusao } from '@/lib/disciplinas/regras';

// O id da disciplina chega por campo oculto, nunca por `acao.bind(null, id)` (ver usuarios/actions.ts).

const CAMPOS = ['codigo', 'nome', 'cargaHoraria', 'exigePratica', 'ementaUrl', 'programaTexto'] as const;
type ErrosCampos = Partial<Record<(typeof CAMPOS)[number], string[]>>;

export type EstadoDisciplina = {
  erros?: ErrosCampos;
  mensagem?: string;
  sucesso?: boolean;
  disciplinaId?: string;
  valores?: Record<string, string>;
};

function lerFormulario(formData: FormData) {
  return Object.fromEntries(CAMPOS.map((c) => [c, String(formData.get(c) ?? '')])) as Record<(typeof CAMPOS)[number], string>;
}

function erroDeUnicidade(e: unknown): ErrosCampos | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return { codigo: ['Já existe uma disciplina com este código.'] };
  }
  return null;
}

/** Converte os dados validados para o formato do banco (opcionais ausentes viram null). */
function paraBanco(d: z.infer<typeof DisciplinaSchema>) {
  return {
    codigo: d.codigo ?? null,
    nome: d.nome,
    cargaHoraria: d.cargaHoraria,
    exigePratica: d.exigePratica,
    ementaUrl: d.ementaUrl ?? null,
    programaTexto: d.programaTexto ?? null,
  };
}

export async function criarDisciplina(_estado: EstadoDisciplina | undefined, formData: FormData): Promise<EstadoDisciplina> {
  const { usuario: editor } = await exigirPermissao('disciplinas:gerenciar');
  const valores = lerFormulario(formData);
  const validacao = DisciplinaSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };

  try {
    const criada = await prisma.disciplina.create({ data: paraBanco(validacao.data) });
    await registrarAuditoria({ userId: editor.id, acao: 'CRIOU_DISCIPLINA', entidade: 'Disciplina', entidadeId: criada.id });
    revalidatePath('/disciplinas');
    return { sucesso: true, disciplinaId: criada.id, valores: { nome: criada.nome } };
  } catch (e) {
    const erros = erroDeUnicidade(e);
    if (erros) return { erros, valores };
    throw e;
  }
}

export async function atualizarDisciplina(_estado: EstadoDisciplina | undefined, formData: FormData): Promise<EstadoDisciplina> {
  const { usuario: editor } = await exigirPermissao('disciplinas:gerenciar');
  const disciplinaId = String(formData.get('disciplinaId') ?? '');
  const valores = { ...lerFormulario(formData), ativa: formData.get('ativa') === 'on' ? 'on' : '' };
  const validacao = DisciplinaSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };

  const atual = await prisma.disciplina.findUnique({ where: { id: disciplinaId } });
  if (!atual) return { mensagem: 'Disciplina não encontrada. Ela pode ter sido excluída.' };

  const dados = { ...paraBanco(validacao.data), ativa: valores.ativa === 'on' };
  const alterados = (Object.keys(dados) as (keyof typeof dados)[]).filter((k) => dados[k] !== atual[k]);
  if (alterados.length === 0) return { sucesso: true, mensagem: 'Nenhuma alteração para salvar.', valores };

  try {
    await prisma.disciplina.update({ where: { id: atual.id }, data: dados });
  } catch (e) {
    const erros = erroDeUnicidade(e);
    if (erros) return { erros, valores };
    throw e;
  }
  await registrarAuditoria({
    userId: editor.id,
    acao: atual.ativa && !dados.ativa ? 'DESATIVOU_DISCIPLINA' : !atual.ativa && dados.ativa ? 'REATIVOU_DISCIPLINA' : 'EDITOU_DISCIPLINA',
    entidade: 'Disciplina',
    entidadeId: atual.id,
    detalhes: {
      camposAlterados: alterados,
      // Carga horária e prática mudam o teto e as travas do PEI: guardar antes/depois ajuda a explicar PEIs antigos.
      ...(alterados.includes('cargaHoraria') ? { cargaHorariaAnterior: atual.cargaHoraria, cargaHorariaNova: dados.cargaHoraria } : {}),
      ...(alterados.includes('exigePratica') ? { exigePraticaNovo: dados.exigePratica } : {}),
    },
  });
  revalidatePath('/disciplinas');
  return { sucesso: true, mensagem: 'Alterações salvas.', valores };
}

export async function excluirDisciplina(_estado: EstadoDisciplina | undefined, formData: FormData): Promise<EstadoDisciplina> {
  const { usuario: editor } = await exigirPermissao('disciplinas:gerenciar');
  const disciplinaId = String(formData.get('disciplinaId') ?? '');
  if (formData.get('confirmo') !== 'on') {
    return { mensagem: 'Marque a confirmação para excluir a disciplina.' };
  }
  const alvo = await prisma.disciplina.findUnique({
    where: { id: disciplinaId },
    select: { id: true, _count: { select: { ofertas: true, ppes: true } } },
  });
  if (!alvo) return { mensagem: 'Disciplina não encontrada. Ela pode já ter sido excluída.' };

  const bloqueio = verificarExclusao(alvo._count);
  if (bloqueio) return { mensagem: bloqueio };

  try {
    await prisma.disciplina.delete({ where: { id: alvo.id } });
  } catch (e) {
    // Uma oferta pode ter sido criada entre a contagem e a exclusão.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return { mensagem: 'Esta disciplina acabou de ser usada em uma oferta ou PPE e não pode mais ser excluída. Desative-a.' };
    }
    throw e;
  }
  await registrarAuditoria({ userId: editor.id, acao: 'EXCLUIU_DISCIPLINA', entidade: 'Disciplina', entidadeId: alvo.id });
  revalidatePath('/disciplinas');
  redirect('/disciplinas?aviso=excluida');
}
