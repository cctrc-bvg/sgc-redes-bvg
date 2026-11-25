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

  it('marca as ações da docência (para quem acumula com o cargo) e aponta para o recorte "meu"', () => {
    const acoes = montarAcoes({ ...CONTAGENS_ZERADAS, convitesPendentes: 1, ppeParaDefinir: 1, peiParaPreencher: 1, meusDiariosAtrasados: 1, ausenciasPendentes: 1 }, coordenacao);
    const papel = Object.fromEntries(acoes.map((a) => [a.id, a.papel]));
    expect(papel).toEqual({ convites: 'docencia', 'ppe-definir': 'docencia', 'pei-preencher': 'docencia', 'meus-diarios': 'docencia', ausencias: 'cargo' });
    expect(acoes.find((a) => a.id === 'ppe-definir')?.href).toBe('/ppe?escopo=minhas');
    expect(acoes.find((a) => a.id === 'meus-diarios')?.href).toBe('/diarios?escopo=meus');
  });

  it('PEI em andamento: encontros a confirmar e resultado a lançar são da docência', () => {
    const acoes = montarAcoes({ ...CONTAGENS_ZERADAS, encontrosPeiAConfirmar: 3, peiParaConcluir: 1 }, coordenacao);
    expect(acoes.map((a) => [a.id, a.papel, a.quantidade])).toEqual([
      ['pei-concluir', 'docencia', 1],
      ['pei-encontros', 'docencia', 3],
    ]);
  });

  it('preparação do ano e fim da PPE pedem ação da Coordenação; o resto ela acompanha', () => {
    const acoes = montarAcoes(
      { ...CONTAGENS_ZERADAS, semestreSemDatas: true, disciplinasSemProfessor: 4, turmasSemGrade: 1, ppeParaLancar: 2, ppeAguardandoDocente: 5, processosAVencer: 1 },
      coordenacao,
    );
    const { agir, acompanhar } = separarAcoes(acoes);
    expect(agir.map((a) => a.id)).toEqual(['ppe-lancar', 'semestre-datas', 'sem-professor', 'sem-grade']);
    expect(acompanhar.map((a) => a.id)).toEqual(['ppe-aguardando', 'processos-a-vencer']);
    expect(acoes.every((a) => a.papel === 'cargo')).toBe(true);
  });

  it('reposições sem data: urgente se há prazo vencido, atenção se só vencem em breve; some sem nenhuma', () => {
    expect(montarAcoes(CONTAGENS_ZERADAS, coordenacao).some((a) => a.id === 'reposicoes')).toBe(false);
    const vencida = montarAcoes({ ...CONTAGENS_ZERADAS, reposicoesVencidas: 1, reposicoesAVencer: 2 }, coordenacao).find((a) => a.id === 'reposicoes')!;
    expect(vencida).toMatchObject({ nivel: 'urgente', quantidade: 3, papel: 'cargo' });
    expect(vencida.detalhe).toContain('1 com o prazo vencido');
    expect(vencida.detalhe).toContain('2 vencem em até 5 dias');
    const breve = montarAcoes({ ...CONTAGENS_ZERADAS, reposicoesAVencer: 1 }, coordenacao).find((a) => a.id === 'reposicoes')!;
    expect(breve.nivel).toBe('atencao');
  });

  it('ordenarAcoes é estável dentro do mesmo nível', () => {
    const base = { papel: 'cargo' as const, icone: 'ppe' as const, quantidade: 1, titulo: '', detalhe: '', href: '/', botao: '' };
    const r = ordenarAcoes([
      { ...base, id: 'a', nivel: 'atencao' },
      { ...base, id: 'b', nivel: 'urgente' },
      { ...base, id: 'c', nivel: 'atencao' },
    ]);
    expect(r.map((a) => a.id)).toEqual(['b', 'a', 'c']);
  });
});
