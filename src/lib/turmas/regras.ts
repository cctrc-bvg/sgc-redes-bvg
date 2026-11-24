import * as z from 'zod';

/** Limite de estudantes por turma aceito no cadastro (folga sobre as turmas reais, de ~40). */
export const ALUNOS_MAXIMO = 80;

const quantidade = (rotulo: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `Informe ${rotulo}.` })
    .regex(/^\d+$/, { error: 'Informe só o número, sem letras ou pontos (ex.: 32).' })
    .transform(Number)
    .pipe(z.number().int().max(ALUNOS_MAXIMO, { error: `Use no máximo ${ALUNOS_MAXIMO}.` }));

/** Campos de quantidade de refeição, na ordem do dia. */
export const CAMPOS_REFEICAO = ['qtdMediaLancheManha', 'qtdMediaAlmoco', 'qtdMediaLancheTarde'] as const;

export const NOME_REFEICAO: Record<(typeof CAMPOS_REFEICAO)[number], string> = {
  qtdMediaLancheManha: 'Lanche da manhã',
  qtdMediaAlmoco: 'Almoço',
  qtdMediaLancheTarde: 'Lanche da tarde',
};

/** Dados do formulário de turma (criação e edição). */
export const TurmaSchema = z
  .object({
    // Código curto usado nas mensagens à Assistência Estudantil (ex.: "REDES-2"). Guardado em maiúsculas.
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9.\-]{1,19}$/, { error: 'Use de 2 a 20 caracteres: letras, números, ponto ou hífen (ex.: REDES-1).' }),
    nome: z
      .string()
      .trim()
      .min(3, { error: 'Informe o nome da turma.' })
      .max(80, { error: 'Use no máximo 80 caracteres.' }),
    anoCurso: z.enum(['1', '2', '3'], { error: 'Escolha o ano do curso.' }).transform(Number),
    qtdAlunosAtivos: quantidade('a quantidade de estudantes ativos'),
    qtdMediaLancheManha: quantidade('a média do lanche da manhã'),
    qtdMediaAlmoco: quantidade('a média do almoço'),
    qtdMediaLancheTarde: quantidade('a média do lanche da tarde'),
  })
  // A média de quem come não pode passar do número de estudantes da turma.
  .superRefine((d, ctx) => {
    for (const campo of CAMPOS_REFEICAO) {
      if (d[campo] > d.qtdAlunosAtivos) {
        ctx.addIssue({
          code: 'custom',
          path: [campo],
          message: `A média não pode passar dos ${d.qtdAlunosAtivos} estudantes ativos.`,
        });
      }
    }
  });

export type DadosTurma = z.infer<typeof TurmaSchema>;

/** Registros que prendem a turma ao histórico (ofertas, grade, ausências, avisos de refeição). */
export type UsoTurma = { ofertas: number; gradeHoraria: number; ausencias: number; alertasRefeicao: number };

/**
 * Uma turma só pode ser excluída se nunca foi usada.
 * Retorna a mensagem de bloqueio, ou null se a exclusão é permitida.
 */
export function verificarExclusaoTurma(uso: UsoTurma): string | null {
  const partes = [
    uso.ofertas > 0 && `${uso.ofertas} oferta(s)`,
    uso.gradeHoraria > 0 && `${uso.gradeHoraria} horário(s) na grade`,
    uso.ausencias > 0 && `${uso.ausencias} ausência(s) registrada(s)`,
    uso.alertasRefeicao > 0 && `${uso.alertasRefeicao} aviso(s) de refeição`,
  ].filter(Boolean);
  if (partes.length === 0) return null;
  return `Esta turma já tem ${partes.join(', ')} e não pode ser excluída. Desative-a para tirá-la das listas sem perder o histórico.`;
}

/**
 * O ano do curso decide quais disciplinas a turma recebe. Com ofertas já lançadas, trocar o ano
 * deixaria disciplinas de outro ano penduradas na turma: retorna a mensagem de bloqueio, ou null.
 */
export function verificarTrocaAnoCurso(anoAtual: number | null, anoNovo: number, ofertas: number): string | null {
  if (anoAtual === null || anoAtual === anoNovo || ofertas === 0) return null;
  return `A turma já tem ${ofertas} oferta(s) de disciplinas do ${anoAtual}º ano. Remova-as em Ofertas antes de mudar o ano do curso, ou cadastre uma nova turma.`;
}
