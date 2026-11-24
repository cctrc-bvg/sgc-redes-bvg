'use server';

import { redirect } from 'next/navigation';
import { registrarAuditoria } from '@/lib/auditoria';
import { obterSessao } from '@/lib/auth/dal';
import { encerrarSessao } from '@/lib/auth/sessao';

export async function sair(): Promise<void> {
  const sessao = await obterSessao();
  await encerrarSessao();
  if (sessao) {
    await registrarAuditoria({ userId: sessao.usuario.id, acao: 'LOGOUT', entidade: 'User', entidadeId: sessao.usuario.id });
  }
  redirect('/login');
}
