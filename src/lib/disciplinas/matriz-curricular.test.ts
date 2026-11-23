import { describe, expect, it } from 'vitest';
import { MATRIZ_REDES } from './matriz-curricular';
import { DisciplinaSchema } from './regras';

const total = (ano: number) => MATRIZ_REDES.filter((d) => d.ano === ano).reduce((s, d) => s + d.cargaHoraria, 0);

describe('MATRIZ_REDES (PPC, seção 13)', () => {
  it('toda disciplina passa na mesma validação do formulário', () => {
    for (const d of MATRIZ_REDES) {
      const r = DisciplinaSchema.safeParse({ codigo: d.codigo ?? '', nome: d.nome, cargaHoraria: String(d.cargaHoraria) });
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

  it('a divergência do 3º ano com o PPC (960h) está registrada como pendência', () => {
    expect(total(3)).not.toBe(960);
    expect(MATRIZ_REDES.filter((d) => d.ano === 3 && d.pendencia)).toHaveLength(4);
  });

  it('técnicas semestrais estão no semestre do seu ano', () => {
    for (const d of MATRIZ_REDES.filter((x) => x.semestre !== null)) {
      expect([d.ano * 2 - 1, d.ano * 2], d.nome).toContain(d.semestre);
    }
  });
});
