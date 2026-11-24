/**
 * Textos-padrão por tipo de interação. Quem envia escolhe um modelo na caixa da mensagem (ou na mensagem
 * avulsa) e o sistema preenche as variáveis `{{...}}` que conhece; as que faltarem ficam como campos a
 * preencher. Sem dados sensíveis: nada de motivo pessoal, saúde ou dados de estudantes.
 */

export const TIPOS_INTERACAO = [
  'convite_grupo',
  'convite_individual',
  'substituicao',
  'adiantamento',
  'aviso_turma',
  'alimentacao',
  'ctp',
  'gestao',
  'docente_ausente',
  'lembrete_diario',
  'reuniao',
  'comunicado',
  'ppi',
  'ppe',
  'processo',
] as const;
export type TipoInteracao = (typeof TIPOS_INTERACAO)[number];

export const NOME_TIPO_INTERACAO: Record<TipoInteracao, string> = {
  convite_grupo: 'Convite de substituição (grupo de professores)',
  convite_individual: 'Convite de substituição (docente)',
  substituicao: 'Substituição confirmada (docente)',
  adiantamento: 'Aula adiantada (docente)',
  aviso_turma: 'Aviso à turma (líderes ou grupo da turma)',
  alimentacao: 'Replanejamento alimentar (CAE e nutricionista)',
  ctp: 'Turma dispensada (CTP)',
  gestao: 'Informe à Gestão',
  docente_ausente: 'Cobertura das aulas (docente ausente)',
  lembrete_diario: 'Lembrete de diário (docente)',
  reuniao: 'Convocação de reunião',
  comunicado: 'Comunicado geral',
  ppi: 'PPI (Prática Profissional Integrada)',
  ppe: 'PPE / PEI',
  processo: 'Processo SEI',
};

/** Variáveis que o sistema sabe preencher (as demais viram campos a preencher). */
export const VARIAVEIS = {
  nome: 'primeiro nome do destinatário (mensagem individual)',
  destinatarios: 'saudação do grupo ou setor',
  turma: 'nome da turma',
  'codigo da turma': 'código da turma (ex.: REDES-1)',
  data: 'data (dd/mm/aaaa)',
  dia: 'dia da semana',
  disciplina: 'disciplina',
  horarios: 'lista de horários',
  refeicoes: 'lista de refeições com quantidade',
  situacao: 'situação da ausência',
  reposicao: 'situação da reposição',
  link: 'endereço do SGC-Redes (Minha grade)',
} as const;

export interface ModeloTexto {
  id: string;
  tipo: TipoInteracao;
  rotulo: string;
  assunto: string;
  texto: string;
}

const m = (tipo: TipoInteracao, id: string, rotulo: string, assunto: string, linhas: string[]): ModeloTexto => ({
  id: `${tipo}:${id}`,
  tipo,
  rotulo,
  assunto: `[SGC-Redes] ${assunto}`,
  texto: linhas.join('\n'),
});

export const MODELOS_TEXTO: readonly ModeloTexto[] = [
  m('convite_grupo', 'formal', 'Formal (e-mail)', 'Convite de substituição — {{codigo da turma}} — {{data}}', [
    'Prezados(as) professores(as),',
    '',
    'A Coordenação do Curso Técnico em Redes de Computadores precisa de apoio para cobrir aulas da turma {{turma}} em {{data}} ({{dia}}), disciplina {{disciplina}}:',
    '{{horarios}}',
    '',
    'Quem puder assumir um dos horários, ou adiantar uma aula própria da turma, por favor responda a esta mensagem.',
    '',
    'Atenciosamente,',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),
  m('convite_grupo', 'curto', 'Curto (WhatsApp)', 'Convite de substituição — {{codigo da turma}} — {{data}}', [
    '*Substituição — {{codigo da turma}}, {{data}} ({{dia}})*',
    '{{horarios}}',
    'Alguém pode assumir ou adiantar aula? Responda aqui, por favor. 🙏',
  ]),

  m('convite_individual', 'formal', 'Formal (e-mail)', 'Convite de substituição — {{codigo da turma}} — {{data}}', [
    'Prezado(a) {{nome}},',
    '',
    'A Coordenação convida você para substituir na turma {{turma}} em {{data}} ({{dia}}):',
    '{{horarios}}',
    '',
    'Você pode aceitar ou recusar no SGC-Redes, em Minha grade: {{link}}',
    'Se preferir, responda a esta mensagem.',
    '',
    'Atenciosamente,',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),
  m('convite_individual', 'curto', 'Curto (WhatsApp)', 'Convite de substituição — {{codigo da turma}} — {{data}}', [
    'Oi, {{nome}}! Você poderia substituir na {{codigo da turma}} em {{data}} ({{dia}})?',
    '{{horarios}}',
    'Dá para aceitar ou recusar em Minha grade: {{link}}',
  ]),

  m('substituicao', 'formal', 'Formal (e-mail)', 'Substituição confirmada — {{codigo da turma}} — {{data}}', [
    'Prezado(a) {{nome}},',
    '',
    'Confirmamos sua substituição na turma {{turma}} em {{data}} ({{dia}}):',
    '{{horarios}}',
    '',
    'Os detalhes estão no SGC-Redes, em Minha grade: {{link}}',
    'Obrigado(a) pela colaboração.',
    '',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),
  m('substituicao', 'curto', 'Curto (WhatsApp)', 'Substituição confirmada — {{codigo da turma}} — {{data}}', [
    'Oi, {{nome}}! Substituição confirmada na {{codigo da turma}} em {{data}}:',
    '{{horarios}}',
    'Obrigado(a)! 👍',
  ]),

  m('adiantamento', 'formal', 'Formal (e-mail)', 'Aula adiantada — {{codigo da turma}} — {{data}}', [
    'Prezado(a) {{nome}},',
    '',
    'Para cobrir um horário vago da turma {{turma}} em {{data}} ({{dia}}), sua aula foi adiantada:',
    '{{horarios}}',
    '',
    'O horário de origem fica vago. Detalhes em Minha grade: {{link}}',
    '',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),
  m('adiantamento', 'curto', 'Curto (WhatsApp)', 'Aula adiantada — {{codigo da turma}} — {{data}}', [
    'Oi, {{nome}}! Em {{data}}, na {{codigo da turma}}, sua aula foi adiantada:',
    '{{horarios}}',
  ]),

  m('aviso_turma', 'formal', 'Formal', 'Aviso à turma — {{codigo da turma}} — {{data}}', [
    'Olá, {{destinatarios}}!',
    '',
    'Mudanças no horário da turma {{codigo da turma}} em {{data}} ({{dia}}):',
    '{{horarios}}',
    '',
    'Por favor, repassem à turma. Dúvidas: Coordenação do Curso.',
  ]),
  m('aviso_turma', 'curto', 'Curto (WhatsApp)', 'Aviso à turma — {{codigo da turma}} — {{data}}', [
    '📢 *{{codigo da turma}} — {{data}} ({{dia}})*',
    '{{horarios}}',
    'Repassem à turma, por favor!',
  ]),

  m('alimentacao', 'formal', 'Formal (e-mail)', 'Replanejamento alimentar — {{codigo da turma}} — {{data}}', [
    'Prezados(as) {{destinatarios}},',
    '',
    'Informamos alteração nas refeições da turma {{codigo da turma}} em {{data}} ({{dia}}):',
    '{{refeicoes}}',
    '',
    'O aviso também está no painel de Alimentação do SGC-Redes, onde a ciência pode ser registrada.',
    '',
    'Atenciosamente,',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),
  m('alimentacao', 'urgente', 'Urgente (menos de 4h)', 'URGENTE: replanejamento alimentar — {{codigo da turma}} — {{data}}', [
    '*URGENTE — {{codigo da turma}}, {{data}}*',
    '{{refeicoes}}',
    'A Assistência Estudantil já foi avisada por telefone. Por favor, confirmem a ciência (no painel de Alimentação do SGC-Redes, se tiverem acesso).',
  ]),

  m('ctp', 'formal', 'Formal (e-mail)', 'Turma dispensada — {{codigo da turma}} — {{data}}', [
    'Prezada equipe da CTP,',
    '',
    'Informamos que a turma {{turma}} foi dispensada em {{data}} ({{dia}}), disciplina {{disciplina}}:',
    '{{horarios}}',
    '',
    '{{reposicao}}',
    '',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),

  m('gestao', 'formal', 'Formal (e-mail)', 'Informe à Gestão — {{codigo da turma}} — {{data}}', [
    'Prezados(as) {{destinatarios}},',
    '',
    'Informamos a situação das aulas da turma {{turma}} em {{data}} ({{dia}}), disciplina {{disciplina}}: {{situacao}}.',
    '{{horarios}}',
    '',
    'Atenciosamente,',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),
  m('gestao', 'curto', 'Curto (WhatsApp)', 'Informe à Gestão — {{codigo da turma}} — {{data}}', [
    '*Informe — {{codigo da turma}}, {{data}}*: {{situacao}}',
    '{{horarios}}',
  ]),

  m('docente_ausente', 'formal', 'Formal (e-mail)', 'Cobertura das suas aulas — {{codigo da turma}} — {{data}}', [
    'Prezado(a) {{nome}},',
    '',
    'Registramos a cobertura das suas aulas de {{disciplina}} na turma {{turma}} em {{data}} ({{dia}}):',
    '{{horarios}}',
    '',
    '{{reposicao}}',
    '',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),

  m('lembrete_diario', 'formal', 'Formal (e-mail)', 'Lembrete do diário — {{disciplina}} ({{codigo da turma}})', [
    'Prezado(a) {{nome}},',
    '',
    'Lembramos que o diário de {{disciplina}} ({{codigo da turma}}) precisa ser atualizado no sistema acadêmico.',
    'Quando puder, lance as aulas e frequências pendentes.',
    '',
    'Obrigado(a)!',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),
  m('lembrete_diario', 'curto', 'Curto (WhatsApp)', 'Lembrete do diário — {{disciplina}} ({{codigo da turma}})', [
    'Oi, {{nome}}! Lembrete gentil: o diário de {{disciplina}} ({{codigo da turma}}) está pendente no sistema acadêmico. Obrigado(a)! 📘',
  ]),

  m('reuniao', 'colegiado', 'Reunião do colegiado', 'Convocação: reunião do colegiado — {{data da reunião}}', [
    'Prezados(as) {{destinatarios}},',
    '',
    'Convocamos para reunião do colegiado do Curso Técnico em Redes de Computadores:',
    'Data: {{data da reunião}}',
    'Horário: {{horário}}',
    'Local: {{local}}',
    'Pauta: {{pauta}}',
    '',
    'Contamos com a presença de todos(as).',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),
  m('reuniao', 'pais', 'Reunião com pais e responsáveis', 'Reunião com pais e responsáveis — {{codigo da turma}}', [
    'Olá, {{destinatarios}}!',
    '',
    'Convidamos os pais e responsáveis da turma {{codigo da turma}} para reunião:',
    'Data: {{data da reunião}} · Horário: {{horário}} · Local: {{local}}',
    '',
    'Por favor, repassem o convite. Coordenação do Curso.',
  ]),

  m('comunicado', 'geral', 'Comunicado geral', '{{assunto do comunicado}}', [
    'Prezados(as) {{destinatarios}},',
    '',
    '{{texto do comunicado}}',
    '',
    'Atenciosamente,',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),
  m('comunicado', 'prazo', 'Lembrete de prazo', 'Lembrete de prazo: {{atividade}}', [
    'Olá, {{destinatarios}}!',
    '',
    'Lembramos que o prazo para {{atividade}} termina em {{data limite}}.',
    'Dúvidas: Coordenação do Curso.',
  ]),

  m('ppi', 'pendencia', 'Pendência de documentos', 'PPI — pendência de documentos', [
    'Olá, {{nome}}!',
    '',
    'Sua solicitação de PPI tem pendências: {{pendências}}.',
    'Entregue os documentos na Coordenação até {{data limite}}.',
  ]),
  m('ppi', 'deferida', 'Solicitação deferida', 'PPI deferida', [
    'Olá, {{nome}}!',
    '',
    'Sua solicitação de PPI foi deferida. A ficha está disponível na Coordenação para assinatura.',
  ]),

  m('ppe', 'definir', 'Definir modalidade da PPE', 'PPE — definir modalidade — {{disciplina}}', [
    'Prezado(a) {{nome}},',
    '',
    'Há estudante com PPE registrada em {{disciplina}} aguardando a definição da modalidade no SGC-Redes.',
    'Acesse PPE no sistema para definir e, se for o caso, preencher o PEI.',
    '',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),
  m('ppe', 'encontro', 'Encontro de PEI', 'PEI — encontro agendado', [
    'Olá, {{nome}}!',
    '',
    'Encontro do PEI agendado: {{data do encontro}}, {{horário}}, {{local}}.',
    'Se houver almoço ou lanche no contraturno, a Coordenação avisa a Assistência Estudantil.',
  ]),

  m('processo', 'andamento', 'Andamento de processo SEI', 'Processo SEI {{número do processo}} — andamento', [
    'Prezados(as) {{destinatarios}},',
    '',
    'Informamos que o processo SEI {{número do processo}} ({{assunto do processo}}) está em {{etapa}}.',
    'Próximo passo: {{próximo passo}}.',
    '',
    'Coordenação do Curso Técnico em Redes de Computadores',
  ]),
];

export const modelosDoTipo = (tipo: TipoInteracao) => MODELOS_TEXTO.filter((x) => x.tipo === tipo);
export const modeloPorId = (id: string) => MODELOS_TEXTO.find((x) => x.id === id);
