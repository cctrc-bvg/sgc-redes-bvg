import { describe, expect, it } from 'vitest';
import { NovaSenhaSchema } from '@/lib/auth/validacao';
import { UsuarioSchema, formatarWhatsapp, gerarSenhaProvisoria, verificarAlteracao } from './regras';

describe('UsuarioSchema', () => {
  const base = { nome: 'Maria da Silva', email: 'Maria.Silva@IFCE.edu.br ', role: 'PROFESSOR' };

  it('aceita dados mínimos e normaliza o e-mail', () => {
    const r = UsuarioSchema.parse(base);
    expect(r).toEqual({ nome: 'Maria da Silva', email: 'maria.silva@ifce.edu.br', role: 'PROFESSOR' });
  });

  it('campos opcionais vazios viram undefined', () => {
    const r = UsuarioSchema.parse({ ...base, siape: '  ', whatsapp: '' });
    expect(r.siape).toBeUndefined();
    expect(r.whatsapp).toBeUndefined();
  });

  it('valida SIAPE com 7 dígitos', () => {
    expect(UsuarioSchema.parse({ ...base, siape: '1234567' }).siape).toBe('1234567');
    expect(UsuarioSchema.safeParse({ ...base, siape: '12345' }).error?.issues[0].message).toMatch(/7 dígitos/);
    expect(UsuarioSchema.safeParse({ ...base, siape: '12345ab' }).success).toBe(false);
  });

  it.each([
    ['(88) 99999-8888', '5588999998888'],
    ['88 3427-1234', '558834271234'],
    ['+55 88 99999-8888', '5588999998888'],
  ])('normaliza WhatsApp %s → %s', (entrada, esperado) => {
    expect(UsuarioSchema.parse({ ...base, whatsapp: entrada }).whatsapp).toBe(esperado);
  });

  it('rejeita WhatsApp sem DDD', () => {
    expect(UsuarioSchema.safeParse({ ...base, whatsapp: '99999-8888' }).error?.issues[0].message).toMatch(/DDD/);
  });

  it('rejeita perfil inexistente e nome curto', () => {
    expect(UsuarioSchema.safeParse({ ...base, role: 'ALUNO' }).success).toBe(false);
    expect(UsuarioSchema.safeParse({ ...base, nome: 'Jo' }).error?.issues[0].message).toMatch(/nome completo/);
  });
});

describe('gerarSenhaProvisoria', () => {
  it('gera senhas no formato xxxx-xxxx-xxxx que cumprem a política', () => {
    for (let i = 0; i < 200; i++) {
      const s = gerarSenhaProvisoria();
      expect(s).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
      expect(s).not.toMatch(/[01OIl]/); // sem caracteres ambíguos
      expect(NovaSenhaSchema.safeParse({ senhaAtual: 'outra', novaSenha: s, confirmacao: s }).success, s).toBe(true);
    }
  });

  it('não repete senhas', () => {
    const senhas = new Set(Array.from({ length: 200 }, gerarSenhaProvisoria));
    expect(senhas.size).toBe(200);
  });
});

describe('formatarWhatsapp', () => {
  it('formata celular e fixo', () => {
    expect(formatarWhatsapp('5588999998888')).toBe('(88) 99999-8888');
    expect(formatarWhatsapp('558834271234')).toBe('(88) 3427-1234');
    expect(formatarWhatsapp(null)).toBe('');
  });
});

describe('verificarAlteracao — Coordenação não se tranca fora', () => {
  const base = {
    editorId: 'coord1',
    alvoId: 'coord1',
    perfilAtual: 'COORDENADOR' as const,
    ativoAtual: true,
    novoPerfil: 'COORDENADOR' as const,
    novoAtivo: true,
    coordenadoresAtivos: 2,
  };

  it('permite editar os próprios dados sem mudar perfil nem status', () => {
    expect(verificarAlteracao(base)).toBeNull();
  });

  it('impede desativar a própria conta', () => {
    expect(verificarAlteracao({ ...base, novoAtivo: false })).toMatch(/própria conta/);
  });

  it('impede alterar o próprio perfil', () => {
    expect(verificarAlteracao({ ...base, novoPerfil: 'PROFESSOR' })).toMatch(/próprio perfil/);
  });

  it('impede rebaixar ou desativar o último coordenador ativo', () => {
    const outro = { ...base, alvoId: 'coord2', coordenadoresAtivos: 1 };
    expect(verificarAlteracao({ ...outro, novoPerfil: 'CTP' })).toMatch(/pelo menos um coordenador/);
    expect(verificarAlteracao({ ...outro, novoAtivo: false })).toMatch(/pelo menos um coordenador/);
  });

  it('permite rebaixar um coordenador quando há outro ativo', () => {
    expect(verificarAlteracao({ ...base, alvoId: 'coord2', novoPerfil: 'PROFESSOR' })).toBeNull();
  });

  it('permite desativar e reativar outros perfis', () => {
    const prof = { ...base, alvoId: 'p1', perfilAtual: 'PROFESSOR' as const, novoPerfil: 'PROFESSOR' as const, coordenadoresAtivos: 1 };
    expect(verificarAlteracao({ ...prof, novoAtivo: false })).toBeNull();
    expect(verificarAlteracao({ ...prof, ativoAtual: false, novoAtivo: true })).toBeNull();
  });
});
