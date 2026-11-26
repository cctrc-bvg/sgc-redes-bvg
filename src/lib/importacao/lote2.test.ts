import { describe, expect, it } from 'vitest';
import { planejarImportacaoOfertas, type Contexto } from './ofertas';
import { lerDataPlanilha, lerDiaSemana, planejarImportacaoSabados } from './sabados';

describe('importação de sábados letivos', () => {
  it('lê datas brasileiras e dias por extenso (nunca números)', () => {
    expect(lerDataPlanilha('3/10/2026')).toBe('2026-10-03');
    expect(lerDataPlanilha('2026-10-03')).toBe('2026-10-03');
    expect(lerDiaSemana('Segunda-feira')).toBe(1);
    expect(lerDiaSemana('TERÇA')).toBe(2);
    expect(lerDiaSemana('6ª')).toBe(5);
    expect(lerDiaSemana('2')).toBeNull();
    expect(lerDiaSemana('domingo')).toBeNull();
  });

  it('cria, atualiza, mantém e recusa', () => {
    const plano = planejarImportacaoSabados({
      presentes: new Set(['data', 'diaSemanaReferente', 'observacao']),
      existentes: [
        { id: 's1', data: '2026-10-03', diaSemanaReferente: 1, observacao: null },
        { id: 's2', data: '2026-10-17', diaSemanaReferente: 3, observacao: 'Reposição' },
      ],
      registros: [
        { numero: 2, valores: { data: '03/10/2026', diaSemanaReferente: 'Segunda', observacao: '' } },
        { numero: 3, valores: { data: '17/10/2026', diaSemanaReferente: 'Quinta', observacao: 'Reposição' } },
        { numero: 4, valores: { data: '24/10/2026', diaSemanaReferente: 'Sexta', observacao: '' } },
        { numero: 5, valores: { data: '23/10/2026', diaSemanaReferente: 'Sexta', observacao: '' } },
        { numero: 6, valores: { data: '24/10/2026', diaSemanaReferente: 'Terça', observacao: '' } },
        { numero: 7, valores: { data: '31/10/2026', diaSemanaReferente: '3', observacao: '' } },
      ],
    });
    expect(plano.linhas.map((l) => l.situacao)).toEqual(['igual', 'atualizar', 'criar', 'erro', 'erro', 'erro']);
    expect(plano.linhas[3].detalhe).toMatch(/sábado/);
    expect(plano.linhas[4].detalhe).toMatch(/linha 4/);
    expect(plano.linhas[5].detalhe).toMatch(/Segunda, Terça/);
    expect(plano.atualizar).toEqual([{ id: 's2', diaSemanaReferente: 4, observacao: 'Reposição' }]);
  });
});

describe('importação de ofertas', () => {
  const contexto: Contexto = {
    turmas: [
      { id: 't1', codigo: 'REDES-1', anoCurso: 1, ativa: true },
      { id: 't9', codigo: 'VELHA', anoCurso: 1, ativa: false },
    ],
    disciplinas: [
      { id: 'd1', codigo: 'BIO.1', nome: 'Biologia I', anoCurso: 1, semestreCurso: null, cargaHoraria: 80, ativa: true },
      { id: 'd2', codigo: 'C.D', nome: 'Comunicação de Dados', anoCurso: 1, semestreCurso: 2, cargaHoraria: 80, ativa: true },
      { id: 'd3', codigo: 'BIO.2', nome: 'Biologia II', anoCurso: 2, semestreCurso: null, cargaHoraria: 80, ativa: true },
    ],
    docentes: [
      { id: 'p1', email: 'ana@ifce.edu.br', nome: 'Ana' },
      { id: 'p2', email: 'bruno@ifce.edu.br', nome: 'Bruno' },
    ],
    ofertas: [{ id: 'o1', anoLetivo: 2026, turmaId: 't1', disciplinaId: 'd1', professorId: 'p1' }],
  };
  const linha = (numero: number, turma: string, disciplina: string, professor: string, anoLetivo = '2026') => ({ numero, valores: { anoLetivo, turma, disciplina, professor } });

  it('cria com semestre e aulas previstas, troca professor e mantém iguais', () => {
    const p = planejarImportacaoOfertas({
      contexto,
      registros: [linha(2, 'redes-1', 'bio.1', 'ANA@ifce.edu.br'), linha(3, 'REDES-1', 'Comunicação de Dados', 'bruno@ifce.edu.br'), linha(4, 'REDES-1', 'BIO.1', 'bruno@ifce.edu.br', '2027')],
    });
    expect(p.temErros).toBe(false);
    expect(p.linhas.map((l) => l.situacao)).toEqual(['igual', 'criar', 'criar']);
    expect(p.criar[0]).toEqual({ anoLetivo: 2026, semestreLetivo: 2, turmaId: 't1', disciplinaId: 'd2', professorId: 'p2', aulasPrevistas: 80 });
    const troca = planejarImportacaoOfertas({ contexto, registros: [linha(2, 'REDES-1', 'BIO.1', 'bruno@ifce.edu.br')] });
    expect(troca.alterar).toEqual([{ id: 'o1', professorId: 'p2', professorAnterior: 'p1' }]);
    expect(troca.linhas[0].detalhe).toMatch(/antes: Ana/);
  });

  it('aceita o nome completo do docente (planilha exportada) e recusa homônimos', () => {
    const p = planejarImportacaoOfertas({ contexto, registros: [linha(2, 'REDES-1', 'BIO.1', 'ana')] });
    expect(p.linhas[0].situacao).toBe('igual');
    const homonimos = { ...contexto, docentes: [...contexto.docentes, { id: 'p3', email: 'ana2@ifce.edu.br', nome: 'Ana' }] };
    const r = planejarImportacaoOfertas({ contexto: homonimos, registros: [linha(2, 'REDES-1', 'BIO.1', 'Ana')] });
    expect(r.linhas[0].detalhe).toMatch(/mais de um docente/);
  });

  it('ignora linha sem professor (modelo com a matriz inteira)', () => {
    const p = planejarImportacaoOfertas({ registros: [linha(2, 'REDES-1', 'qualquer', '  ')], contexto });
    expect(p.temErros).toBe(false);
    expect(p.criar).toEqual([]);
    expect(p.linhas[0]).toMatchObject({ situacao: 'ignorar', detalhe: 'Sem professor: linha ignorada.' });
  });

  it('recusa turma, disciplina, professor e ano inválidos, disciplina de outro ano e repetição', () => {
    const p = planejarImportacaoOfertas({
      contexto,
      registros: [
        linha(2, 'REDES-9', 'X', 'zé@ifce.edu.br', '26'),
        linha(3, 'VELHA', 'BIO.1', 'ana@ifce.edu.br'),
        linha(4, 'REDES-1', 'BIO.2', 'ana@ifce.edu.br'),
        linha(5, 'REDES-1', 'C.D', 'ana@ifce.edu.br'),
        linha(6, 'REDES-1', 'C.D', 'bruno@ifce.edu.br'),
      ],
    });
    expect(p.temErros).toBe(true);
    expect(p.linhas[0].detalhe).toMatch(/Ano letivo.*Turma "REDES-9".*Disciplina "X".*Professor "zé/);
    expect(p.linhas[1].detalhe).toMatch(/desativada/);
    expect(p.linhas[2].detalhe).toMatch(/Disciplina do 2º ano; a turma REDES-1 é do 1º ano/);
    expect(p.linhas[4].detalhe).toMatch(/Repete a linha 5/);
  });
});
