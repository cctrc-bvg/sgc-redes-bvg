import type { Prisma } from '@prisma/client';

/**
 * Tabela de pontuação da Prática Profissional Integrada (PPI) — Manual 2022.
 * 6 grupos / 32 categorias. Usada pelo seed e pelos testes de conformidade com o FSD (RF07).
 */
export const REGRAS_PPI_2022 = [
  // GRUPO I - Atividades de ensino
  { grupo: 1, nomeGrupo: 'GRUPO I - Atividades de ensino', descricao: 'Participação em grupo de estudo ou grupo de pesquisa registrado na instituição', ponderacaoTexto: '2 horas por semestre', horasPorUnidade: 2, unidade: 'semestre', qtdMaxima: 6, pontuacaoMaxima: 8 },
  { grupo: 1, nomeGrupo: 'GRUPO I - Atividades de ensino', descricao: 'Participação em visitas técnicas promovidas pelo IFCE', ponderacaoTexto: 'Até 08 horas por visita', horasPorUnidade: 8, unidade: 'visita', qtdMaxima: 4, pontuacaoMaxima: 8 },
  { grupo: 1, nomeGrupo: 'GRUPO I - Atividades de ensino', descricao: 'Participação em olimpíadas, campeonatos e atividades acadêmicas (OBMEP, OBFEP, OBR, OCHE etc)', ponderacaoTexto: '02 horas por participação', horasPorUnidade: 2, unidade: 'participacao', qtdMaxima: 6, pontuacaoMaxima: 8 },
  { grupo: 1, nomeGrupo: 'GRUPO I - Atividades de ensino', descricao: 'Participação de Monitoria voluntária ou remunerada', ponderacaoTexto: '06 horas por monitoria', horasPorUnidade: 6, unidade: 'monitoria', qtdMaxima: 1, pontuacaoMaxima: 6 },
  { grupo: 1, nomeGrupo: 'GRUPO I - Atividades de ensino', descricao: 'Participação em projetos curriculares e extracurriculares integrados ou relacionados às disciplinas do eixo profissional', ponderacaoTexto: '05 horas por projeto', horasPorUnidade: 5, unidade: 'projeto', qtdMaxima: 4, pontuacaoMaxima: 8 },

  // GRUPO II - Pesquisa, inovação e extensão
  { grupo: 2, nomeGrupo: 'GRUPO II - Pesquisa, inovação e extensão', descricao: 'Bolsista de pesquisa (PRPI ou fomento), remunerado ou voluntário', ponderacaoTexto: '12 horas por projeto', horasPorUnidade: 12, unidade: 'projeto', qtdMaxima: 2, pontuacaoMaxima: 12 },
  { grupo: 2, nomeGrupo: 'GRUPO II - Pesquisa, inovação e extensão', descricao: 'Participação em congressos e seminários técnico-científicos', ponderacaoTexto: '4 horas por evento', horasPorUnidade: 4, unidade: 'evento', qtdMaxima: 3, pontuacaoMaxima: 12 },
  { grupo: 2, nomeGrupo: 'GRUPO II - Pesquisa, inovação e extensão', descricao: 'Publicações em revistas técnicas / encontros IC (Qualis, ISBN ou ISSN)', ponderacaoTexto: '4 horas por publicação', horasPorUnidade: 4, unidade: 'publicacao', qtdMaxima: 3, pontuacaoMaxima: 12 },
  { grupo: 2, nomeGrupo: 'GRUPO II - Pesquisa, inovação e extensão', descricao: 'Artigos científicos como autor principal (Qualis, ISBN ou ISSN)', ponderacaoTexto: '04 horas por publicação', horasPorUnidade: 4, unidade: 'publicacao', qtdMaxima: 3, pontuacaoMaxima: 12 },
  { grupo: 2, nomeGrupo: 'GRUPO II - Pesquisa, inovação e extensão', descricao: 'Artigos científicos com coautoria (Qualis, ISBN ou ISSN)', ponderacaoTexto: '04 horas por publicação', horasPorUnidade: 4, unidade: 'publicacao', qtdMaxima: 3, pontuacaoMaxima: 12 },
  { grupo: 2, nomeGrupo: 'GRUPO II - Pesquisa, inovação e extensão', descricao: 'Outras atividades acadêmicas, científicas ou tecnológicas (a critério Coord/CTP/DE)', ponderacaoTexto: 'Até 04 horas por atividade', horasPorUnidade: 4, unidade: 'atividade', qtdMaxima: 2, pontuacaoMaxima: 8 },
  { grupo: 2, nomeGrupo: 'GRUPO II - Pesquisa, inovação e extensão', descricao: 'Outras atividades de complementação social, esportiva, cultural e humana', ponderacaoTexto: 'Até 04 horas por atividade', horasPorUnidade: 4, unidade: 'atividade', qtdMaxima: 2, pontuacaoMaxima: 8 },
  { grupo: 2, nomeGrupo: 'GRUPO II - Pesquisa, inovação e extensão', descricao: 'Bolsista de extensão (SigProExt, etc.), remunerado ou voluntário', ponderacaoTexto: '04 horas por mês', horasPorUnidade: 4, unidade: 'mes', qtdMaxima: 3, pontuacaoMaxima: 12 },
  { grupo: 2, nomeGrupo: 'GRUPO II - Pesquisa, inovação e extensão', descricao: 'Participação em curso de extensão na área profissional do curso', ponderacaoTexto: '08 horas por curso', horasPorUnidade: 8, unidade: 'curso', qtdMaxima: 1, pontuacaoMaxima: 8 },
  { grupo: 2, nomeGrupo: 'GRUPO II - Pesquisa, inovação e extensão', descricao: 'Participação como instrutor em palestras técnicas, cursos e minicursos da área', ponderacaoTexto: '01 hora por hora-aula', horasPorUnidade: 1, unidade: 'hora-aula', qtdMaxima: 12, pontuacaoMaxima: 12 },

  // GRUPO III - Experiência profissional e estágio
  { grupo: 3, nomeGrupo: 'GRUPO III - Experiência profissional e estágio', descricao: 'Estágio (>= 160h) fora do IFCE (Lei nº 11.788/2008)', ponderacaoTexto: '36 horas por estágio', horasPorUnidade: 36, unidade: 'estagio', qtdMaxima: 1, pontuacaoMaxima: 36 },
  { grupo: 3, nomeGrupo: 'GRUPO III - Experiência profissional e estágio', descricao: 'Promoção de atividades nos laboratórios visando vivência prática profissional', ponderacaoTexto: '2 horas por atividade', horasPorUnidade: 2, unidade: 'atividade', qtdMaxima: 6, pontuacaoMaxima: 12 },
  { grupo: 3, nomeGrupo: 'GRUPO III - Experiência profissional e estágio', descricao: 'Exercício profissional correlato ao curso (empregado, jovem aprendiz, sócio, autônomo)', ponderacaoTexto: '36 horas por atividade', horasPorUnidade: 36, unidade: 'atividade', qtdMaxima: 6, pontuacaoMaxima: 36 },
  { grupo: 3, nomeGrupo: 'GRUPO III - Experiência profissional e estágio', descricao: 'Outra atividade de vivência profissional relacionada à área do curso', ponderacaoTexto: '04 horas por atividade', horasPorUnidade: 4, unidade: 'atividade', qtdMaxima: 3, pontuacaoMaxima: 12 },
  { grupo: 3, nomeGrupo: 'GRUPO III - Experiência profissional e estágio', descricao: 'Estágio (>= 160h) em laboratórios/instalações do IFCE (Lei nº 11.788/2008)', ponderacaoTexto: '36 horas por estágio', horasPorUnidade: 36, unidade: 'estagio', qtdMaxima: 1, pontuacaoMaxima: 36 },

  // GRUPO IV - Cursos e eventos na área
  { grupo: 4, nomeGrupo: 'GRUPO IV - Cursos e eventos relacionados à área', descricao: 'Participação em cursos e/ou oficinas da área profissional do curso', ponderacaoTexto: '4 horas por participação', horasPorUnidade: 4, unidade: 'participacao', qtdMaxima: 2, pontuacaoMaxima: 8 },
  { grupo: 4, nomeGrupo: 'GRUPO IV - Cursos e eventos relacionados à área', descricao: 'Participação em palestras na área profissional do curso', ponderacaoTexto: '4 horas por participação', horasPorUnidade: 4, unidade: 'participacao', qtdMaxima: 2, pontuacaoMaxima: 8 },
  { grupo: 4, nomeGrupo: 'GRUPO IV - Cursos e eventos relacionados à área', descricao: 'Expositor/apresentador de trabalho em evento na área do curso', ponderacaoTexto: '4 horas por apresentação', horasPorUnidade: 4, unidade: 'apresentacao', qtdMaxima: 3, pontuacaoMaxima: 12 },
  { grupo: 4, nomeGrupo: 'GRUPO IV - Cursos e eventos relacionados à área', descricao: 'Congressos, semanas científicas, seminários e workshops na área no âmbito do IFCE', ponderacaoTexto: '4 horas por participação', horasPorUnidade: 4, unidade: 'participacao', qtdMaxima: 2, pontuacaoMaxima: 8 },
  { grupo: 4, nomeGrupo: 'GRUPO IV - Cursos e eventos relacionados à área', descricao: 'Colaboração na organização de eventos técnico-científicos, extensão, artísticos/culturais no IFCE', ponderacaoTexto: '4 horas por participação', horasPorUnidade: 4, unidade: 'participacao', qtdMaxima: 2, pontuacaoMaxima: 8 },

  // GRUPO V - Outras atividades de cunho técnico
  { grupo: 5, nomeGrupo: 'GRUPO V - Outras atividades de cunho técnico', descricao: 'Construção de simuladores', ponderacaoTexto: '12 horas por construção', horasPorUnidade: 12, unidade: 'construcao', qtdMaxima: 1, pontuacaoMaxima: 12 },
  { grupo: 5, nomeGrupo: 'GRUPO V - Outras atividades de cunho técnico', descricao: 'Participação em depósito de propriedade intelectual na área de formação', ponderacaoTexto: '8 horas por participação', horasPorUnidade: 8, unidade: 'participacao', qtdMaxima: 1, pontuacaoMaxima: 8 },
  { grupo: 5, nomeGrupo: 'GRUPO V - Outras atividades de cunho técnico', descricao: 'Atividade de observação assistida na formação profissional no IFCE', ponderacaoTexto: '2 horas por atividade', horasPorUnidade: 2, unidade: 'atividade', qtdMaxima: 2, pontuacaoMaxima: 4 },
  { grupo: 5, nomeGrupo: 'GRUPO V - Outras atividades de cunho técnico', descricao: 'Participação em projetos interdisciplinares na área do curso', ponderacaoTexto: '4 horas por participação', horasPorUnidade: 4, unidade: 'participacao', qtdMaxima: 3, pontuacaoMaxima: 12 },
  { grupo: 5, nomeGrupo: 'GRUPO V - Outras atividades de cunho técnico', descricao: 'Elaboração de relatório técnico', ponderacaoTexto: '4 horas por relatório', horasPorUnidade: 4, unidade: 'relatorio', qtdMaxima: 2, pontuacaoMaxima: 8 },
  { grupo: 5, nomeGrupo: 'GRUPO V - Outras atividades de cunho técnico', descricao: 'Outra atividade de cunho técnico relacionada à área do curso', ponderacaoTexto: '2 horas por atividade', horasPorUnidade: 2, unidade: 'atividade', qtdMaxima: 2, pontuacaoMaxima: 4 },

  // GRUPO VI - Múltiplas linguagens
  { grupo: 6, nomeGrupo: 'GRUPO VI - Múltiplas linguagens', descricao: 'Peça teatral, peça publicitária, blog, artefato cultural digital ou impresso na área', ponderacaoTexto: '02 horas por participação', horasPorUnidade: 2, unidade: 'atividade', qtdMaxima: 2, pontuacaoMaxima: 4 },
] satisfies Prisma.PpiRegraCategoriaCreateManyInput[];
