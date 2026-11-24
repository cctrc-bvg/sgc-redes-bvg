'use server';

import * as z from 'zod';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { anoLetivoAtual } from '@/lib/ofertas/regras';
import { TurmaSchema, verificarExclusaoTurma, verificarTrocaAnoCurso, type DadosTurma } from '@/lib/turmas/regras';

// O id da turma chega por campo oculto, nunca por `acao.bind(null, id)` (ver usuarios/actions.ts).

const CAMPOS = ['codigo', 'nome', 'anoCurso', 'qtdAlunosAtivos', 'qtdMediaLancheManha', 'qtdMediaAlmoco', 'qtdMediaLancheTarde'] as const;
type ErrosCampos = Partial<Record<(typeof CAMPOS)[number], string[]>>;

export type EstadoTurma = {
  erros?: ErrosCampos;
  mensagem?: string;
  sucesso?: boolean;
  turmaId?: string;
  valores?: Record<string, string>;
};

function lerFormulario(formData: FormData) {
  return Object.fromEntries(CAMPOS.map((c) => [c, String(formData.get(c) ?? '')])) as Record<(typeof CAMPOS)[number], string>;
}

function erroDeUnicidade(e: unknown): ErrosCampos | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return { codigo: ['Já existe uma turma com este código.'] };
  }
  return null;
}

function revalidarListas() {
  // A lista de turmas ativas aparece também em Ofertas e na Grade.
  revalidatePath('/turmas');
  revalidatePath('/ofertas');
  revalidatePath('/grade');
}

export async function criarTurma(_estado: EstadoTurma | undefined, formData: FormData): Promise<EstadoTurma> {
  const { usuario: editor } = await exigirPermissao('turmas:gerenciar');
  const valores = lerFormulario(formData);
  const validacao = TurmaSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };

  try {
    // `anoLetivo` da turma é legado (ofertas e grade têm o próprio ano letivo): guarda o ano da criação.
    const criada = await prisma.turma.create({ data: { ...validacao.data, anoLetivo: anoLetivoAtual() } });
    await registrarAuditoria({ userId: editor.id, acao: 'CRIOU_TURMA', entidade: 'Turma', entidadeId: criada.id });
    revalidarListas();
    return { sucesso: true, turmaId: criada.id, valores: { nome: criada.nome } };
  } catch (e) {
    const erros = erroDeUnicidade(e);
    if (erros) return { erros, valores };
    throw e;
  }
}

export async function atualizarTurma(_estado: EstadoTurma | undefined, formData: FormData): Promise<EstadoTurma> {
  const { usuario: editor } = await exigirPermissao('turmas:gerenciar');
  const turmaId = String(formData.get('turmaId') ?? '');
  const valores = { ...lerFormulario(formData), ativa: formData.get('ativa') === 'on' ? 'on' : '' };
  const validacao = TurmaSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };

  const atual = await prisma.turma.findUnique({ where: { id: turmaId }, include: { _count: { select: { ofertas: true } } } });
  if (!atual) return { mensagem: 'Turma não encontrada. Ela pode ter sido excluída.' };

  const bloqueioAno = verificarTrocaAnoCurso(atual.anoCurso, validacao.data.anoCurso, atual._count.ofertas);
  if (bloqueioAno) return { erros: { anoCurso: [bloqueioAno] }, valores };

  const dados: DadosTurma & { ativa: boolean } = { ...validacao.data, ativa: valores.ativa === 'on' };
  const alterados = (Object.keys(dados) as (keyof typeof dados)[]).filter((k) => dados[k] !== atual[k]);
  if (alterados.length === 0) return { sucesso: true, mensagem: 'Nenhuma alteração para salvar.', valores };

  try {
    await prisma.turma.update({ where: { id: atual.id }, data: dados });
  } catch (e) {
    const erros = erroDeUnicidade(e);
    if (erros) return { erros, valores };
    throw e;
  }
  await registrarAuditoria({
    userId: editor.id,
    acao: atual.ativa && !dados.ativa ? 'DESATIVOU_TURMA' : !atual.ativa && dados.ativa ? 'REATIVOU_TURMA' : 'EDITOU_TURMA',
    entidade: 'Turma',
    entidadeId: atual.id,
    // Quantidades não são dados pessoais; guardar antes/depois ajuda a explicar avisos de refeição antigos.
    detalhes: {
      camposAlterados: alterados,
      ...Object.fromEntries(
        alterados
          .filter((k) => k.startsWith('qtd'))
          .map((k) => [k, { de: atual[k as keyof DadosTurma], para: dados[k as keyof DadosTurma] }]),
      ),
    },
  });
  revalidarListas();
  return { sucesso: true, mensagem: 'Alterações salvas.', valores };
}

export async function excluirTurma(_estado: EstadoTurma | undefined, formData: FormData): Promise<EstadoTurma> {
  const { usuario: editor } = await exigirPermissao('turmas:gerenciar');
  const turmaId = String(formData.get('turmaId') ?? '');
  if (formData.get('confirmo') !== 'on') {
    return { mensagem: 'Marque a confirmação para excluir a turma.' };
  }
  const alvo = await prisma.turma.findUnique({
    where: { id: turmaId },
    select: { id: true, _count: { select: { ofertas: true, gradeHoraria: true, ausencias: true, alertasRefeicao: true } } },
  });
  if (!alvo) return { mensagem: 'Turma não encontrada. Ela pode já ter sido excluída.' };

  const bloqueio = verificarExclusaoTurma(alvo._count);
  if (bloqueio) return { mensagem: bloqueio };

  try {
    await prisma.turma.delete({ where: { id: alvo.id } });
  } catch (e) {
    // Uma oferta ou horário pode ter sido criado entre a contagem e a exclusão.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return { mensagem: 'Esta turma acabou de ser usada em ofertas, grade ou avisos e não pode mais ser excluída. Desative-a.' };
    }
    throw e;
  }
  await registrarAuditoria({ userId: editor.id, acao: 'EXCLUIU_TURMA', entidade: 'Turma', entidadeId: alvo.id });
  revalidarListas();
  redirect('/turmas?aviso=excluida');
}
