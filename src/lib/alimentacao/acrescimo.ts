/**
 * Acréscimo manual de refeição (G05): encontro de PEI, laboratório ou reposição no contraturno.
 * A Coordenação lança turma, data, refeições e quantidade; a AE recebe como aviso "Adicionar".
 */
import type { TipoRefeicao } from '@prisma/client';
import * as z from 'zod';
import { classificarSla, validarDataISO } from '@/lib/alimentacao-engine';
import { ALUNOS_MAXIMO } from '@/lib/turmas/regras';

export const HORARIO_REFEICAO: Record<TipoRefeicao, string> = { LANCHE_MANHA: '09:30', ALMOCO: '12:00', LANCHE_TARDE: '15:00' };

export const AcrescimoSchema = z.object({
  turmaId: z.string().trim().min(1, { error: 'Escolha a turma.' }),
  data: z
    .string()
    .trim()
    .min(1, { error: 'Informe a data do encontro.' })
    .refine(
      (v) => {
        try {
          validarDataISO(v);
          return true;
        } catch {
          return false;
        }
      },
      { error: 'Informe uma data válida.' },
    ),
  refeicoes: z.array(z.enum(['LANCHE_MANHA', 'ALMOCO', 'LANCHE_TARDE'])).min(1, { error: 'Marque pelo menos uma refeição.' }),
  quantidade: z
    .string()
    .trim()
    .regex(/^\d+$/, { error: 'Informe o número de estudantes (ex.: 6).' })
    .transform(Number)
    .pipe(z.number().int().min(1, { error: 'Informe pelo menos 1 estudante.' }).max(ALUNOS_MAXIMO, { error: `Use no máximo ${ALUNOS_MAXIMO}.` })),
  descricao: z
    .string()
    .trim()
    .min(3, { error: 'Descreva a atividade (ex.: Encontro de PEI de Matemática).' })
    .max(120, { error: 'Use no máximo 120 caracteres.' }),
});

export type DadosAcrescimo = z.infer<typeof AcrescimoSchema>;

/**
 * Para cada refeição marcada: instante, antecedência e urgência (RF04). Refeição cujo horário já passou
 * é recusada (não há o que avisar).
 */
export function planejarAcrescimo(dados: Pick<DadosAcrescimo, 'data' | 'refeicoes'>, agora: Date) {
  const itens = dados.refeicoes.map((tipo) => {
    const instante = new Date(`${dados.data}T${HORARIO_REFEICAO[tipo]}:00-03:00`);
    const antecedenciaMin = Math.floor((instante.getTime() - agora.getTime()) / 60000);
    return { tipo, instante, antecedenciaMin, nivel: classificarSla(antecedenciaMin).nivel };
  });
  const passadas = itens.filter((i) => i.antecedenciaMin < 0).map((i) => i.tipo);
  return { itens, passadas };
}
