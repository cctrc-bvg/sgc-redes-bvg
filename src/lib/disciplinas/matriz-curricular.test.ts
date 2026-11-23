import { describe, expect, it } from 'vitest';
import { MATRIZ_REDES } from './matriz-curricular';
import { DisciplinaSchema } from './regras';

const total = (ano: number) => MATRIZ_REDES.filter((d) => d.anoCurso === ano).reduce((s, d) => s + d.cargaHoraria, 0);

describe('MATRIZ_REDES (PPC, seção 13)', () => {
  it('toda disciplina passa na mesma validação do formulário', () => {
    for (const d of MATRIZ_REDES) {
      const r = DisciplinaSchema.safeParse({
        codigo: d.codigo ?? '',
        nome: d.nome,
        cargaHoraria: String(d.cargaHoraria),
        nucleo: d.nucleo,
        anoCurso: String(d.anoCurso),
        semestreCurso: d.semestreCurso ? String(d.semestreCurso) : '',
      });
      expect(r.success, `${d.nome}: ${r.error?.issues[0]?.message}`).toBe(true);
    }
  });

  it('códigos e nomes são únicos (o seed usa um ou outro para não duplicar)', () => {
    const codigos = MATRIZ_REDES.map((d) => d.codigo).filter(Boolean);
    expect(new Set(codigos).size).toBe(codigos.length);
    const nomes = MATRIZ_REDES.map((d) => d.nome.toLowerCase());
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it('1º e 2º anos fecham com a carga total do PPC (920h e 1.360h)', () => {
    expect(total(1)).toBe(920);
    expect(total(2)).toBe(1360);
  });

  it('3º ano soma 1.080h (o total de 960h impresso no PPC tem erro de soma)', () => {
    expect(total(3)).toBe(1080);
  });

  it('não há pendências de transcrição em aberto', () => {
    expect(MATRIZ_REDES.filter((d) => d.pendencia)).toEqual([]);
  });

  it('técnicas do 3º ano têm as siglas próprias, não as do 2º ano', () => {
    const terceiro = MATRIZ_REDES.filter((d) => d.anoCurso === 3 && d.nucleo === 'TECNICO').map((d) => d.codigo);
    expect(terceiro).toEqual(['SEGR', 'EB', 'PRD', 'RSF']);
  });

  it('técnicas são semestrais; propedêuticas e diversificadas, anuais', () => {
    for (const d of MATRIZ_REDES) {
      expect(d.semestreCurso === null, d.nome).toBe(d.nucleo !== 'TECNICO');
    }
  });

  it('1º ano: técnicas somam 120h no 1º semestre e 160h no 2º', () => {
    const sem = (s: number) => MATRIZ_REDES.filter((d) => d.semestreCurso === s).reduce((t, d) => t + d.cargaHoraria, 0);
    expect([sem(1), sem(2)]).toEqual([120, 160]);
  });
});
