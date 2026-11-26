import { describe, expect, it } from 'vitest';
import {
  aplicarCategoria,
  aplicarEdicoes,
  assinatura,
  clicarNoDia,
  contarInstantaneo,
  diferencaEntre,
  edicoesEntre,
  estadoDoInstantaneo,
  feriadosNacionais,
  inserirFeriadosNacionais,
  instantaneoDoEstado,
  pascoa,
  SELECAO_VAZIA,
  situacaoDoDia,
  textoDaDiferenca,
  validarEdicoes,
  voltarAoPadrao,
  type Instantaneo,
} from './editor';

const vazio: Instantaneo = { eventos: [], extras: [], etapas: [null, null, null, null], semestres: [null, null] };
const base: Instantaneo = {
  ...vazio,
  etapas: [{ inicio: '2026-11-02', fim: '2026-11-30' }, null, null, null],
  semestres: [{ inicio: '2026-11-02', fim: '2026-11-30' }, null],
};

describe('seleção de dias', () => {
  it('clique seleciona um dia; Shift+clique pega o intervalo desde a âncora (nos dois sentidos)', () => {
    let s = clicarNoDia(SELECAO_VAZIA, '2026-11-10', {});
    expect([...s.dias]).toEqual(['2026-11-10']);
    s = clicarNoDia(s, '2026-11-13', { shift: true });
    expect([...s.dias]).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
    s = clicarNoDia(s, '2026-11-08', { shift: true });
    expect([...s.dias]).toEqual(['2026-11-08', '2026-11-09', '2026-11-10']);
    expect(s.ancora).toBe('2026-11-10');
  });

  it('Ctrl+clique liga e desliga dias soltos; Ctrl+Shift soma o intervalo', () => {
    let s = clicarNoDia(SELECAO_VAZIA, '2026-11-02', {});
    s = clicarNoDia(s, '2026-11-05', { ctrl: true });
    expect([...s.dias].sort()).toEqual(['2026-11-02', '2026-11-05']);
    s = clicarNoDia(s, '2026-11-02', { ctrl: true });
    expect([...s.dias]).toEqual(['2026-11-05']);
    s = clicarNoDia(s, '2026-11-09', { ctrl: true });
    s = clicarNoDia(s, '2026-11-12', { ctrl: true, shift: true });
    expect([...s.dias].sort()).toEqual(['2026-11-05', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
  });

  it('Shift sem âncora age como clique simples', () => {
    expect([...clicarNoDia(SELECAO_VAZIA, '2026-11-10', { shift: true }).dias]).toEqual(['2026-11-10']);
  });
});

describe('marcar dias', () => {
  it('feriado em dias seguidos vira um só evento; dias separados viram eventos separados', () => {
    let e = estadoDoInstantaneo(base);
    e = aplicarCategoria(e, ['2026-11-02', '2026-11-03', '2026-11-05'], 'FERIADO', { descricao: 'Finados' });
    const inst = instantaneoDoEstado(e, base.etapas, base.semestres);
    expect(inst.eventos.map((x) => `${x.tipo} ${x.inicio}..${x.fim}`)).toEqual(['FERIADO 2026-11-02..2026-11-03', 'FERIADO 2026-11-05..2026-11-05']);
    expect(inst.eventos.every((x) => x.suspendeAulas)).toBe(true);
  });

  it('sábado vira letivo com o dia da grade; "voltar ao padrão" desfaz; dia útil letivo limpa a marca', () => {
    let e = estadoDoInstantaneo(base);
    e = aplicarCategoria(e, ['2026-11-07'], 'LETIVO', { diaReferente: 3 });
    expect(situacaoDoDia(e, '2026-11-07')).toBe('FIM_DE_SEMANA_LETIVO');
    expect(e.extras.get('2026-11-07')?.diaReferente).toBe(3);
    e = aplicarCategoria(e, ['2026-11-08'], 'LETIVO', { diaReferente: 1 }); // domingo letivo
    expect(situacaoDoDia(e, '2026-11-08')).toBe('FIM_DE_SEMANA_LETIVO');
    e = voltarAoPadrao(e, ['2026-11-07', '2026-11-08']);
    expect(situacaoDoDia(e, '2026-11-07')).toBe('FIM_DE_SEMANA');
    e = aplicarCategoria(e, ['2026-11-09'], 'FERIADO');
    e = aplicarCategoria(e, ['2026-11-09'], 'LETIVO');
    expect(situacaoDoDia(e, '2026-11-09')).toBe('LETIVO');
  });

  it('o ciclo estado → instantâneo → estado não perde nada', () => {
    let e = estadoDoInstantaneo(base);
    e = aplicarCategoria(e, ['2026-11-02', '2026-11-03'], 'SUSPENSAO_AULAS', { motivo: 'Falta de energia' });
    e = aplicarCategoria(e, ['2026-11-14'], 'LETIVO', { diaReferente: 2 });
    const i1 = instantaneoDoEstado(e, base.etapas, base.semestres);
    const i2 = instantaneoDoEstado(estadoDoInstantaneo(i1), base.etapas, base.semestres);
    expect(assinatura(i2)).toBe(assinatura(i1));
  });

  it('eventos que o editor não mexe (reunião) ficam como estão', () => {
    const inst: Instantaneo = { ...base, eventos: [{ tipo: 'REUNIAO', inicio: '2026-11-10', fim: '2026-11-10', descricao: 'Conselho', suspendeAulas: false, imprevisto: false, motivo: '' }] };
    const e = aplicarCategoria(estadoDoInstantaneo(inst), ['2026-11-10'], 'FERIADO');
    const r = instantaneoDoEstado(e, inst.etapas, inst.semestres);
    expect(r.eventos.map((x) => x.tipo).sort()).toEqual(['FERIADO', 'REUNIAO']);
  });
});

describe('contadores', () => {
  it('conta letivos, feriados, pontos facultativos e sábados/domingos letivos', () => {
    let e = estadoDoInstantaneo(base);
    expect(contarInstantaneo(instantaneoDoEstado(e, base.etapas, base.semestres), 2026).letivos).toBe(21); // nov/2026: 21 dias úteis (02 a 30)
    e = aplicarCategoria(e, ['2026-11-02', '2026-11-20'], 'FERIADO');
    e = aplicarCategoria(e, ['2026-11-16'], 'PONTO_FACULTATIVO');
    e = aplicarCategoria(e, ['2026-11-14'], 'LETIVO', { diaReferente: 1 });
    e = aplicarCategoria(e, ['2026-11-15'], 'LETIVO', { diaReferente: 2 });
    const c = contarInstantaneo(instantaneoDoEstado(e, base.etapas, base.semestres), 2026);
    expect(c).toMatchObject({ feriados: 2, pontosFacultativos: 1, sabadosLetivos: 1, domingosLetivos: 1, letivos: 21 - 3 + 2 });
    expect(c.porEtapa[0]).toBe(20);
  });

  it('feriado em fim de semana não conta como dia útil perdido', () => {
    const e = aplicarCategoria(estadoDoInstantaneo(base), ['2026-11-07'], 'FERIADO');
    expect(contarInstantaneo(instantaneoDoEstado(e, base.etapas, base.semestres), 2026).feriados).toBe(0);
  });
});

describe('histórico', () => {
  it('assinatura igual quando nada mudou; diferença descreve os dias', () => {
    const antes = instantaneoDoEstado(estadoDoInstantaneo(base), base.etapas, base.semestres);
    const e = aplicarCategoria(estadoDoInstantaneo(base), ['2026-11-02', '2026-11-03'], 'FERIADO');
    e.extras.set('2026-11-07', { diaReferente: 1, observacao: '' });
    const depois = instantaneoDoEstado(e, base.etapas, base.semestres);
    expect(assinatura(antes)).toBe(assinatura(instantaneoDoEstado(estadoDoInstantaneo(base), base.etapas, base.semestres)));
    expect(assinatura(antes)).not.toBe(assinatura(depois));
    expect(textoDaDiferenca(diferencaEntre(antes, depois))).toBe('Feriado: +2 dias; Sábado/domingo letivo: +1 dia');
    expect(textoDaDiferenca(diferencaEntre(antes, antes))).toBe('Sem mudança nos dias.');
  });
});

describe('modelo de calendário novo', () => {
  it('Páscoa de datas conhecidas', () => {
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2027)).toBe('2027-03-28');
  });

  it('feriados nacionais de 2027 só em dia útil, com Carnaval e Corpus Christi como ponto facultativo', () => {
    const f = feriadosNacionais(2027);
    expect(f.find((x) => x.nome === 'Sexta-feira Santa')?.data).toBe('2027-03-26');
    expect(f.filter((x) => x.nome === 'Carnaval').map((x) => x.data)).toEqual(['2027-02-08', '2027-02-09']);
    expect(f.find((x) => x.nome === 'Corpus Christi')).toMatchObject({ data: '2027-05-27', tipo: 'PONTO_FACULTATIVO' });
    expect(f.some((x) => x.nome === 'Dia do Trabalho')).toBe(false); // 01/05/2027 é sábado
    expect(f.some((x) => x.nome === 'Natal')).toBe(false); // 25/12/2027 é sábado
  });

  it('inserir feriados não sobrescreve o que já estava marcado', () => {
    let e = estadoDoInstantaneo(vazio);
    e = aplicarCategoria(e, ['2027-04-21'], 'ENCONTRO_PEDAGOGICO');
    const { estado, inseridos } = inserirFeriadosNacionais(e, 2027);
    expect(estado.marcas.get('2027-04-21')?.tipo).toBe('ENCONTRO_PEDAGOGICO');
    expect(inseridos).toBe(feriadosNacionais(2027).length - 1);
  });
});

describe('edições enviadas pela tela', () => {
  it('só os dias que mudaram viajam; aplicar no estado do servidor reproduz o editado', () => {
    const base0 = estadoDoInstantaneo(base);
    let novo = aplicarCategoria(base0, ['2026-11-02', '2026-11-03'], 'FERIADO', { descricao: 'Finados' });
    novo = aplicarCategoria(novo, ['2026-11-07'], 'LETIVO', { diaReferente: 4 });
    const ed = edicoesEntre(base0, novo);
    expect(ed.map((x) => x.data)).toEqual(['2026-11-02', '2026-11-03', '2026-11-07']);
    const refeito = aplicarEdicoes(estadoDoInstantaneo(base), ed);
    expect(assinatura(instantaneoDoEstado(refeito, base.etapas, base.semestres))).toBe(assinatura(instantaneoDoEstado(novo, base.etapas, base.semestres)));
    expect(edicoesEntre(novo, novo)).toEqual([]);
  });

  it('validação: ano, tipo, motivo da suspensão, fim de semana e limites', () => {
    const motivos = ['Falta de energia'];
    const marca = (tipo: string, extra: object = {}) => ({ tipo, descricao: '', suspendeAulas: true, imprevisto: false, motivo: '', ...extra });
    expect(validarEdicoes([{ data: '2026-11-02', marca: marca('FERIADO'), extra: null }], 2026, motivos).ok).toBe(true);
    expect(validarEdicoes([{ data: '2027-01-04', marca: marca('FERIADO'), extra: null }], 2026, motivos)).toMatchObject({ ok: false });
    expect(validarEdicoes([{ data: '2026-11-02', marca: marca('REUNIAO'), extra: null }], 2026, motivos)).toMatchObject({ ok: false });
    expect(validarEdicoes([{ data: '2026-11-02', marca: marca('SUSPENSAO_AULAS', { motivo: 'qualquer' }), extra: null }], 2026, motivos)).toMatchObject({ ok: false });
    expect(validarEdicoes([{ data: '2026-11-02', marca: null, extra: { diaReferente: 1, observacao: '' } }], 2026, motivos)).toMatchObject({ ok: false }); // segunda-feira
    expect(validarEdicoes([{ data: '2026-11-07', marca: null, extra: { diaReferente: 9, observacao: '' } }], 2026, motivos)).toMatchObject({ ok: false });
    expect(validarEdicoes([{ data: '2026-11-07', marca: null, extra: { diaReferente: 2, observacao: '' } }], 2026, motivos).ok).toBe(true);
    expect(validarEdicoes([], 2026, motivos)).toMatchObject({ ok: false });
    const av = validarEdicoes([{ data: '2026-12-10', marca: marca('AVALIACOES_FINAIS', { suspendeAulas: false }), extra: null }], 2026, motivos);
    expect(av.ok && av.edicoes[0]!.marca!.suspendeAulas).toBe(true);
  });
});
