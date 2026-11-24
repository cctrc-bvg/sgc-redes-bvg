import { describe, expect, it } from 'vitest';
import { excedeLimitePpe, lerCronograma, PeiSchema, RegistroPpeSchema, semestreAtual, TRANSICOES, travasPei } from './regras';

describe('registro de PPE', () => {
  it('Art. 115: 3 ou mais componentes no semestre → retenção', () => {
    expect(excedeLimitePpe(2)).toBe(false);
    expect(excedeLimitePpe(3)).toBe(true);
  });

  it('semestre corrente em Fortaleza e formato', () => {
    expect(semestreAtual(new Date('2026-07-01T02:00:00Z'))).toBe('2026.1'); // 30/06 23h em Fortaleza
    expect(semestreAtual(new Date('2026-11-24T12:00:00Z'))).toBe('2026.2');
    const ok = { nomeEstudante: 'Maria Souza', matricula: '20261234567', disciplinaId: 'd1', semestre: '2026.2' };
    expect(RegistroPpeSchema.safeParse(ok).success).toBe(true);
    expect(RegistroPpeSchema.safeParse({ ...ok, semestre: '2026.3' }).success).toBe(false);
  });

  it('transições: lançamento só depois de aprovado ou reprovado', () => {
    expect(TRANSICOES.EM_ANDAMENTO).toContain('APROVADO');
    expect(TRANSICOES.AGUARDANDO_PROFESSOR).toEqual([]);
    expect(TRANSICOES.APROVADO).toEqual(['LANCADO_ACADEMICO']);
    expect(TRANSICOES.LANCADO_ACADEMICO).toEqual([]);
  });
});

describe('PEI: formulário e travas do ROD', () => {
  const base = { cargaHorariaPei: '24', horasPresenciais: '16', horasPraticas: '', objetivos: 'Recuperar sub-redes e roteamento', conteudos: 'Endereçamento IPv4, VLSM' };

  it('lê números e trata horas práticas vazias como 0', () => {
    expect(PeiSchema.parse(base)).toMatchObject({ cargaHorariaPei: 24, horasPresenciais: 16, horasPraticas: 0 });
  });

  it('Art. 117 §1º: teto de 30% da carga da disciplina', () => {
    const r = travasPei({ cargaHorariaPei: 25, horasPresenciais: 10, horasPraticas: 5 }, { cargaHoraria: 80, exigePratica: false });
    expect(r.teto).toBe(24);
    expect(r.erros.cargaHorariaPei).toMatch(/excede 30%/);
  });

  it('Art. 121: disciplina com prática exige horas práticas; presenciais e práticas não passam do PEI', () => {
    const disc = { cargaHoraria: 80, exigePratica: true };
    expect(travasPei({ cargaHorariaPei: 24, horasPresenciais: 16, horasPraticas: 0 }, disc).erros.horasPraticas).toMatch(/Art. 121/);
    expect(travasPei({ cargaHorariaPei: 20, horasPresenciais: 21, horasPraticas: 4 }, disc).erros.horasPresenciais).toMatch(/presenciais/);
    expect(travasPei({ cargaHorariaPei: 20, horasPresenciais: 10, horasPraticas: 21 }, disc).erros.horasPraticas).toMatch(/práticas não podem/);
    expect(travasPei({ cargaHorariaPei: 24, horasPresenciais: 16, horasPraticas: 12 }, disc).erros).toEqual({});
  });
});

describe('cronograma de encontros', () => {
  const campos = (m: Record<string, string>) => (nome: string) => m[nome] ?? '';

  it('ignora linhas vazias, ordena por data e aponta linhas incompletas', () => {
    const r = lerCronograma(
      campos({
        'encontro:0:data': '2026-12-10',
        'encontro:0:conteudo': 'VLSM',
        'encontro:0:metodologia': 'Exercícios',
        'encontro:2:data': '2026-12-03',
        'encontro:2:conteudo': 'IPv4',
        'encontro:2:metodologia': 'Aula + lista',
        'encontro:3:conteudo': 'Só conteúdo',
        'encontro:4:data': '2026-02-30',
        'encontro:4:conteudo': 'x',
        'encontro:4:metodologia': 'y',
      }),
      6,
    );
    expect(r.encontros.map((e) => e.data)).toEqual(['2026-12-03', '2026-12-10']);
    expect(r.erros[3]).toMatch(/Preencha data/);
    expect(r.erros[4]).toMatch(/Data inválida/);
    expect(r.erros[1]).toBeUndefined();
  });
});
