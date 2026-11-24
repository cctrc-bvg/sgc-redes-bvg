import type { NucleoDisciplina } from '@prisma/client';
import * as z from 'zod';

const vazioParaUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/** Carga horária máxima aceita (h). Disciplinas do curso técnico ficam bem abaixo disso. */
export const CARGA_HORARIA_MAXIMA = 400;

export const NUCLEOS = ['PROPEDEUTICO', 'DIVERSIFICADO', 'TECNICO'] as const satisfies readonly NucleoDisciplina[];

export const NOME_NUCLEO: Record<NucleoDisciplina, string> = {
  PROPEDEUTICO: 'Propedêutica',
  DIVERSIFICADO: 'Diversificada',
  TECNICO: 'Técnica',
};

/** Semestres do curso que pertencem a um ano: 1º ano → 1º e 2º semestres, e assim por diante. */
export const semestresDoAno = (ano: number): [number, number] => [ano * 2 - 1, ano * 2];

/** Dados do formulário de disciplina (criação e edição). Campos de checkbox chegam como "on" ou vazio. */
export const DisciplinaSchema = z
  .object({
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
    nucleo: z.enum(NUCLEOS, { error: 'Escolha o núcleo da disciplina.' }),
    anoCurso: z.enum(['1', '2', '3'], { error: 'Escolha o ano do curso.' }).transform(Number),
    semestreCurso: z.preprocess(
      vazioParaUndefined,
      z.enum(['1', '2', '3', '4', '5', '6'], { error: 'Escolha um semestre de 1 a 6.' }).transform(Number).optional(),
    ),
  })
  // Técnicas são semestrais; propedêuticas e diversificadas são anuais.
  .superRefine((d, ctx) => {
    const erro = (message: string) => ctx.addIssue({ code: 'custom', path: ['semestreCurso'], message });
    if (d.nucleo === 'TECNICO') {
      const [s1, s2] = semestresDoAno(d.anoCurso);
      if (d.semestreCurso === undefined) erro('Disciplinas técnicas são semestrais: informe o semestre.');
      else if (d.semestreCurso !== s1 && d.semestreCurso !== s2) erro(`O ${d.anoCurso}º ano corresponde ao ${s1}º e ao ${s2}º semestres.`);
    } else if (d.semestreCurso !== undefined) {
      erro('Disciplinas propedêuticas e diversificadas são anuais: escolha "Anual".');
    }
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

/** Ex.: "1º ano · anual", "2º ano · 4º semestre"; "—" para cadastros antigos sem ano. */
export function descreverPeriodo(d: { anoCurso: number | null; semestreCurso: number | null }): string {
  if (!d.anoCurso) return '—';
  return `${d.anoCurso}º ano · ${d.semestreCurso ? `${d.semestreCurso}º semestre` : 'anual'}`;
}

/**
 * Disciplinas técnicas têm metade da carga horária teórica e metade prática (regra do curso).
 * Com carga ímpar, a hora restante fica na parte teórica. Retorna null para os demais núcleos.
 */
export function divisaoTeoricaPratica(nucleo: NucleoDisciplina | null, cargaHoraria: number): { teorica: number; pratica: number } | null {
  if (nucleo !== 'TECNICO') return null;
  const pratica = Math.floor(cargaHoraria / 2);
  return { teorica: cargaHoraria - pratica, pratica };
}
