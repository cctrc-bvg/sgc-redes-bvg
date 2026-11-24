import { describe, expect, it } from 'vitest';
import { COLUNAS_GRADE, lerBloco, lerHora, linhaDaGrade, planejarImportacaoGrade, type RegistroGrade } from './grade';

const blocos = [
  { id: 'mA', turno: 'MANHA' as const, ordem: 1, horaInicio: '07:30' },
  { id: 'mB', turno: 'MANHA' as const, ordem: 2, horaInicio: '08:30' },
  { id: 'tA', turno: 'TARDE' as const, ordem: 1, horaInicio: '13:00' },
];
const turmas = [
  { id: 't1', codigo: 'REDES-1' },
  { id: 't2', codigo: 'REDES-2' },
];
const ofertas = [
  { id: 'o1', turmaId: 't1', disciplina: 'Matemática I', codigo: 'MAT1', professorId: 'p1', professorNome: 'Ana Souza', professorEmail: 'ana@ifce.edu.br' },
  { id: 'o2', turmaId: 't1', disciplina: 'Redes I', codigo: null, professorId: 'p2', professorNome: 'Bruno Lima', professorEmail: 'bruno@ifce.edu.br' },
  { id: 'o3', turmaId: 't2', disciplina: 'Matemática II', codigo: null, professorId: 'p1', professorNome: 'Ana Souza', professorEmail: 'ana@ifce.edu.br' },
];
const reg = (numero: number, v: Partial<RegistroGrade>) => ({
  numero,
  valores: { ...(Object.fromEntries(COLUNAS_GRADE.map((c) => [c.campo, ''])) as RegistroGrade), ...v },
});
const base = { turmas, blocos, ofertas, atuais: [], substituir: false };

describe('lerHora e lerBloco', () => {
  it.each([
    ['7:30', '07:30'],
    ['07h30', '07:30'],
    ['13h', '13:00'],
    ['07:30:00', '07:30'],
    ['25:00', null],
    ['manhã', null],
  ])('%s → %s', (v, esperado) => expect(lerHora(v)).toBe(esperado));

  it('pelo início ou por turno + letra', () => {
    expect(lerBloco({ inicio: '8:30', turno: '', bloco: '' }, blocos)).toMatchObject({ id: 'mB' });
    expect(lerBloco({ inicio: '', turno: 'Tarde', bloco: 'a' }, blocos)).toMatchObject({ id: 'tA' });
    expect(lerBloco({ inicio: '', turno: '', bloco: '' }, blocos)).toBeNull();
    expect(lerBloco({ inicio: '09:00', turno: '', bloco: '' }, blocos)).toBe('invalido');
  });
});

describe('planejarImportacaoGrade', () => {
  it('cria aulas por nome ou código da disciplina e ignora linhas sem dia e horário', () => {
    const p = planejarImportacaoGrade({
      ...base,
      registros: [
        reg(2, { turma: 'redes-1', dia: 'Segunda', inicio: '07:30', disciplina: 'Matemática I', professor: 'ana@ifce.edu.br' }),
        reg(3, { turma: 'REDES-1', dia: 'Terça', turno: 'Manhã', bloco: 'B', disciplina: 'MAT1' }),
        reg(4, { turma: 'REDES-1', disciplina: 'Redes I' }),
      ],
    });
    expect(p.temErros).toBe(false);
    expect(p.linhas.map((l) => l.situacao)).toEqual(['criar', 'criar', 'ignorar']);
    expect(p.gravar).toEqual([
      { turmaId: 't1', diaSemana: 1, blocoId: 'mA', ofertaId: 'o1' },
      { turmaId: 't1', diaSemana: 2, blocoId: 'mB', ofertaId: 'o1' },
    ]);
  });

  it('acusa turma, dia, horário, disciplina sem oferta, professor diferente e horário repetido', () => {
    const p = planejarImportacaoGrade({
      ...base,
      registros: [
        reg(2, { turma: 'REDES-9', dia: 'Segunda', inicio: '07:30', disciplina: 'Redes I' }),
        reg(3, { turma: 'REDES-1', dia: 'Domingo', inicio: '07:30', disciplina: 'Redes I' }),
        reg(4, { turma: 'REDES-1', dia: 'Segunda', inicio: '09:00', disciplina: 'Redes I' }),
        reg(5, { turma: 'REDES-1', dia: 'Segunda', inicio: '07:30', disciplina: 'Química' }),
        reg(6, { turma: 'REDES-1', dia: 'Segunda', inicio: '07:30', disciplina: 'Redes I', professor: 'Ana Souza' }),
        reg(7, { turma: 'REDES-1', dia: 'Quarta', inicio: '07:30', disciplina: 'Redes I' }),
        reg(8, { turma: 'REDES-1', dia: 'Quarta', inicio: '07:30', disciplina: 'Matemática I' }),
      ],
    });
    const d = (n: number) => p.linhas.find((l) => l.numero === n)?.detalhe ?? '';
    expect(d(2)).toMatch(/Turma "REDES-9" não encontrada/);
    expect(d(3)).toMatch(/Dia:/);
    expect(d(4)).toMatch(/Horário não reconhecido/);
    expect(d(5)).toMatch(/não tem oferta na turma REDES-1/);
    expect(d(6)).toMatch(/Professor diferente da oferta: Bruno Lima/);
    expect(d(8)).toMatch(/Mesmo horário da linha 7/);
    expect(p.temErros).toBe(true);
  });

  it('recusa choque de horário do professor na planilha e com a grade cadastrada', () => {
    const naPlanilha = planejarImportacaoGrade({
      ...base,
      registros: [
        reg(2, { turma: 'REDES-1', dia: 'Segunda', inicio: '07:30', disciplina: 'Matemática I' }),
        reg(3, { turma: 'REDES-2', dia: 'Segunda', inicio: '07:30', disciplina: 'Matemática II' }),
      ],
    });
    expect(naPlanilha.linhas.every((l) => /Choque de horário: Ana Souza/.test(l.detalhe ?? ''))).toBe(true);
    const comCadastro = planejarImportacaoGrade({
      ...base,
      atuais: [{ turmaId: 't2', diaSemana: 1, blocoId: 'mA', ofertaId: 'o3' }],
      registros: [reg(2, { turma: 'REDES-1', dia: 'Segunda', inicio: '07:30', disciplina: 'Matemática I' })],
    });
    expect(comCadastro.linhas[0].detalhe).toMatch(/também tem aula na turma REDES-2/);
  });

  it('substituir libera os horários da turma que não estão na planilha; completar não', () => {
    const atuais = [
      { turmaId: 't1', diaSemana: 1, blocoId: 'mA', ofertaId: 'o1' },
      { turmaId: 't1', diaSemana: 2, blocoId: 'mA', ofertaId: 'o2' },
      { turmaId: 't2', diaSemana: 3, blocoId: 'mA', ofertaId: 'o3' },
    ];
    const registros = [reg(2, { turma: 'REDES-1', dia: 'Segunda', inicio: '07:30', disciplina: 'Matemática I' })];
    const completar = planejarImportacaoGrade({ ...base, atuais, registros });
    expect(completar.linhas[0].situacao).toBe('igual');
    expect(completar.remover).toEqual([]);
    const substituir = planejarImportacaoGrade({ ...base, atuais, registros, substituir: true });
    expect(substituir.remover).toEqual([{ turmaId: 't1', diaSemana: 2, blocoId: 'mA' }]);
    expect(substituir.gravar).toEqual([]);
  });

  it('disciplina vazia libera o horário', () => {
    const p = planejarImportacaoGrade({
      ...base,
      atuais: [{ turmaId: 't1', diaSemana: 1, blocoId: 'mA', ofertaId: 'o1' }],
      registros: [reg(2, { turma: 'REDES-1', dia: 'Segunda', inicio: '07:30' })],
    });
    expect(p.linhas[0]).toMatchObject({ situacao: 'atualizar', detalhe: 'Horário liberado.' });
    expect(p.remover).toHaveLength(1);
  });

  it('a linha exportada volta pela importação sem mudanças', () => {
    const linha = linhaDaGrade({ turma: 'REDES-1', diaSemana: 1, bloco: { turno: 'MANHA', ordem: 1, horaInicio: '07:30', horaFim: '08:30' }, disciplina: 'Matemática I', professor: 'Ana Souza' });
    expect(linha).toEqual(['REDES-1', 'Segunda', 'Manhã', 'A', '07:30', '08:30', 'Matemática I', 'Ana Souza']);
    const valores = Object.fromEntries(COLUNAS_GRADE.map((c, i) => [c.campo, linha[i]])) as RegistroGrade;
    const p = planejarImportacaoGrade({ ...base, atuais: [{ turmaId: 't1', diaSemana: 1, blocoId: 'mA', ofertaId: 'o1' }], registros: [{ numero: 2, valores }] });
    expect(p.linhas[0].situacao).toBe('igual');
    expect(p.gravar).toHaveLength(0);
  });
});
