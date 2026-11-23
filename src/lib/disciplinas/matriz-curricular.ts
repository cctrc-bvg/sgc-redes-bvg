import type { NucleoDisciplina } from '@prisma/client';

/**
 * Matriz curricular do Técnico Integrado em Redes de Computadores — Campus Boa Viagem
 * (PPC, seção 13 "Fluxograma curricular", pp. 34–35). Usada pelo seed para popular o catálogo.
 *
 * Regras do curso (confirmadas pela Coordenação):
 * - Disciplinas TÉCNICAS são SEMESTRAIS: a carga horária vem da coluna "Semestre" do PPC.
 *   Metade da carga é teórica e metade prática, então todas exigem prática (Art. 121).
 * - Disciplinas PROPEDÊUTICAS e DIVERSIFICADAS são ANUAIS: carga da coluna "Anual".
 *
 * Convenções da transcrição:
 * - Nomes com numeral romano do ANO do curso (Biologia I, II, III), como no SUAP/aSc TimeTables.
 * - Propedêuticas que se repetem recebem o código do PPC + ".<ano>" (BIO.1, BIO.2, BIO.3), pois o PPC
 *   usa o mesmo código nos três anos e o catálogo exige código único.
 * - Sem código no PPC: Ética, Empreendedorismo, Sociologia do 2º ano (seguiu o padrão SOC.<ano>)
 *   e Língua Espanhola.
 * - Técnicas do 3º ano ficam SEM código: no PPC repetem os códigos do 2º ano (R.C, C.E, S.O, SO.R).
 */

export interface DisciplinaMatriz {
  codigo: string | null;
  nome: string;
  cargaHoraria: number;
  nucleo: NucleoDisciplina;
  anoCurso: 1 | 2 | 3;
  /** Semestre do curso (1º a 6º) para as técnicas; null = anual. */
  semestreCurso: number | null;
  /** Dúvida a confirmar com a Coordenação sobre a transcrição do PPC. */
  pendencia?: string;
}

const prop = (anoCurso: 1 | 2 | 3, codigo: string | null, nome: string, cargaHoraria: number): DisciplinaMatriz => ({
  codigo,
  nome,
  cargaHoraria,
  nucleo: 'PROPEDEUTICO',
  anoCurso,
  semestreCurso: null,
});

const div = (anoCurso: 1 | 2 | 3, nome: string, cargaHoraria: number): DisciplinaMatriz => ({
  codigo: null,
  nome,
  cargaHoraria,
  nucleo: 'DIVERSIFICADO',
  anoCurso,
  semestreCurso: null,
});

const tec = (
  semestreCurso: number,
  codigo: string | null,
  nome: string,
  cargaHoraria: number,
  pendencia?: string,
): DisciplinaMatriz => ({
  codigo,
  nome,
  cargaHoraria,
  nucleo: 'TECNICO',
  anoCurso: Math.ceil(semestreCurso / 2) as 1 | 2 | 3,
  semestreCurso,
  ...(pendencia ? { pendencia } : {}),
});

export const MATRIZ_REDES: readonly DisciplinaMatriz[] = [
  // ── 1º ano (CH total no PPC: 920h) ──
  prop(1, 'BIO.1', 'Biologia I', 80),
  prop(1, 'FIS.1', 'Física I', 80),
  prop(1, 'MAT.1', 'Matemática I', 80),
  prop(1, 'QUI.1', 'Química I', 80),
  prop(1, 'ED.FIS.1', 'Educação Física I', 80),
  prop(1, 'LING.PORT.1', 'Língua Portuguesa e Redação I', 80),
  prop(1, 'L.I.1', 'Língua Inglesa I', 40),
  prop(1, 'FIL.1', 'Filosofia I', 40),
  prop(1, 'GEO.1', 'Geografia I', 40),
  div(1, 'Ética', 40),
  tec(1, 'I.A', 'Informática Aplicada', 40),
  tec(1, 'L.L.P', 'Lógica e Linguagem de Programação', 80),
  tec(2, 'M.M.C', 'Montagem e Manutenção de Computadores', 80),
  tec(2, 'C.D', 'Comunicação de Dados', 80),

  // ── 2º ano (CH total no PPC: 1.360h) ──
  prop(2, 'BIO.2', 'Biologia II', 80),
  prop(2, 'FIS.2', 'Física II', 80),
  prop(2, 'MAT.2', 'Matemática II', 80),
  prop(2, 'QUI.2', 'Química II', 80),
  prop(2, 'ED.FIS.2', 'Educação Física II', 80),
  prop(2, 'ART', 'Artes', 80),
  prop(2, 'SOC.2', 'Sociologia II', 80),
  prop(2, 'LING.PORT.2', 'Língua Portuguesa e Redação II', 80),
  prop(2, 'L.I.2', 'Língua Inglesa II', 80),
  prop(2, 'FIL.2', 'Filosofia II', 40),
  prop(2, 'HIS.2', 'História II', 80),
  prop(2, 'GEO.2', 'Geografia II', 40),
  div(2, 'Empreendedorismo', 80),
  tec(3, 'R.C', 'Redes de Computadores', 80),
  tec(3, 'C.E', 'Cabeamento Estruturado', 40),
  tec(3, 'S.O', 'Sistemas Operacionais', 80),
  tec(4, 'SO.R', 'SO de Redes', 80),
  tec(4, 'A.V.S', 'Automação via Script', 40),
  tec(4, 'SEV', 'Servidores', 80),

  // ── 3º ano (CH total no PPC: 960h — a soma das linhas dá 1.040h, ver pendências) ──
  prop(3, 'BIO.3', 'Biologia III', 80),
  prop(3, 'FIS.3', 'Física III', 80),
  prop(3, 'MAT.3', 'Matemática III', 80),
  prop(3, 'QUI.3', 'Química III', 80),
  prop(3, 'ED.FIS.3', 'Educação Física III', 80),
  prop(3, 'SOC.3', 'Sociologia III', 80),
  prop(3, 'LING.PORT.3', 'Língua Portuguesa e Redação III', 80),
  prop(3, 'HIS.3', 'História III', 80),
  prop(3, 'GEO.3', 'Geografia III', 40),
  div(3, 'Língua Espanhola', 80),
  tec(5, null, 'Segurança de Redes', 80, 'No PPC aparece com o código R.C, o mesmo de Redes de Computadores (2º ano).'),
  tec(5, null, 'Eletricidade Básica', 80, 'Coluna "Anual" do PPC diz 40h; usada a "Semestre" (80h). Código C.E repetido.'),
  tec(6, null, 'Projeto de Redes', 40, 'Coluna "Anual" do PPC diz 80h e a grade 2026 tem 4 aulas/semana; usada a "Semestre" (40h). Código S.O repetido.'),
  tec(6, null, 'Redes sem Fio', 80, 'Coluna "Anual" em branco no PPC (fica fora do total de 960h). Código SO.R repetido.'),
];
