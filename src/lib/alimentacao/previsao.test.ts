import { describe, expect, it } from 'vitest';
import { lerQuantidade, preverRefeicoesDaTurma, somarQuantidades } from './previsao';

const medias = { LANCHE_MANHA: 35, ALMOCO: 30, LANCHE_TARDE: 28 };

describe('preverRefeicoesDaTurma', () => {
  it('RN01: só manhã → lanche da manhã; integral → as três', () => {
    expect(preverRefeicoesDaTurma({ temAulaManha: true, temAulaTarde: false }, medias, []).base).toEqual({ LANCHE_MANHA: 35, ALMOCO: 0, LANCHE_TARDE: 0 });
    expect(preverRefeicoesDaTurma({ temAulaManha: true, temAulaTarde: true }, medias, []).final).toEqual(medias);
    expect(preverRefeicoesDaTurma({ temAulaManha: false, temAulaTarde: false }, medias, []).final).toEqual({ LANCHE_MANHA: 0, ALMOCO: 0, LANCHE_TARDE: 0 });
  });

  it('cancelamento desconta a quantidade do aviso (G04: parcial mantém o restante)', () => {
    const p = preverRefeicoesDaTurma({ temAulaManha: true, temAulaTarde: true }, medias, [
      { tipoRefeicao: 'ALMOCO', acao: 'CANCELAR_REFEICAO', qtdImpactada: 22 },
      { tipoRefeicao: 'LANCHE_TARDE', acao: 'CANCELAR_REFEICAO', qtdImpactada: 40 },
    ]);
    expect(p.final).toEqual({ LANCHE_MANHA: 35, ALMOCO: 8, LANCHE_TARDE: 0 });
    expect(p.prevista.ALMOCO).toBe(true);
  });

  it('acréscimo soma refeição fora da grade (encontro no contraturno, G05)', () => {
    const p = preverRefeicoesDaTurma({ temAulaManha: true, temAulaTarde: false }, medias, [{ tipoRefeicao: 'ALMOCO', acao: 'ADICIONAR_REFEICAO', qtdImpactada: 6 }]);
    expect(p.final.ALMOCO).toBe(6);
    expect(p.prevista.ALMOCO).toBe(false);
  });

  it('soma totais e lê quantidade editada', () => {
    expect(somarQuantidades([medias, { LANCHE_MANHA: 1, ALMOCO: 2, LANCHE_TARDE: 3 }])).toEqual({ LANCHE_MANHA: 36, ALMOCO: 32, LANCHE_TARDE: 31 });
    expect(lerQuantidade(' 12 ', 80)).toBe(12);
    expect(lerQuantidade('0', 80)).toBe(0);
    expect(lerQuantidade('81', 80)).toBeNull();
    expect(lerQuantidade('1,5', 80)).toBeNull();
    expect(lerQuantidade(undefined, 80)).toBeNull();
  });
});
