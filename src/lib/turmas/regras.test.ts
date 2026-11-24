import { describe, expect, it } from 'vitest';
import { ALUNOS_MAXIMO, TurmaSchema, verificarExclusaoTurma, verificarTrocaAnoCurso } from './regras';

const mensagem = (dados: Record<string, string>, campo: string) =>
  TurmaSchema.safeParse(dados).error?.issues.find((i) => i.path[0] === campo)?.message;

describe('TurmaSchema', () => {
  const base = {
    codigo: ' redes-1 ',
    nome: '  Redes 1º Ano (Integrado) ',
    anoCurso: '1',
    qtdAlunosAtivos: '40',
    qtdMediaLancheManha: '35',
    qtdMediaAlmoco: '30',
    qtdMediaLancheTarde: '28',
  };

  it('aceita dados válidos, converte números e põe o código em maiúsculas', () => {
    expect(TurmaSchema.parse(base)).toEqual({
      codigo: 'REDES-1',
      nome: 'Redes 1º Ano (Integrado)',
      anoCurso: 1,
      qtdAlunosAtivos: 40,
      qtdMediaLancheManha: 35,
      qtdMediaAlmoco: 30,
      qtdMediaLancheTarde: 28,
    });
  });

  it('valida código e nome', () => {
    expect(mensagem({ ...base, codigo: 'R' }, 'codigo')).toMatch(/2 a 20/);
    expect(mensagem({ ...base, codigo: 'REDES 1' }, 'codigo')).toMatch(/2 a 20/);
    expect(mensagem({ ...base, nome: ' ' }, 'nome')).toMatch(/nome da turma/);
  });

  it('exige ano do curso de 1 a 3', () => {
    expect(mensagem({ ...base, anoCurso: '' }, 'anoCurso')).toMatch(/ano do curso/);
    expect(mensagem({ ...base, anoCurso: '4' }, 'anoCurso')).toMatch(/ano do curso/);
  });

  it('quantidades: só números inteiros, até o limite', () => {
    expect(mensagem({ ...base, qtdAlunosAtivos: '' }, 'qtdAlunosAtivos')).toMatch(/estudantes ativos/);
    expect(mensagem({ ...base, qtdAlunosAtivos: '3,5' }, 'qtdAlunosAtivos')).toMatch(/só o número/);
    expect(mensagem({ ...base, qtdAlunosAtivos: '-1' }, 'qtdAlunosAtivos')).toMatch(/só o número/);
    expect(mensagem({ ...base, qtdAlunosAtivos: String(ALUNOS_MAXIMO + 1) }, 'qtdAlunosAtivos')).toMatch(/no máximo/);
  });

  it('aceita turma vazia (0 estudantes e 0 refeições)', () => {
    const zeros = { ...base, qtdAlunosAtivos: '0', qtdMediaLancheManha: '0', qtdMediaAlmoco: '0', qtdMediaLancheTarde: '0' };
    expect(TurmaSchema.safeParse(zeros).success).toBe(true);
  });

  it('média de refeição não passa do número de estudantes ativos', () => {
    expect(mensagem({ ...base, qtdMediaAlmoco: '41' }, 'qtdMediaAlmoco')).toMatch(/40 estudantes ativos/);
    expect(mensagem({ ...base, qtdMediaLancheTarde: '40' }, 'qtdMediaLancheTarde')).toBeUndefined();
  });
});

describe('verificarExclusaoTurma', () => {
  const nada = { ofertas: 0, gradeHoraria: 0, ausencias: 0, alertasRefeicao: 0 };

  it('permite excluir turma nunca usada', () => {
    expect(verificarExclusaoTurma(nada)).toBeNull();
  });

  it('bloqueia e lista o que prende a turma ao histórico', () => {
    const msg = verificarExclusaoTurma({ ...nada, ofertas: 12, alertasRefeicao: 1 });
    expect(msg).toMatch(/12 oferta\(s\), 1 aviso\(s\) de refeição/);
    expect(msg).toMatch(/Desative-a/);
    expect(verificarExclusaoTurma({ ...nada, gradeHoraria: 3 })).toMatch(/3 horário\(s\) na grade/);
    expect(verificarExclusaoTurma({ ...nada, ausencias: 2 })).toMatch(/2 ausência\(s\)/);
  });
});

describe('verificarTrocaAnoCurso', () => {
  it('permite manter o ano, preencher ano vazio ou trocar sem ofertas', () => {
    expect(verificarTrocaAnoCurso(2, 2, 10)).toBeNull();
    expect(verificarTrocaAnoCurso(null, 3, 10)).toBeNull();
    expect(verificarTrocaAnoCurso(1, 2, 0)).toBeNull();
  });

  it('bloqueia a troca quando a turma já tem ofertas', () => {
    expect(verificarTrocaAnoCurso(1, 2, 15)).toMatch(/15 oferta\(s\) de disciplinas do 1º ano/);
  });
});
