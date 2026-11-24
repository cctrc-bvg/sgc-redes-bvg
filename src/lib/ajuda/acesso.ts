import type { Role } from '@prisma/client';
import { MODULOS, PERFIS, temPermissao } from '@/lib/auth/rbac';
import { TOPICOS, type TopicoAjuda } from './topicos';

/** Tópicos que o perfil pode usar (os demais aparecem só com "ver todos"). */
export const topicoDoPerfil = (t: TopicoAjuda, perfil: Role) => t.permissao === null || temPermissao(perfil, t.permissao);
export const topicosDoPerfil = (perfil: Role) => TOPICOS.filter((t) => topicoDoPerfil(t, perfil));

/** Matriz "quem vê o quê": módulos × perfis, derivada das permissões. */
export function matrizDeAcesso() {
  return MODULOS.map((m) => ({ modulo: m, perfis: PERFIS.map((p) => m.requer.some((r) => temPermissao(p, r))) }));
}
