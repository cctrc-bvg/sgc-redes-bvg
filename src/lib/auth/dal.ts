import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { lerSessao } from './sessao';
import { temPermissao, type Permissao } from './rbac';

/**
 * Camada de acesso (DAL). Toda página e Server Action protegida começa chamando uma destas
 * funções. O `proxy.ts` só faz uma checagem otimista do cookie; a validação real é aqui.
 */

/** Sessão da requisição atual, memoizada durante a renderização. */
export const obterSessao = cache(lerSessao);

/** Exige usuário logado. Se a senha é provisória, envia para a troca de senha. */
export async function exigirUsuario(opcoes: { permitirSenhaProvisoria?: boolean } = {}) {
  const sessao = await obterSessao();
  if (!sessao) redirect('/login');
  if (sessao.usuario.deveTrocarSenha && !opcoes.permitirSenhaProvisoria) redirect('/conta/senha');
  return sessao;
}

/** Exige usuário logado com a permissão indicada. */
export async function exigirPermissao(permissao: Permissao) {
  const sessao = await exigirUsuario();
  if (!temPermissao(sessao.usuario, permissao)) redirect('/painel?aviso=sem-permissao');
  return sessao;
}
