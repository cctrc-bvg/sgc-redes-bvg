import { describe, expect, it } from 'vitest';
import { CONTAGENS_ZERADAS, montarAcoes, ordenarAcoes, separarAcoes } from './acoes';

const coordenacao = { daCienciaRefeicao: false };
const ae = { daCienciaRefeicao: true };

describe('montarAcoes', () => {
  it('sem contagens, nada pede atenção', () => {
    expect(montarAcoes(CONTAGENS_ZERADAS, coordenacao)).toEqual([]);
  });

  it('ausência para hoje ou amanhã é urgente; mais adiante, atenção', () => {
    const urgente = montarAcoes({ ...CONTAGENS_ZERADAS, ausenciasPendentes: 3, ausenciasHojeOuAmanha: 1 }, coordenacao);
    expect(urgente[0]).toMatchObject({ id: 'ausencias', nivel: 'urgente', quantidade: 3 });
    expect(urgente[0].detalhe).toContain('1 para hoje ou amanhã');
    const depois = montarAcoes({ ...CONTAGENS_ZERADAS, ausenciasPendentes: 2 }, coordenacao);
    expect(depois[0]).toMatchObject({ nivel: 'atencao' });
  });

  it('refeição: a AE dá ciência; a Coordenação liga na emergência e só acompanha o resto', () => {
    const c = { ...CONTAGENS_ZERADAS, emergenciasRefeicao: 1, avisosRefeicao: 2 };
    const daAe = montarAcoes(c, ae);
    expect(daAe.map((a) => [a.id, a.nivel, a.botao])).toEqual([
      ['refeicao-emergencia', 'urgente', 'Dar ciência'],
      ['refeicao-avisos', 'atencao', 'Dar ciência'],
    ]);
    const daCoord = montarAcoes(c, coordenacao);
    expect(daCoord.find((a) => a.id === 'refeicao-emergencia')?.detalhe).toContain('Ligue');
    expect(daCoord.find((a) => a.id === 'refeicao-avisos')?.nivel).toBe('acompanhar');
  });

  it('ordena urgente, atenção e acompanhar, e separa o que é só para acompanhar', () => {
    const acoes = montarAcoes({ ...CONTAGENS_ZERADAS, diariosAtrasados: 4, processosVencidos: 1, convitesPendentes: 2, etapasFaltando: true }, coordenacao);
    expect(acoes.map((a) => a.nivel)).toEqual(['urgente', 'atencao', 'atencao', 'acompanhar']);
    const { agir, acompanhar } = separarAcoes(acoes);
    expect(agir.map((a) => a.id)).toEqual(['convites', 'processos', 'etapas']);
    expect(acompanhar.map((a) => a.id)).toEqual(['diarios']);
  });

  it('não expõe nomes: os textos só falam de quantidades', () => {
    const todas = montarAcoes(
      { ...CONTAGENS_ZERADAS, ppeParaDefinir: 1, peiParaPreencher: 1, ppiEmAnalise: 1, ppeRetencao: 1, meusDiariosAtrasados: 1 },
      coordenacao,
    );
    expect(todas).toHaveLength(5);
    for (const a of todas) expect(a.href.startsWith('/')).toBe(true);
  });

  it('ordenarAcoes é estável dentro do mesmo nível', () => {
    const base = { icone: 'ppe' as const, quantidade: 1, titulo: '', detalhe: '', href: '/', botao: '' };
    const r = ordenarAcoes([
      { ...base, id: 'a', nivel: 'atencao' },
      { ...base, id: 'b', nivel: 'urgente' },
      { ...base, id: 'c', nivel: 'atencao' },
    ]);
    expect(r.map((a) => a.id)).toEqual(['b', 'a', 'c']);
  });
});
