import * as z from 'zod';

const vazioParaUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/** Carga horária máxima aceita (h). Disciplinas do curso técnico ficam bem abaixo disso. */
export const CARGA_HORARIA_MAXIMA = 400;

/** Dados do formulário de disciplina (criação e edição). Campos de checkbox chegam como "on" ou vazio. */
export const DisciplinaSchema = z.object({
  // Código do SUAP/matriz (ex.: "RED.012"). Guardado em maiúsculas para evitar duplicatas por caixa.
  codigo: z.preprocess(
    vazioParaUndefined,
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9.\-/]{1,19}$/, {
        error: 'Use de 2 a 20 caracteres: letras, números, ponto, hífen ou barra (ex.: RED.012).',
      })
      .optional(),
  ),
  nome: z
    .string()
    .trim()
    .min(3, { error: 'Informe o nome da disciplina.' })
    .max(120, { error: 'Use no máximo 120 caracteres.' }),
  cargaHoraria: z
    .string()
    .trim()
    .min(1, { error: 'Informe a carga horária total, em horas.' })
    .regex(/^\d+$/, { error: 'Informe só o número de horas, sem "h" (ex.: 80).' })
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(1, { error: 'A carga horária deve ser de pelo menos 1 hora.' })
        .max(CARGA_HORARIA_MAXIMA, { error: `A carga horária deve ser de no máximo ${CARGA_HORARIA_MAXIMA} horas.` }),
    ),
  exigePratica: z.string().optional().transform((v) => v === 'on'),
  ementaUrl: z.preprocess(
    vazioParaUndefined,
    z
      .string()
      .trim()
      .max(500, { error: 'Use no máximo 500 caracteres.' })
      .pipe(z.url({ protocol: /^https?$/, error: 'Informe um endereço completo, começando com https:// ou http://.' }))
      .optional(),
  ),
  programaTexto: z.preprocess(
    vazioParaUndefined,
    z.string().trim().max(10_000, { error: 'Use no máximo 10.000 caracteres.' }).optional(),
  ),
});

export type DadosDisciplina = z.infer<typeof DisciplinaSchema>;

/**
 * Uma disciplina só pode ser excluída se nunca foi usada: ofertas e PPEs guardam histórico acadêmico.
 * Retorna a mensagem de bloqueio, ou null se a exclusão é permitida.
 */
export function verificarExclusao(uso: { ofertas: number; ppes: number }): string | null {
  if (uso.ofertas === 0 && uso.ppes === 0) return null;
  const partes = [
    uso.ofertas > 0 && `${uso.ofertas} oferta(s)`,
    uso.ppes > 0 && `${uso.ppes} registro(s) de PPE`,
  ].filter(Boolean);
  return `Esta disciplina já tem ${partes.join(' e ')} e não pode ser excluída. Desative-a para tirá-la das listas sem perder o histórico.`;
}
