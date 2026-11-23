import type { Turno } from '@prisma/client';

/**
 * Blocos de aula do Campus Boa Viagem (G01), conforme a grade de 2026 gerada no aSc TimeTables:
 * 4 blocos de 60 min por turno (A–D), com intervalo entre B e C. Aulas de segunda a sexta.
 * Sábados letivos: ainda a definir.
 */
export interface BlocoPadrao {
  turno: Turno;
  ordem: number;
  rotulo: string;
  horaInicio: string;
  horaFim: string;
}

export const BLOCOS_HORARIO: readonly BlocoPadrao[] = [
  { turno: 'MANHA', ordem: 1, rotulo: 'A', horaInicio: '07:30', horaFim: '08:30' },
  { turno: 'MANHA', ordem: 2, rotulo: 'B', horaInicio: '08:30', horaFim: '09:30' },
  { turno: 'MANHA', ordem: 3, rotulo: 'C', horaInicio: '09:45', horaFim: '10:45' },
  { turno: 'MANHA', ordem: 4, rotulo: 'D', horaInicio: '10:45', horaFim: '11:45' },
  { turno: 'TARDE', ordem: 1, rotulo: 'A', horaInicio: '13:00', horaFim: '14:00' },
  { turno: 'TARDE', ordem: 2, rotulo: 'B', horaInicio: '14:00', horaFim: '15:00' },
  { turno: 'TARDE', ordem: 3, rotulo: 'C', horaInicio: '15:20', horaFim: '16:20' },
  { turno: 'TARDE', ordem: 4, rotulo: 'D', horaInicio: '16:20', horaFim: '17:20' },
];
