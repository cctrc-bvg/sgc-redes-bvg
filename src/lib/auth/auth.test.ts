import { describe, expect, it } from 'vitest';
import type { Role } from '@prisma/client';
import { LimitadorTentativas } from './limitador';
import { MODULOS, PERMISSOES, modulosDoPerfil, permissoesDoPerfil, temPermissao } from './rbac';
import { gerarTokenSessao, hashToken } from './token';
import { LoginSchema, NovaSenhaSchema, destinoSeguro } from './validacao';

const PERFIS: Role[] = ['COORDENADOR', 'PROFESSOR', 'CTP', 'DIRECAO', 'ASSISTENCIA_ESTUDANTIL'];

describe('RBAC — matriz de perfis (FSD, seção 2)', () => {
  it('Coordenação tem todas as permissões', () => {
    expect([...permissoesDoPerfil('COORDENADOR')].sort()).toEqual([...PERMISSOES].sort());
  });

  it('registros sigilosos (Art. 22, VIII) são exclusivos da Coordenação', () => {
    for (const perfil of PERFIS) {
      expect(temPermissao(perfil, 'kanban:ver-sigiloso'), perfil).toBe(perfil === 'COORDENADOR');
    }
  });

  it('Assistência Estudantil vê apenas alimentação e o calendário, sem dados pessoais (minimização LGPD)', () => {
    expect([...permissoesDoPerfil('ASSISTENCIA_ESTUDANTIL')].every((p) => p.startsWith('alimentacao:') || p === 'calendario:ver')).toBe(true);
    expect(modulosDoPerfil('ASSISTENCIA_ESTUDANTIL').map((m) => m.id)).toEqual(['calendario', 'alimentacao']);
  });

  it('Assistência Estudantil é bloqueada em notas, PPI, PPE e processos', () => {
    for (const p of ['ppe:ver', 'ppi:ver', 'kanban:ver', 'relatorios:ver', 'diarios:ver-todos'] as const) {
      expect(temPermissao('ASSISTENCIA_ESTUDANTIL', p), p).toBe(false);
    }
  });

  it('Professor responde substituições e define PPE, mas não vê processos', () => {
    expect(temPermissao('PROFESSOR', 'substituicao:responder')).toBe(true);
    expect(temPermissao('PROFESSOR', 'ppe:definir')).toBe(true);
    expect(temPermissao('PROFESSOR', 'diarios:ver-proprios')).toBe(true);
    expect(temPermissao('PROFESSOR', 'diarios:ver-todos')).toBe(false);
    expect(temPermissao('PROFESSOR', 'kanban:ver')).toBe(false);
  });

  it('CTP vê PPE/PEI (Art. 127) e processos, sem gerenciar usuários', () => {
    expect(temPermissao('CTP', 'ppe:ver')).toBe(true);
    expect(temPermissao('CTP', 'kanban:ver')).toBe(true);
    expect(temPermissao('CTP', 'usuarios:gerenciar')).toBe(false);
  });

  it('somente a Coordenação gerencia usuários, disciplinas, ofertas e turmas e vê auditoria', () => {
    for (const perfil of PERFIS) {
      expect(temPermissao(perfil, 'usuarios:gerenciar'), perfil).toBe(perfil === 'COORDENADOR');
      expect(temPermissao(perfil, 'auditoria:ver'), perfil).toBe(perfil === 'COORDENADOR');
      expect(temPermissao(perfil, 'disciplinas:gerenciar'), perfil).toBe(perfil === 'COORDENADOR');
      expect(temPermissao(perfil, 'ofertas:gerenciar'), perfil).toBe(perfil === 'COORDENADOR');
      expect(temPermissao(perfil, 'turmas:gerenciar'), perfil).toBe(perfil === 'COORDENADOR');
    }
  });

  it('Professor, CTP e Direção consultam o catálogo de disciplinas; Assistência Estudantil não', () => {
    for (const perfil of ['COORDENADOR', 'PROFESSOR', 'CTP', 'DIRECAO'] as const) {
      expect(temPermissao(perfil, 'disciplinas:ver'), perfil).toBe(true);
    }
    expect(temPermissao('ASSISTENCIA_ESTUDANTIL', 'disciplinas:ver')).toBe(false);
  });

  it('todo perfil enxerga pelo menos um módulo', () => {
    for (const perfil of PERFIS) expect(modulosDoPerfil(perfil).length, perfil).toBeGreaterThan(0);
  });

  it('todo módulo exige permissões existentes', () => {
    for (const m of MODULOS) for (const p of m.requer) expect(PERMISSOES).toContain(p);
  });
});

describe('LoginSchema', () => {
  it('normaliza o e-mail (espaços e maiúsculas)', () => {
    const r = LoginSchema.parse({ email: '  Fulano@IFCE.edu.br ', senha: 'x' });
    expect(r.email).toBe('fulano@ifce.edu.br');
  });

  it('rejeita e-mail vazio ou inválido com mensagem em português', () => {
    expect(LoginSchema.safeParse({ email: '', senha: 'x' }).error?.issues[0].message).toMatch(/Informe seu e-mail/);
    expect(LoginSchema.safeParse({ email: 'fulano', senha: 'x' }).error?.issues[0].message).toMatch(/e-mail válido/);
  });

  it('exige a senha', () => {
    expect(LoginSchema.safeParse({ email: 'a@ifce.edu.br', senha: '' }).success).toBe(false);
  });
});

describe('NovaSenhaSchema — política de senha', () => {
  const base = { senhaAtual: 'provisoria1', novaSenha: 'redes2026bvg', confirmacao: 'redes2026bvg' };
  const erroEm = (dados: typeof base, campo: string) =>
    NovaSenhaSchema.safeParse(dados).error?.issues.filter((i) => i.path[0] === campo).map((i) => i.message) ?? [];

  it('aceita senha com 10+ caracteres, letras e números', () => {
    expect(NovaSenhaSchema.safeParse(base).success).toBe(true);
  });

  it('rejeita senha curta, sem número ou sem letra', () => {
    expect(erroEm({ ...base, novaSenha: 'abc123', confirmacao: 'abc123' }, 'novaSenha')).toContain('Use pelo menos 10 caracteres.');
    expect(erroEm({ ...base, novaSenha: 'somenteletras', confirmacao: 'somenteletras' }, 'novaSenha')).toContain('Inclua pelo menos um número.');
    expect(erroEm({ ...base, novaSenha: '1234567890', confirmacao: '1234567890' }, 'novaSenha')).toContain('Inclua pelo menos uma letra.');
  });

  it('exige confirmação igual', () => {
    expect(erroEm({ ...base, confirmacao: 'outra2026bvg' }, 'confirmacao')).toEqual(['A confirmação não é igual à nova senha.']);
  });

  it('não permite repetir a senha atual', () => {
    expect(erroEm({ ...base, novaSenha: 'provisoria1x', confirmacao: 'provisoria1x', senhaAtual: 'provisoria1x' }, 'novaSenha')).toContain(
      'A nova senha deve ser diferente da atual.',
    );
  });
});

describe('destinoSeguro — redirecionamento após login', () => {
  it.each([
    ['/painel', '/painel'],
    ['/conta/senha?x=1', '/conta/senha?x=1'],
    ['//site-malicioso.com', '/painel'],
    ['/\\site-malicioso.com', '/painel'],
    ['https://site-malicioso.com', '/painel'],
    ['javascript:alert(1)', '/painel'],
    ['/login', '/painel'],
    [undefined, '/painel'],
    [null, '/painel'],
  ])('%s → %s', (entrada, esperado) => {
    expect(destinoSeguro(entrada)).toBe(esperado);
  });
});

describe('LimitadorTentativas', () => {
  const criar = () => {
    let agora = 0;
    const lim = new LimitadorTentativas(3, 10 * 60_000, () => agora);
    return { lim, avancar: (min: number) => (agora += min * 60_000) };
  };

  it('libera abaixo do limite e bloqueia ao atingi-lo', () => {
    const { lim } = criar();
    lim.registrarFalha('a');
    lim.registrarFalha('a');
    expect(lim.minutosBloqueado('a')).toBe(0);
    lim.registrarFalha('a');
    expect(lim.minutosBloqueado('a')).toBe(10);
  });

  it('desbloqueia quando as falhas saem da janela', () => {
    const { lim, avancar } = criar();
    for (let i = 0; i < 3; i++) lim.registrarFalha('a');
    avancar(7);
    expect(lim.minutosBloqueado('a')).toBe(3);
    avancar(3);
    expect(lim.minutosBloqueado('a')).toBe(0);
  });

  it('chaves são independentes e limpar zera o histórico', () => {
    const { lim } = criar();
    for (let i = 0; i < 3; i++) lim.registrarFalha('a');
    expect(lim.minutosBloqueado('b')).toBe(0);
    lim.limpar('a');
    expect(lim.minutosBloqueado('a')).toBe(0);
  });
});

describe('token de sessão', () => {
  it('gera tokens longos e diferentes a cada chamada', () => {
    const a = gerarTokenSessao();
    const b = gerarTokenSessao();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43); // 32 bytes em base64url
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('o hash é determinístico e não contém o token', () => {
    const t = gerarTokenSessao();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });
});
