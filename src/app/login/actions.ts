'use server';

import bcrypt from 'bcryptjs';
import * as z from 'zod';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ipDaRequisicao, registrarAuditoria } from '@/lib/auditoria';
import { criarSessao } from '@/lib/auth/sessao';
import { LimitadorTentativas } from '@/lib/auth/limitador';
import { LoginSchema, destinoSeguro } from '@/lib/auth/validacao';

export type EstadoLogin = {
  erros?: { email?: string[]; senha?: string[] };
  mensagem?: string;
  email?: string;
};

// Uma instância por processo (implantação de instância única no campus).
const limitePorEmail = new LimitadorTentativas(5, 15 * 60 * 1000);
const limitePorIp = new LimitadorTentativas(20, 15 * 60 * 1000);

// Hash usado quando o e-mail não existe, para a resposta levar o mesmo tempo
// e não revelar quais e-mails estão cadastrados.
const HASH_FICTICIO = '$2b$12$PB.d81qmyAfzcUzrzDcsK..ANJayZw8/mnc33GGOPPtLpn9ZI1PMy';

const MENSAGEM_CREDENCIAIS = 'E-mail ou senha incorretos. Verifique e tente novamente.';

export async function entrar(_estado: EstadoLogin | undefined, formData: FormData): Promise<EstadoLogin> {
  const emailDigitado = String(formData.get('email') ?? '');
  const validacao = LoginSchema.safeParse({ email: emailDigitado, senha: formData.get('senha') });
  if (!validacao.success) {
    return { erros: z.flattenError(validacao.error).fieldErrors, email: emailDigitado };
  }
  const { email, senha } = validacao.data;
  const ip = (await ipDaRequisicao()) ?? 'desconhecido';

  const bloqueio = Math.max(limitePorEmail.minutosBloqueado(email), limitePorIp.minutosBloqueado(ip));
  if (bloqueio > 0) {
    return {
      mensagem: `Muitas tentativas sem sucesso. Aguarde ${bloqueio} minuto(s) e tente de novo, ou peça à Coordenação para redefinir sua senha.`,
      email,
    };
  }

  const usuario = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, ativo: true, deveTrocarSenha: true },
  });
  const senhaConfere = await bcrypt.compare(senha, usuario?.passwordHash ?? HASH_FICTICIO);

  if (!usuario || !usuario.ativo || !senhaConfere) {
    limitePorEmail.registrarFalha(email);
    limitePorIp.registrarFalha(ip);
    await registrarAuditoria({
      userId: usuario?.id ?? null,
      acao: 'LOGIN_FALHOU',
      entidade: 'User',
      entidadeId: usuario?.id ?? '-',
      detalhes: { motivo: !usuario ? 'usuario_inexistente' : !usuario.ativo ? 'usuario_inativo' : 'senha_incorreta' },
    });
    return { mensagem: MENSAGEM_CREDENCIAIS, email };
  }

  limitePorEmail.limpar(email);
  await criarSessao(usuario.id);
  await prisma.user.update({ where: { id: usuario.id }, data: { ultimoLoginEm: new Date() } });
  await registrarAuditoria({ userId: usuario.id, acao: 'LOGIN', entidade: 'User', entidadeId: usuario.id });

  redirect(usuario.deveTrocarSenha ? '/conta/senha' : destinoSeguro(formData.get('proximo')));
}
