import { describe, expect, it } from 'vitest';
import { BLOCOS_HORARIO } from './blocos-horario';

const min = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const turno = (t: 'MANHA' | 'TARDE') => BLOCOS_HORARIO.filter((b) => b.turno === t).sort((a, b) => a.ordem - b.ordem);

describe('BLOCOS_HORARIO (G01)', () => {
  it('cada turno tem 4 blocos de 60 minutos, sem sobreposição', () => {
    for (const t of ['MANHA', 'TARDE'] as const) {
      const blocos = turno(t);
      expect(blocos.map((b) => b.rotulo)).toEqual(['A', 'B', 'C', 'D']);
      blocos.forEach((b, i) => {
        expect(min(b.horaFim) - min(b.horaInicio), `${t} ${b.rotulo}`).toBe(60);
        if (i > 0) expect(min(b.horaInicio)).toBeGreaterThanOrEqual(min(blocos[i - 1].horaFim));
      });
    }
  });

  // Os horários de refeição do motor de alimentação (09:30, 12:00, 15:00) caem nos intervalos da grade.
  it('lanche da manhã (09:30) e da tarde (15:00) coincidem com o fim do bloco B', () => {
    expect(turno('MANHA')[1].horaFim).toBe('09:30');
    expect(turno('TARDE')[1].horaFim).toBe('15:00');
  });

  it('almoço (12:00) fica entre o fim da manhã e o início da tarde', () => {
    expect(min(turno('MANHA')[3].horaFim)).toBeLessThanOrEqual(min('12:00'));
    expect(min(turno('TARDE')[0].horaInicio)).toBeGreaterThan(min('12:00'));
  });
});
