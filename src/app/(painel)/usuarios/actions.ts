'use server';

import bcrypt from 'bcryptjs';
import * as z from 'zod';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { UsuarioSchema, gerarSenhaProvisoria, verificarAlteracao } from '@/lib/usuarios/regras';

const CUSTO_BCRYPT = 12;

// O id do usuário-alvo chega por campo oculto do formulário, e não por `acao.bind(null, id)`:
// criar a ação com .bind() durante o render faz o React 19 re-renderizar sem fim no envio
// sem JavaScript (progressive enhancement), travando o servidor. O id não é confiável em
// nenhum dos dois casos; a segurança vem de exigirPermissao() e verificarAlteracao().

type ErrosCampos = Partial<Record<'nome' | 'email' | 'role' | 'siape' | 'whatsapp', string[]>>;

export type EstadoUsuario = {
  erros?: ErrosCampos;
  mensagem?: string;
  sucesso?: boolean;
  senhaProvisoria?: string;
  usuarioId?: string;
  valores?: Record<string, string>;
};

function lerFormulario(formData: FormData) {
  const campos = ['nome', 'email', 'role', 'siape', 'whatsapp'] as const;
  return Object.fromEntries(campos.map((c) => [c, String(formData.get(c) ?? '')])) as Record<(typeof campos)[number], string>;
}

/** Converte violação de unicidade do banco em erro no campo correspondente. */
function erroDeUnicidade(e: unknown): ErrosCampos | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const alvo = String((e.meta?.target as string[] | string | undefined) ?? '');
    if (alvo.includes('email')) return { email: ['Já existe um usuário com este e-mail.'] };
    if (alvo.includes('siape')) return { siape: ['Já existe um usuário com esta matrícula SIAPE.'] };
  }
  return null;
}

export async function criarUsuario(_estado: EstadoUsuario | undefined, formData: FormData): Promise<EstadoUsuario> {
  const { usuario: editor } = await exigirPermissao('usuarios:gerenciar');
  const valores = lerFormulario(formData);
  const validacao = UsuarioSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };

  const senhaProvisoria = gerarSenhaProvisoria();
  try {
    const criado = await prisma.user.create({
      data: {
        ...validacao.data,
        siape: validacao.data.siape ?? null,
        whatsapp: validacao.data.whatsapp ?? null,
        passwordHash: await bcrypt.hash(senhaProvisoria, CUSTO_BCRYPT),
        deveTrocarSenha: true,
      },
    });
    await registrarAuditoria({
      userId: editor.id,
      acao: 'CRIOU_USUARIO',
      entidade: 'User',
      entidadeId: criado.id,
      detalhes: { perfil: criado.role },
    });
    revalidatePath('/usuarios');
    return { sucesso: true, senhaProvisoria, usuarioId: criado.id, valores: { nome: criado.nome, email: criado.email } };
  } catch (e) {
    const erros = erroDeUnicidade(e);
    if (erros) return { erros, valores };
    throw e;
  }
}

export async function atualizarUsuario(_estado: EstadoUsuario | undefined, formData: FormData): Promise<EstadoUsuario> {
  const { usuario: editor } = await exigirPermissao('usuarios:gerenciar');
  const usuarioId = String(formData.get('usuarioId') ?? '');
  const valores = { ...lerFormulario(formData), ativo: formData.get('ativo') === 'on' ? 'on' : '' };
  const validacao = UsuarioSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };

  const atual = await prisma.user.findUnique({ where: { id: usuarioId } });
  if (!atual) return { mensagem: 'Usuário não encontrado. Ele pode ter sido removido.' };

  const novoAtivo = valores.ativo === 'on';
  const bloqueio = verificarAlteracao({
    editorId: editor.id,
    alvoId: atual.id,
    perfilAtual: atual.role,
    ativoAtual: atual.ativo,
    novoPerfil: validacao.data.role,
    novoAtivo,
    coordenadoresAtivos: await prisma.user.count({ where: { role: 'COORDENADOR', ativo: true } }),
  });
  if (bloqueio) return { mensagem: bloqueio, valores };

  const dados = {
    ...validacao.data,
    siape: validacao.data.siape ?? null,
    whatsapp: validacao.data.whatsapp ?? null,
    ativo: novoAtivo,
  };
  // Auditoria registra QUAIS campos mudaram, sem copiar os valores pessoais.
  const alterados = (Object.keys(dados) as (keyof typeof dados)[]).filter((k) => dados[k] !== atual[k]);
  if (alterados.length === 0) return { sucesso: true, mensagem: 'Nenhuma alteração para salvar.', valores };

  try {
    await prisma.user.update({ where: { id: atual.id }, data: dados });
  } catch (e) {
    const erros = erroDeUnicidade(e);
    if (erros) return { erros, valores };
    throw e;
  }
  if (!novoAtivo) await prisma.sessao.deleteMany({ where: { userId: atual.id } });

  await registrarAuditoria({
    userId: editor.id,
    acao: atual.ativo && !novoAtivo ? 'DESATIVOU_USUARIO' : !atual.ativo && novoAtivo ? 'REATIVOU_USUARIO' : 'EDITOU_USUARIO',
    entidade: 'User',
    entidadeId: atual.id,
    detalhes: { camposAlterados: alterados, ...(alterados.includes('role') ? { perfilAnterior: atual.role, perfilNovo: dados.role } : {}) },
  });
  revalidatePath('/usuarios');
  return { sucesso: true, mensagem: 'Alterações salvas.', valores };
}

export async function redefinirSenha(_estado: EstadoUsuario | undefined, formData: FormData): Promise<EstadoUsuario> {
  const { usuario: editor } = await exigirPermissao('usuarios:gerenciar');
  const usuarioId = String(formData.get('usuarioId') ?? '');
  if (usuarioId === editor.id) {
    return { mensagem: 'Para mudar a sua própria senha, use "Alterar senha" no topo da página.' };
  }
  if (formData.get('confirmo') !== 'on') {
    return { mensagem: 'Marque a confirmação para gerar uma nova senha provisória.' };
  }
  const alvo = await prisma.user.findUnique({ where: { id: usuarioId }, select: { id: true } });
  if (!alvo) return { mensagem: 'Usuário não encontrado.' };

  const senhaProvisoria = gerarSenhaProvisoria();
  await prisma.user.update({
    where: { id: alvo.id },
    data: { passwordHash: await bcrypt.hash(senhaProvisoria, CUSTO_BCRYPT), deveTrocarSenha: true },
  });
  await prisma.sessao.deleteMany({ where: { userId: alvo.id } });
  await registrarAuditoria({ userId: editor.id, acao: 'REDEFINIU_SENHA', entidade: 'User', entidadeId: alvo.id });
  return { sucesso: true, senhaProvisoria };
}
