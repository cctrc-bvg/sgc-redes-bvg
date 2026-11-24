import { describe, expect, it } from 'vitest';
import { COLUNAS_CALENDARIO, lerAulas, lerTipoLinha, linhasDoCalendario, planejarImportacaoCalendario, type CalendarioExistente, type RegistroCalendario } from './calendario';

const vazio: CalendarioExistente = { etapas: [null, null, null, null], semestres: [null, null], eventos: [], sabados: [] };
const reg = (numero: number, v: Partial<RegistroCalendario>) => ({
  numero,
  valores: { ...(Object.fromEntries(COLUNAS_CALENDARIO.map((c) => [c.campo, ''])) as RegistroCalendario), ...v },
});

describe('lerTipoLinha', () => {
  it.each([
    ['Etapa N1', { tipo: 'etapa', numero: 1 }],
    ['n4', { tipo: 'etapa', numero: 4 }],
    ['2º semestre', { tipo: 'semestre', numero: 2 }],
    ['Sábado letivo', { tipo: 'sabado' }],
    ['Feriado', { tipo: 'evento', evento: 'FERIADO' }],
    ['PONTO_FACULTATIVO', { tipo: 'evento', evento: 'PONTO_FACULTATIVO' }],
    ['Avaliações finais e entrega de diários', { tipo: 'evento', evento: 'AVALIACOES_FINAIS' }],
    ['Pits/Rits', { tipo: 'evento', evento: 'PITS_RITS' }],
    ['Suspensão de aulas (força maior)', { tipo: 'evento', evento: 'SUSPENSAO_AULAS' }],
  ])('%s', (v, esperado) => expect(lerTipoLinha(v)).toEqual(esperado));

  it('tipo desconhecido', () => expect(lerTipoLinha('Festa')).toBeNull());
});

describe('lerAulas', () => {
  it('vazio usa o padrão; aceita sem aula/mantidas; recusa outro valor', () => {
    expect(lerAulas('', true)).toBe(true);
    expect(lerAulas('Sem aula', false)).toBe(true);
    expect(lerAulas('Mantidas', true)).toBe(false);
    expect(lerAulas('talvez', true)).toBeNull();
  });
});

describe('planejarImportacaoCalendario', () => {
  it('cria etapas, eventos e sábados; usa o padrão do tipo para as aulas', () => {
    const p = planejarImportacaoCalendario({
      ano: 2027,
      existente: vazio,
      registros: [
        reg(2, { tipo: 'Etapa N1', inicio: '01/02/2027', fim: '16/04/2027' }),
        reg(3, { tipo: 'Etapa N2', inicio: '19/04/2027', fim: '30/06/2027' }),
        reg(4, { tipo: 'Feriado', inicio: '21/04/2027', descricao: 'Tiradentes' }),
        reg(5, { tipo: 'Sábado letivo', inicio: '13/03/2027', grade: 'Quarta', descricao: 'Reposição' }),
      ],
    });
    expect(p.temErros).toBe(false);
    expect(p.etapas[0]).toEqual({ inicio: '2027-02-01', fim: '2027-04-16' });
    expect(p.eventosCriar).toEqual([
      { tipo: 'FERIADO', inicio: '2027-04-21', fim: '2027-04-21', descricao: 'Tiradentes', suspendeAulas: true, imprevisto: false, motivo: null },
    ]);
    expect(p.sabadosCriar).toEqual([{ data: '2027-03-13', diaSemanaReferente: 3, observacao: 'Reposição' }]);
    expect(p.mudancas).toBe(4);
  });

  it('acusa tipo, data, ano, sábado e etapas fora de ordem', () => {
    const p = planejarImportacaoCalendario({
      ano: 2027,
      existente: vazio,
      registros: [
        reg(2, { tipo: 'Festa', inicio: '01/02/2027' }),
        reg(3, { tipo: 'Feriado', inicio: '01/02/2026' }),
        reg(4, { tipo: 'Sábado letivo', inicio: '15/03/2027', grade: 'Segunda' }),
        reg(5, { tipo: 'Etapa N1', inicio: '01/02/2027', fim: '30/04/2027' }),
        reg(6, { tipo: 'Etapa N2', inicio: '19/04/2027', fim: '30/06/2027' }),
        reg(7, { tipo: 'Suspensão de aulas (força maior)', inicio: '05/05/2027' }),
        reg(8, { tipo: 'Feriado', inicio: '21/04/2027', aulas: 'talvez' }),
      ],
    });
    expect(p.temErros).toBe(true);
    const erro = (n: number) => p.linhas.find((l) => l.numero === n)?.detalhe ?? '';
    expect(erro(2)).toMatch(/Tipo não reconhecido/);
    expect(erro(3)).toMatch(/Use datas de 2027/);
    expect(erro(4)).toMatch(/sábado/);
    expect(erro(6)).toMatch(/Começa antes do fim de N1/);
    expect(erro(7)).toMatch(/motivo/);
    expect(erro(8)).toMatch(/Aulas/);
  });

  it('atualiza o que já existe pelo tipo e datas e marca iguais; recusa linha repetida', () => {
    const existente: CalendarioExistente = {
      ...vazio,
      etapas: [{ inicio: '2027-02-01', fim: '2027-04-16' }, null, null, null],
      eventos: [{ id: 'e1', tipo: 'FERIADO', inicio: '2027-04-21', fim: '2027-04-21', descricao: 'Tiradentes', suspendeAulas: true, imprevisto: false, motivo: null }],
      sabados: [{ id: 's1', data: '2027-03-13', diaSemanaReferente: 3, observacao: null }],
    };
    const p = planejarImportacaoCalendario({
      ano: 2027,
      existente,
      registros: [
        reg(2, { tipo: 'Etapa N1', inicio: '01/02/2027', fim: '16/04/2027' }),
        reg(3, { tipo: 'Feriado', inicio: '21/04/2027', descricao: 'Tiradentes (nacional)' }),
        reg(4, { tipo: 'Sábado letivo', inicio: '13/03/2027', grade: 'Quarta' }),
        reg(5, { tipo: 'Sábado letivo', inicio: '13/03/2027', grade: 'Quinta' }),
      ],
    });
    expect(p.linhas.map((l) => l.situacao)).toEqual(['igual', 'atualizar', 'igual', 'erro']);
    expect(p.eventosAtualizar[0]).toMatchObject({ id: 'e1', descricao: 'Tiradentes (nacional)' });
    expect(p.etapas.every((e) => e === null)).toBe(true);
  });

  it('a exportação volta pela importação sem mudanças', () => {
    const existente: CalendarioExistente = {
      etapas: [{ inicio: '2027-02-01', fim: '2027-04-16' }, null, null, null],
      semestres: [{ inicio: '2027-02-01', fim: '2027-06-30' }, null],
      eventos: [
        { id: 'e1', tipo: 'SUSPENSAO_AULAS', inicio: '2027-05-05', fim: '2027-05-06', descricao: null, suspendeAulas: true, imprevisto: true, motivo: 'Falta de energia' },
        { id: 'e2', tipo: 'REUNIAO', inicio: '2027-03-10', fim: '2027-03-10', descricao: 'Pedagógica', suspendeAulas: false, imprevisto: false, motivo: null },
      ],
      sabados: [{ id: 's1', data: '2027-03-13', diaSemanaReferente: 3, observacao: 'Reposição' }],
    };
    const linhas = linhasDoCalendario(existente);
    expect(linhas[0][0]).toBe('Etapa N1');
    const registros = linhas.map((l, i) => reg(i + 2, Object.fromEntries(COLUNAS_CALENDARIO.map((c, k) => [c.campo, l[k]]))));
    const p = planejarImportacaoCalendario({ ano: 2027, existente, registros });
    expect(p.temErros).toBe(false);
    expect(p.mudancas).toBe(0);
    expect(p.linhas.every((l) => l.situacao === 'igual')).toBe(true);
  });
});
