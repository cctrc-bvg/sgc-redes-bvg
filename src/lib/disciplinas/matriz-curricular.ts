/**
 * Matriz curricular do Técnico Integrado em Redes de Computadores — Campus Boa Viagem
 * (PPC, seção 13 "Fluxograma curricular", pp. 34–35). Usada pelo seed para popular o catálogo.
 *
 * Convenções adotadas na transcrição:
 * - Nomes com numeral romano do ANO do curso (Biologia I, II, III), como no SUAP/aSc TimeTables.
 * - Disciplinas propedêuticas que se repetem recebem o código do PPC + ".<ano>" (BIO.1, BIO.2, BIO.3),
 *   pois o código no PPC é o mesmo nos três anos e o catálogo exige código único.
 * - Disciplinas sem código no PPC (Ética, Empreendedorismo, Sociologia do 2º ano, Língua Espanhola)
 *   ficam sem código; a Sociologia segue o padrão SOC.<ano> usado no 3º ano.
 * - As técnicas do 3º ano ficam SEM código: no PPC elas repetem os códigos do 2º ano
 *   (R.C, C.E, S.O, SO.R), o que parece erro de cópia. Ver `pendencia`.
 * - `exigePratica` começa falso para todas: o PPC não informa; a Coordenação marca no sistema (Art. 121).
 */

export interface DisciplinaMatriz {
  codigo: string | null;
  nome: string;
  cargaHoraria: number;
  /** Ano do curso (1º, 2º, 3º). Informativo: não é gravado no banco. */
  ano: 1 | 2 | 3;
  /** Semestre do curso (1º a 6º) para as técnicas semestrais; null = anual. Informativo. */
  semestre: number | null;
  /** Dúvida a confirmar com a Coordenação sobre a transcrição do PPC. */
  pendencia?: string;
}

const anual = (ano: 1 | 2 | 3, codigo: string | null, nome: string, cargaHoraria: number): DisciplinaMatriz => ({
  codigo,
  nome,
  cargaHoraria,
  ano,
  semestre: null,
});

export const MATRIZ_REDES: readonly DisciplinaMatriz[] = [
  // ── 1º ano (CH total no PPC: 920h) ──
  anual(1, 'BIO.1', 'Biologia I', 80),
  anual(1, 'FIS.1', 'Física I', 80),
  anual(1, 'MAT.1', 'Matemática I', 80),
  anual(1, 'QUI.1', 'Química I', 80),
  anual(1, 'ED.FIS.1', 'Educação Física I', 80),
  anual(1, 'LING.PORT.1', 'Língua Portuguesa e Redação I', 80),
  anual(1, 'L.I.1', 'Língua Inglesa I', 40),
  anual(1, 'FIL.1', 'Filosofia I', 40),
  anual(1, 'GEO.1', 'Geografia I', 40),
  anual(1, null, 'Ética', 40),
  { codigo: 'I.A', nome: 'Informática Aplicada', cargaHoraria: 40, ano: 1, semestre: 1 },
  { codigo: 'L.L.P', nome: 'Lógica e Linguagem de Programação', cargaHoraria: 80, ano: 1, semestre: 1 },
  { codigo: 'M.M.C', nome: 'Montagem e Manutenção de Computadores', cargaHoraria: 80, ano: 1, semestre: 2 },
  { codigo: 'C.D', nome: 'Comunicação de Dados', cargaHoraria: 80, ano: 1, semestre: 2 },

  // ── 2º ano (CH total no PPC: 1.360h) ──
  anual(2, 'BIO.2', 'Biologia II', 80),
  anual(2, 'FIS.2', 'Física II', 80),
  anual(2, 'MAT.2', 'Matemática II', 80),
  anual(2, 'QUI.2', 'Química II', 80),
  anual(2, 'ED.FIS.2', 'Educação Física II', 80),
  anual(2, 'ART', 'Artes', 80),
  anual(2, 'SOC.2', 'Sociologia II', 80),
  anual(2, 'LING.PORT.2', 'Língua Portuguesa e Redação II', 80),
  anual(2, 'L.I.2', 'Língua Inglesa II', 80),
  anual(2, 'FIL.2', 'Filosofia II', 40),
  anual(2, 'HIS.2', 'História II', 80),
  anual(2, 'GEO.2', 'Geografia II', 40),
  anual(2, null, 'Empreendedorismo', 80),
  { codigo: 'R.C', nome: 'Redes de Computadores', cargaHoraria: 80, ano: 2, semestre: 3 },
  { codigo: 'C.E', nome: 'Cabeamento Estruturado', cargaHoraria: 40, ano: 2, semestre: 3 },
  { codigo: 'S.O', nome: 'Sistemas Operacionais', cargaHoraria: 80, ano: 2, semestre: 3 },
  { codigo: 'SO.R', nome: 'SO de Redes', cargaHoraria: 80, ano: 2, semestre: 4 },
  { codigo: 'A.V.S', nome: 'Automação via Script', cargaHoraria: 40, ano: 2, semestre: 4 },
  { codigo: 'SEV', nome: 'Servidores', cargaHoraria: 80, ano: 2, semestre: 4 },

  // ── 3º ano (CH total no PPC: 960h — não fecha com as linhas, ver pendências) ──
  anual(3, 'BIO.3', 'Biologia III', 80),
  anual(3, 'FIS.3', 'Física III', 80),
  anual(3, 'MAT.3', 'Matemática III', 80),
  anual(3, 'QUI.3', 'Química III', 80),
  anual(3, 'ED.FIS.3', 'Educação Física III', 80),
  anual(3, 'SOC.3', 'Sociologia III', 80),
  anual(3, 'LING.PORT.3', 'Língua Portuguesa e Redação III', 80),
  anual(3, 'HIS.3', 'História III', 80),
  anual(3, 'GEO.3', 'Geografia III', 40),
  anual(3, null, 'Língua Espanhola', 80),
  {
    codigo: null,
    nome: 'Segurança de Redes',
    cargaHoraria: 80,
    ano: 3,
    semestre: 5,
    pendencia: 'No PPC aparece com o código R.C, o mesmo de Redes de Computadores (2º ano).',
  },
  {
    codigo: null,
    nome: 'Eletricidade Básica',
    cargaHoraria: 40,
    ano: 3,
    semestre: 5,
    pendencia: 'PPC informa 80h no semestre e 40h no anual; usado 40h (anual). Código C.E repetido.',
  },
  {
    codigo: null,
    nome: 'Projeto de Redes',
    cargaHoraria: 80,
    ano: 3,
    semestre: 6,
    pendencia: 'PPC informa 40h no semestre e 80h no anual; usado 80h (a grade tem 4 aulas/semana). Código S.O repetido.',
  },
  {
    codigo: null,
    nome: 'Redes sem Fio',
    cargaHoraria: 80,
    ano: 3,
    semestre: 6,
    pendencia: 'PPC informa 80h no semestre e deixa o anual em branco (fora do total de 960h). Código SO.R repetido.',
  },
];
