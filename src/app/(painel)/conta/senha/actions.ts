'use server';

import bcrypt from 'bcryptjs';
import * as z from 'zod';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirUsuario } from '@/lib/auth/dal';
import { encerrarOutrasSessoes } from '@/lib/auth/sessao';
import { NovaSenhaSchema } from '@/lib/auth/validacao';

export type EstadoTrocaSenha = {
  erros?: { senhaAtual?: string[]; novaSenha?: string[]; confirmacao?: string[] };
  sucesso?: boolean;
};

const CUSTO_BCRYPT = 12; // ARQUITETURA_LGPD.md, item 5

export async function trocarSenha(_estado: EstadoTrocaSenha | undefined, formData: FormData): Promise<EstadoTrocaSenha> {
  const { sessaoId, usuario } = await exigirUsuario({ permitirSenhaProvisoria: true });

  const validacao = NovaSenhaSchema.safeParse({
    senhaAtual: formData.get('senhaAtual'),
    novaSenha: formData.get('novaSenha'),
    confirmacao: formData.get('confirmacao'),
  });
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors };

  const { senhaAtual, novaSenha } = validacao.data;
  const atual = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(senhaAtual, atual.passwordHash))) {
    return { erros: { senhaAtual: ['A senha atual não confere.'] } };
  }

  await prisma.user.update({
    where: { id: usuario.id },
    data: { passwordHash: await bcrypt.hash(novaSenha, CUSTO_BCRYPT), deveTrocarSenha: false },
  });
  // Quem tivesse a senha antiga perde o acesso em outros dispositivos.
  await encerrarOutrasSessoes(usuario.id, sessaoId);
  await registrarAuditoria({ userId: usuario.id, acao: 'TROCOU_SENHA', entidade: 'User', entidadeId: usuario.id });

  return { sucesso: true };
}
