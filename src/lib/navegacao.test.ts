import { describe, expect, it } from 'vitest';
import { MODULOS, PERFIS, PERMISSOES } from '@/lib/auth/rbac';
import { FUNCOES, funcoesDoPerfil, funcoesPorGrupo } from './navegacao';

describe('navegação', () => {
  it('todo módulo do sistema tem uma função no menu', () => {
    const hrefs = FUNCOES.map((f) => f.href);
    for (const m of MODULOS) expect(hrefs, m.id).toContain(m.href);
  });

  it('permissões válidas e ids únicos', () => {
    for (const f of FUNCOES) for (const p of f.requer) expect(PERMISSOES).toContain(p);
    expect(new Set(FUNCOES.map((f) => f.id)).size).toBe(FUNCOES.length);
  });

  it('cada perfil vê só o que pode', () => {
    for (const perfil of PERFIS) expect(funcoesDoPerfil(perfil).length, perfil).toBeGreaterThan(0);
    expect(funcoesDoPerfil('ASSISTENCIA_ESTUDANTIL').map((f) => f.id)).toEqual(['calendario', 'alimentacao']);
    expect(funcoesDoPerfil('PROFESSOR').map((f) => f.id)).not.toContain('usuarios');
    expect(funcoesPorGrupo('DIRECAO').every((g) => g.funcoes.length > 0)).toBe(true);
  });
});
