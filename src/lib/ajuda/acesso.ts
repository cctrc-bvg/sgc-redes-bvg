import { MODULOS, PERFIS, temPermissao, type Permissao, type Titular } from '@/lib/auth/rbac';
import { TOPICOS, type TopicoAjuda } from './topicos';

/** Tópicos que o perfil pode usar (os demais aparecem só com "ver todos"). */
export const topicoDoPerfil = (t: TopicoAjuda, perfil: Titular) => t.permissao === null || ([] as Permissao[]).concat(t.permissao).some((p) => temPermissao(perfil, p));
export const topicosDoPerfil = (perfil: Titular) => TOPICOS.filter((t) => topicoDoPerfil(t, perfil));

/** Matriz "quem vê o quê": módulos × perfis, derivada das permissões. */
export function matrizDeAcesso() {
  return MODULOS.map((m) => ({ modulo: m, perfis: PERFIS.map((p) => m.requer.some((r) => temPermissao(p, r))) }));
}
