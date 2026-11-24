import 'server-only';
import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { gerarTokenSessao, hashToken } from './token';

export const COOKIE_SESSAO = 'sgc_sessao';

/** Expira após 8h sem uso (um turno de trabalho). */
const INATIVIDADE_MS = 8 * 60 * 60 * 1000;
/** Só regrava a expiração quando passou metade do prazo, para não escrever no banco a cada clique. */
const RENOVAR_APOS_MS = INATIVIDADE_MS / 2;

/**
 * Em produção o cookie é `Secure` (só HTTPS). Para testes via HTTP (ex.: Docker local),
 * defina APP_URL com http:// e o cookie é emitido sem `Secure`.
 */
function cookieSeguro(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  return !(process.env.APP_URL ?? '').startsWith('http://');
}

/** Cria a sessão no banco e grava o cookie. Use apenas em Server Actions. */
export async function criarSessao(userId: string): Promise<void> {
  const token = gerarTokenSessao();
  const h = await headers();
  // Limpeza barata das sessões vencidas de todos os usuários (índice em expiraEm): a tabela não cresce
  // sem limite e não é preciso rotina periódica. Logins são poucos por dia.
  await prisma.sessao.deleteMany({ where: { expiraEm: { lt: new Date() } } });
  await prisma.sessao.create({
    data: {
      id: hashToken(token),
      userId,
      expiraEm: new Date(Date.now() + INATIVIDADE_MS),
      ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: h.get('user-agent')?.slice(0, 255) ?? null,
    },
  });
  // Cookie de sessão (sem Expires): encerra ao fechar o navegador — importante em
  // computadores compartilhados da escola. A expiração por inatividade fica no banco.
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: cookieSeguro(),
    sameSite: 'lax',
    path: '/',
  });
}

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  role: import('@prisma/client').Role;
  deveTrocarSenha: boolean;
};

/** Valida o cookie contra o banco. Retorna o usuário ou null (sem redirecionar). */
export async function lerSessao(): Promise<{ sessaoId: string; usuario: UsuarioSessao } | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;

  const sessaoId = hashToken(token);
  const sessao = await prisma.sessao.findUnique({
    where: { id: sessaoId },
    include: { user: { select: { id: true, nome: true, email: true, role: true, ativo: true, deveTrocarSenha: true } } },
  });
  if (!sessao) return null;

  const agora = Date.now();
  if (sessao.expiraEm.getTime() <= agora || !sessao.user.ativo) {
    await prisma.sessao.delete({ where: { id: sessaoId } }).catch(() => {});
    return null;
  }

  if (sessao.expiraEm.getTime() - agora < INATIVIDADE_MS - RENOVAR_APOS_MS) {
    await prisma.sessao.update({ where: { id: sessaoId }, data: { expiraEm: new Date(agora + INATIVIDADE_MS) } });
  }

  const { ativo: _ativo, ...usuario } = sessao.user;
  return { sessaoId, usuario };
}

/** Remove a sessão atual do banco e apaga o cookie. Use apenas em Server Actions. */
export async function encerrarSessao(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSAO)?.value;
  if (token) await prisma.sessao.deleteMany({ where: { id: hashToken(token) } });
  cookieStore.delete(COOKIE_SESSAO);
}

/** Encerra todas as sessões do usuário, exceto a informada (ex.: após trocar a senha). */
export async function encerrarOutrasSessoes(userId: string, manterSessaoId: string): Promise<void> {
  await prisma.sessao.deleteMany({ where: { userId, NOT: { id: manterSessaoId } } });
}
