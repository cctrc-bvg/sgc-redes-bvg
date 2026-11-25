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

  it('quem acumula a docência vê os grupos do cargo e, à parte, o grupo Docência', () => {
    const coord = funcoesPorGrupo({ role: 'COORDENADOR', leciona: true });
    expect(coord.map((g) => g.grupo)).toEqual(['Operação', 'Acompanhamento', 'Cadastros', 'Docência']);
    expect(coord.flatMap((g) => g.funcoes).filter((f) => f.id === 'minha-grade')).toHaveLength(1);
    expect(coord.at(-1)?.funcoes.map((f) => f.id)).toEqual(['minha-grade', 'informar-ausencia', 'meus-diarios', 'minhas-ppe']);
    // Como cargo, a Coordenação registra ausências: "Informar" só aparece no grupo da docência.
    expect(coord.slice(0, -1).flatMap((g) => g.funcoes).some((f) => f.id === 'informar-ausencia')).toBe(false);
    expect(funcoesDoPerfil('PROFESSOR').map((f) => f.id)).toContain('informar-ausencia');
    expect(funcoesDoPerfil('COORDENADOR').map((f) => f.id)).not.toContain('informar-ausencia');
    // A Direção que leciona ganha também a Grade, que só a docência libera.
    const direcao = funcoesPorGrupo({ role: 'DIRECAO', leciona: true });
    expect(direcao.at(-1)?.funcoes.map((f) => f.id)).toEqual(['minha-grade', 'informar-ausencia', 'meus-diarios', 'minhas-ppe', 'grade']);
    // Sem a docência (ou Professor), nada muda.
    expect(funcoesPorGrupo({ role: 'COORDENADOR', leciona: false }).map((g) => g.grupo)).not.toContain('Docência');
    expect(funcoesPorGrupo({ role: 'PROFESSOR', leciona: true })).toEqual(funcoesPorGrupo('PROFESSOR'));
  });
});
