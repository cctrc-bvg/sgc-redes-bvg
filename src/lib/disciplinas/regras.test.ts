import { describe, expect, it } from 'vitest';
import { calcularTetoPei } from '@/lib/ppi-ppe-engines';
import { DisciplinaSchema, verificarExclusao } from './regras';

const mensagem = (dados: Record<string, string>, campo: string) =>
  DisciplinaSchema.safeParse(dados).error?.issues.find((i) => i.path[0] === campo)?.message;

describe('DisciplinaSchema', () => {
  const base = { nome: '  Redes de Computadores I ', cargaHoraria: '80' };

  it('aceita dados mínimos, converte a carga horária e marca prática como falsa', () => {
    expect(DisciplinaSchema.parse(base)).toEqual({
      nome: 'Redes de Computadores I',
      cargaHoraria: 80,
      exigePratica: false,
    });
  });

  it('checkbox "on" marca a disciplina como prática (Art. 121)', () => {
    expect(DisciplinaSchema.parse({ ...base, exigePratica: 'on' }).exigePratica).toBe(true);
  });

  it('campos opcionais vazios viram undefined', () => {
    const r = DisciplinaSchema.parse({ ...base, codigo: '  ', ementaUrl: '', programaTexto: ' \n ' });
    expect(r.codigo).toBeUndefined();
    expect(r.ementaUrl).toBeUndefined();
    expect(r.programaTexto).toBeUndefined();
  });

  it('normaliza o código em maiúsculas', () => {
    expect(DisciplinaSchema.parse({ ...base, codigo: ' red.012 ' }).codigo).toBe('RED.012');
  });

  it.each(['R', 'RED 012', 'RED_012', '.RED', 'A'.repeat(21)])('rejeita código inválido: "%s"', (codigo) => {
    expect(mensagem({ ...base, codigo }, 'codigo')).toMatch(/2 a 20 caracteres/);
  });

  it('exige nome com pelo menos 3 caracteres', () => {
    expect(mensagem({ ...base, nome: 'AB' }, 'nome')).toMatch(/nome da disciplina/);
  });

  it.each([
    ['', /Informe a carga/],
    ['80h', /só o número/],
    ['12,5', /só o número/],
    ['-4', /só o número/],
    ['0', /pelo menos 1 hora/],
    ['401', /no máximo 400/],
  ])('rejeita carga horária "%s"', (cargaHoraria, erro) => {
    expect(mensagem({ ...base, cargaHoraria }, 'cargaHoraria')).toMatch(erro);
  });

  it('aceita ementa com http(s) e rejeita outros endereços', () => {
    expect(DisciplinaSchema.parse({ ...base, ementaUrl: 'https://ifce.edu.br/ppc.pdf' }).ementaUrl).toBe(
      'https://ifce.edu.br/ppc.pdf',
    );
    expect(mensagem({ ...base, ementaUrl: 'ifce.edu.br/ppc.pdf' }, 'ementaUrl')).toMatch(/https:\/\//);
    expect(mensagem({ ...base, ementaUrl: 'javascript:alert(1)' }, 'ementaUrl')).toMatch(/https:\/\//);
  });
});

describe('calcularTetoPei (Art. 117 §1º)', () => {
  it.each([
    [80, 24],
    [60, 18],
    [40, 12],
    [33, 9],
  ])('disciplina de %ih → PEI de até %ih', (ch, teto) => {
    expect(calcularTetoPei(ch)).toBe(teto);
  });
});

describe('verificarExclusao', () => {
  it('permite excluir disciplina nunca usada', () => {
    expect(verificarExclusao({ ofertas: 0, ppes: 0 })).toBeNull();
  });

  it('bloqueia quando há ofertas ou PPEs e sugere desativar', () => {
    expect(verificarExclusao({ ofertas: 2, ppes: 0 })).toMatch(/2 oferta\(s\).*Desative/);
    expect(verificarExclusao({ ofertas: 1, ppes: 3 })).toMatch(/1 oferta\(s\) e 3 registro\(s\) de PPE/);
  });
});
