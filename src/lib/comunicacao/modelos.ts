import type { CanalWhatsapp } from '@prisma/client';
import * as z from 'zod';

/**
 * Textos-padrão por tipo de interação. Ficam no banco (ModeloMensagem), editáveis em Comunicação ›
 * Textos-padrão; a lista abaixo é o conjunto inicial (gravado quando a tabela está vazia). Quem envia escolhe um modelo na caixa da mensagem (ou na mensagem
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
  /** Grupos/setores sugeridos como destinatários na mensagem avulsa. */
  destinos: CanalWhatsapp[];
}

/** Destinatários sugeridos por tipo (os individuais ficam vazios: escolhe-se a pessoa). */
export const DESTINOS_SUGERIDOS: Record<TipoInteracao, CanalWhatsapp[]> = {
  convite_grupo: ['GRUPO_PROFESSORES'],
  convite_individual: [],
  substituicao: [],
  adiantamento: [],
  aviso_turma: ['LIDERES_TURMA'],
  alimentacao: ['ASSISTENCIA_ESTUDANTIL', 'NUTRICIONISTA'],
  ctp: ['CTP'],
  gestao: ['GRUPO_GESTAO_DIR_COORD'],
  docente_ausente: [],
  lembrete_diario: [],
  reuniao: ['GRUPO_PROFESSORES'],
  comunicado: ['GRUPO_PROFESSORES'],
  ppi: [],
  ppe: [],
  processo: ['GRUPO_GESTAO_DIR_COORD'],
};

const m = (tipo: TipoInteracao, id: string, rotulo: string, assunto: string, linhas: string[], destinos = DESTINOS_SUGERIDOS[tipo]): ModeloTexto => ({
  id: `${tipo}:${id}`,
  tipo,
  rotulo,
  assunto: `[SGC-Redes] ${assunto}`,
  texto: linhas.join('\n'),
  destinos: [...destinos],
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
  ], ['LIDERES_TURMA']),

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

export const modelosDoTipo = (tipo: TipoInteracao, lista: readonly ModeloTexto[] = MODELOS_TEXTO) => lista.filter((x) => x.tipo === tipo);
export const modeloPorId = (id: string, lista: readonly ModeloTexto[] = MODELOS_TEXTO) => lista.find((x) => x.id === id);

export const lerTipoInteracao = (v: unknown): TipoInteracao | null =>
  (TIPOS_INTERACAO as readonly string[]).includes(String(v)) ? (String(v) as TipoInteracao) : null;

/** Campos que o sistema preenche sozinho na mensagem avulsa (por destinatário ou a partir da data). */
export const CAMPOS_AUTOMATICOS = ['nome', 'destinatarios', 'dia', 'link'] as const;

export type TipoCampo = 'turma' | 'disciplina' | 'data' | 'hora' | 'horarios' | 'texto';

/** Controle de tela para cada campo: lista de turmas/disciplinas cadastradas, data, hora ou texto livre. */
export function tipoDoCampo(nome: string): TipoCampo {
  const n = nome.trim().toLowerCase();
  if (n === 'turma' || n === 'codigo da turma' || n === 'código da turma') return 'turma';
  if (n === 'disciplina') return 'disciplina';
  if (n === 'horarios' || n === 'horários') return 'horarios';
  if (/^data\b/.test(n)) return 'data';
  if (/^(horário|horario|hora)\b/.test(n)) return 'hora';
  return 'texto';
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/** Valor digitado no controle → texto da mensagem (datas em dd/mm/aaaa, horas em 14h30). */
export function formatarValorDoCampo(tipo: TipoCampo, bruto: string): string {
  const v = bruto.trim();
  if (tipo === 'data') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
  }
  if (tipo === 'hora') {
    const m = /^(\d{2}):(\d{2})$/.exec(v);
    return m ? (m[2] === '00' ? `${Number(m[1])}h` : `${Number(m[1])}h${m[2]}`) : v;
  }
  return v;
}

/** Dia da semana de uma data "aaaa-mm-dd" (para o campo {{dia}}). */
export function diaDaSemana(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : DIAS[d.getUTCDay()];
}

/**
 * Valores dos campos preenchidos na tela, já formatados. O {{dia}} sai da primeira data
 * preenchida quando não foi informado.
 */
export function valoresDosCampos(brutos: Readonly<Record<string, string>>): Record<string, string> {
  const valores: Record<string, string> = {};
  let primeiraData: string | null = null;
  for (const [nome, bruto] of Object.entries(brutos)) {
    if (!bruto.trim()) continue;
    const tipo = tipoDoCampo(nome);
    if (tipo === 'data' && !primeiraData) primeiraData = bruto;
    valores[nome] = formatarValorDoCampo(tipo, bruto);
  }
  if (!valores.dia && primeiraData) {
    const dia = diaDaSemana(primeiraData);
    if (dia) valores.dia = dia;
  }
  return valores;
}

const CANAIS = ['GRUPO_PROFESSORES', 'GRUPO_GESTAO_DIR_COORD', 'ASSISTENCIA_ESTUDANTIL', 'CTP', 'LIDERES_TURMA', 'NUTRICIONISTA'] as const;

/** Formulário de texto-padrão (criar e editar). */
export const ModeloSchema = z
  .object({
    tipo: z.enum(TIPOS_INTERACAO, { error: 'Escolha o tipo de interação.' }),
    rotulo: z.string().trim().min(3, { error: 'Use de 3 a 60 caracteres.' }).max(60, { error: 'Use de 3 a 60 caracteres.' }),
    assunto: z.string().trim().min(3, { error: 'Use de 3 a 150 caracteres.' }).max(150, { error: 'Use de 3 a 150 caracteres.' }),
    texto: z.string().trim().min(3, { error: 'Use de 3 a 4.000 caracteres.' }).max(4000, { error: 'Use de 3 a 4.000 caracteres.' }),
    destinos: z.array(z.enum(CANAIS)).max(CANAIS.length),
  })
  .superRefine((v, ctx) => {
    for (const campo of ['assunto', 'texto'] as const) {
      const sobra = v[campo].replace(/\{\{[^{}\n]{1,60}\}\}/g, '');
      if (/\{\{|\}\}/.test(sobra)) ctx.addIssue({ code: 'custom', path: [campo], message: 'Feche cada campo com {{ e }} (ex.: {{data}}), com até 60 caracteres.' });
    }
  });
