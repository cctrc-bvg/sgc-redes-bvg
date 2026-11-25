/**
 * Mensagens geradas a partir de uma ausência (RF05, G07: modo semiautomático). O sistema monta o texto e
 * quem é responsável encaminha por e-mail institucional ou WhatsApp; nada depende da integração com o WhatsApp.
 * Sem dados sensíveis: só o motivo operacional escolhido numa lista fechada (RF02, LGPD).
 */
import type { CanalWhatsapp, NivelUrgenciaSla, StatusAusencia, TipoRefeicao } from '@prisma/client';
import { contatoDoUsuario, primeiroNome, saudacao, type MensagemPronta } from '@/lib/comunicacao/mensagem';
import type { TipoInteracao } from '@/lib/comunicacao/modelos';
import { deveAvisarGestao, formatarData, NOME_STATUS } from './regras';

export const NOME_REFEICAO_HORARIO: Record<TipoRefeicao, string> = {
  LANCHE_MANHA: 'Lanche da manhã (09:30)',
  ALMOCO: 'Almoço (12:00)',
  LANCHE_TARDE: 'Lanche da tarde (15:00)',
};

/** Setor que recebe o motivo e o comprovante da ausência (decisão G16, 25/11/2026). */
export const GESTAO_PESSOAS = { nome: 'Coordenadoria de Gestão de Pessoas', sigla: 'CGP', email: 'cgp.boaviagem@ifce.edu.br' } as const;

/**
 * Orientação ao docente ausente (decisão de 25/11/2026): o motivo e o comprovante (ex.: atestado médico) são tratados
 * direto com a Gestão de Pessoas do campus, nunca pelo SGC-Redes nem pela Coordenação do curso (LGPD).
 */
export const ORIENTACAO_GESTAO_PESSOAS = `Importante: informe também a ${GESTAO_PESSOAS.nome} (${GESTAO_PESSOAS.sigla}) do campus sobre a ausência, com o motivo, pelo e-mail ${GESTAO_PESSOAS.email}, e entregue a ela o comprovante (por exemplo, atestado médico), se houver. Esse contato e a entrega de documentos são feitos direto com a ${GESTAO_PESSOAS.sigla}, fora do SGC-Redes; não é preciso enviar motivo nem documento à Coordenação do curso.`;

export const ETIQUETA_SLA: Record<NivelUrgenciaSla, string> = {
  VERDE_24H_MAIS: '🟢 Planejado (24h+)',
  AMARELO_4H_A_24H: '🟡 Imprevisto moderado (4h–24h)',
  VERMELHO_MENOS_4H: '🔴 Emergência (< 4h)',
};

/** Linha de cada horário perdido, já descrita (ex.: "Manhã A (07:30–08:30): aula com substituto"). */
export interface LinhaHorario {
  bloco: string;
  situacao: 'pendente' | 'substituicao' | 'adiantamento' | 'dispensa';
  /** Substituição: nome do substituto. Adiantamento: "Disciplina (de Tarde A)". */
  detalhe?: string;
  /** Substituição: quem cobre. */
  substitutoId?: string | null;
  /** Adiantamento: dono da aula trazida, a disciplina dela e o horário de onde saiu. */
  professorOrigemId?: string | null;
  disciplinaOrigem?: string;
  blocoOrigem?: string;
}

export interface DadosMensagem {
  turma: string;
  codigoTurma: string;
  dataISO: string;
  diaSemana: string; // "quinta-feira"
  disciplina: string;
  professor: string;
  motivoOperacional: string;
  status: StatusAusencia;
  /** RF02-A: o próprio docente informou a ausência (a mensagem de ciência responde a ele). */
  informada?: boolean;
  horarios: readonly LinhaHorario[];
  /** Avisos de refeição ativos da turma no dia. */
  refeicoes: readonly { tipo: TipoRefeicao; acao: 'CANCELAR_REFEICAO' | 'ADICIONAR_REFEICAO'; quantidade: number; nivel: NivelUrgenciaSla }[];
}

const cabecalhoData = (d: DadosMensagem) => `${formatarData(d.dataISO)} (${d.diaSemana})`;

function textoHorario(h: LinhaHorario, paraEstudantes: boolean): string {
  switch (h.situacao) {
    case 'substituicao':
      return paraEstudantes ? 'aula normal, com professor(a) substituto(a)' : `substituição por ${h.detalhe}`;
    case 'adiantamento':
      return `aula adiantada: ${h.detalhe}`;
    case 'dispensa':
      return 'sem aula (turma dispensada neste horário)';
    default:
      return paraEstudantes ? 'a confirmar' : 'sem cobertura definida';
  }
}

/** Grupo de professores: convite para cobrir os horários ainda sem decisão. */
export function mensagemProfessores(d: DadosMensagem): string | null {
  const pendentes = d.horarios.filter((h) => h.situacao === 'pendente');
  if (pendentes.length === 0) return null;
  return [
    '*CONVITE DE SUBSTITUIÇÃO — COORD. REDES DE COMPUTADORES*',
    `Turma: *${d.turma}*`,
    `Data: *${cabecalhoData(d)}*`,
    `Disciplina: ${d.disciplina}`,
    'Horários sem cobertura:',
    ...pendentes.map((h) => `- ${h.bloco}`),
    'Quem puder assumir ou adiantar uma aula, por favor responda à Coordenação.',
  ].join('\n');
}

/** Líderes de turma: o que muda no horário da turma (sem nomes de docentes). */
export function mensagemLideres(d: DadosMensagem): string | null {
  const decididos = d.horarios.filter((h) => h.situacao !== 'pendente');
  if (decididos.length === 0) return null;
  return [
    `*AVISO À TURMA ${d.codigoTurma}* — Coord. Redes de Computadores`,
    `Data: *${cabecalhoData(d)}*`,
    'Mudanças no horário:',
    ...d.horarios.map((h) => `- ${h.bloco}: ${textoHorario(h, true)}`),
    'Repassem à turma, por favor.',
  ].join('\n');
}

/** Grupo da Gestão (G08): só dispensas, impacto alimentar ou aula sem cobertura. */
export function mensagemGestao(d: DadosMensagem): string | null {
  if (!deveAvisarGestao(d.status, d.refeicoes.length > 0)) return null;
  return [
    '*INFORME À GESTÃO — COORD. REDES DE COMPUTADORES*',
    `Turma: *${d.turma}* · ${cabecalhoData(d)}`,
    `Docente: ${d.professor} · ${d.disciplina}`,
    `Motivo operacional: ${d.motivoOperacional}`,
    `Situação: ${NOME_STATUS[d.status]}`,
    ...d.horarios.map((h) => `- ${h.bloco}: ${textoHorario(h, false)}`),
    ...(d.refeicoes.length > 0 ? ['Alimentação: Assistência Estudantil avisada pelo sistema.'] : []),
  ].join('\n');
}

/** Assistência Estudantil: só turma, data, refeições, quantidades e urgência (minimização, LGPD). */
export function mensagemAssistencia(d: DadosMensagem): string | null {
  if (d.refeicoes.length === 0) return null;
  const emergencia = d.refeicoes.some((r) => r.nivel === 'VERMELHO_MENOS_4H');
  return [
    `*AVISO DE REPLANEJAMENTO ALIMENTAR — COORD. REDES DE COMPUTADORES*${emergencia ? ' [EMERGÊNCIA]' : d.refeicoes.some((r) => r.nivel === 'AMARELO_4H_A_24H') ? ' [IMPREVISTO]' : ''}`,
    `Turma: *${d.codigoTurma}*`,
    `Data: *${cabecalhoData(d)}*`,
    ...d.refeicoes.map(
      (r) => `- ${r.acao === 'CANCELAR_REFEICAO' ? 'CANCELAR' : 'ADICIONAR'} *${NOME_REFEICAO_HORARIO[r.tipo]}*: ${r.quantidade} estudante(s) — ${ETIQUETA_SLA[r.nivel]}`,
    ),
    `Motivo operacional: ${d.motivoOperacional}`,
    '_Aviso também disponível no painel de Alimentação do SGC-Redes._',
  ].join('\n');
}

/** Nutricionista do campus: as mesmas alterações de refeição, para o planejamento do cardápio e das quantidades. */
export function mensagemNutricionista(d: DadosMensagem): string | null {
  const texto = mensagemAssistencia(d);
  if (texto === null) return null;
  return texto
    .replace('*AVISO DE REPLANEJAMENTO ALIMENTAR', '*AVISO À NUTRICIONISTA — REPLANEJAMENTO ALIMENTAR')
    .replace('_Aviso também disponível no painel de Alimentação do SGC-Redes._', 'A Assistência Estudantil também foi avisada.');
}

export const NOME_CANAL: Record<CanalWhatsapp, string> = {
  GRUPO_PROFESSORES: 'Grupo de professores',
  GRUPO_GESTAO_DIR_COORD: 'Gestão (Direção e Coordenações)',
  ASSISTENCIA_ESTUDANTIL: 'Assistência Estudantil (CAE)',
  CTP: 'CTP (Coord. Técnico-Pedagógica)',
  LIDERES_TURMA: 'Turma (líderes ou grupo da turma)',
  NUTRICIONISTA: 'Nutricionista do campus',
};

/** Campo a preencher quando o canal não tem saudação cadastrada. */
export const CAMPO_SAUDACAO: Record<CanalWhatsapp, string> = {
  GRUPO_PROFESSORES: 'destinatários (professores)',
  GRUPO_GESTAO_DIR_COORD: 'destinatários (Gestão)',
  ASSISTENCIA_ESTUDANTIL: 'destinatário na CAE',
  CTP: 'destinatário na CTP',
  LIDERES_TURMA: 'líderes da turma',
  NUTRICIONISTA: 'nome da nutricionista',
};

/** CTP: turma dispensada em algum horário (acompanhamento pedagógico e reposição). */
export function mensagemCtp(d: DadosMensagem): string | null {
  const dispensados = d.horarios.filter((h) => h.situacao === 'dispensa');
  if (dispensados.length === 0) return null;
  return [
    '*INFORME À CTP — COORD. REDES DE COMPUTADORES*',
    `Turma: *${d.turma}* · ${cabecalhoData(d)}`,
    `Disciplina: ${d.disciplina}`,
    'Horários com a turma dispensada:',
    ...dispensados.map((h) => `- ${h.bloco}`),
    d.status === 'REPOSICAO_AGENDADA' ? 'Reposição: já agendada.' : 'Reposição: a combinar com a Coordenação.',
  ].join('\n');
}

/** Configuração de um canal (grupo ou setor) usada nas mensagens. */
export interface CanalMensagem {
  canal: CanalWhatsapp;
  email: string | null;
  saudacao: string | null;
  ativo: boolean;
}

/** Contato de um docente para mensagem individual. */
export interface PessoaMensagem {
  id: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  usaWhatsapp: boolean;
}

export interface ExtrasMensagem {
  canais: readonly CanalMensagem[];
  pessoas: ReadonlyMap<string, PessoaMensagem>;
  ausenteId: string;
  /** Convites ainda sem resposta. */
  convites: readonly { id: string; professorId: string; bloco: string }[];
  /** Link para "Minha grade", quando APP_URL está configurada. */
  linkMinhaGrade: string | null;
}

const ASSUNTO = '[SGC-Redes]';
const onde = (link: string | null) => (link ? `Detalhes no SGC-Redes, em Minha grade: ${link}` : 'Detalhes no SGC-Redes, em Minha grade.');

function individual(
  p: PessoaMensagem,
  chave: string,
  papel: string,
  assunto: string,
  corpo: string[],
  tipo: TipoInteracao,
  variaveis: Record<string, string>,
): MensagemPronta {
  return {
    tipo,
    variaveis: { ...variaveis, nome: primeiroNome(p.nome) },
    chave,
    titulo: `${papel}: ${p.nome}`,
    canal: null,
    destino: papel,
    ...contatoDoUsuario(p),
    assunto,
    texto: [saudacao(primeiroNome(p.nome), 'nome do docente'), ...corpo].join('\n'),
  };
}

/**
 * Todas as mensagens aplicáveis à ausência, na ordem em que costumam ser enviadas: grupos e setores
 * (com saudação e e-mail do canal) e mensagens individuais aos docentes envolvidos.
 * Canais desativados em Comunicação não geram mensagem.
 */
export function mensagensDaAusencia(d: DadosMensagem, x: ExtrasMensagem): MensagemPronta[] {
  const canal = new Map(x.canais.map((c) => [c.canal, c]));
  const quando = `${d.codigoTurma} — ${formatarData(d.dataISO)}`;
  const lista: MensagemPronta[] = [];
  const lista_ = (linhas: string[]) => linhas.map((l) => `- ${l}`).join('\n');
  const dispensa = d.horarios.some((h) => h.situacao === 'dispensa');
  const reposicao = !dispensa
    ? 'Nenhuma aula ficou sem atendimento.'
    : d.status === 'REPOSICAO_AGENDADA'
      ? 'A reposição das aulas dispensadas já está agendada.'
      : 'A reposição das aulas dispensadas será combinada com a Coordenação.';
  // Variáveis dos textos-padrão (src/lib/comunicacao/modelos.ts).
  const base: Record<string, string> = {
    turma: d.turma,
    'codigo da turma': d.codigoTurma,
    data: formatarData(d.dataISO),
    dia: d.diaSemana,
    disciplina: d.disciplina,
    situacao: NOME_STATUS[d.status],
    reposicao,
    'gestao de pessoas': ORIENTACAO_GESTAO_PESSOAS,
    ...(x.linkMinhaGrade ? { link: x.linkMinhaGrade } : {}),
  };
  const horariosDe = (paraEstudantes: boolean) => lista_(d.horarios.map((h) => `${h.bloco}: ${textoHorario(h, paraEstudantes)}`));
  const VARIAVEIS_CANAL: Record<CanalWhatsapp, Record<string, string>> = {
    GRUPO_PROFESSORES: { horarios: lista_(d.horarios.filter((h) => h.situacao === 'pendente').map((h) => h.bloco)) },
    ASSISTENCIA_ESTUDANTIL: {
      refeicoes: lista_(
        d.refeicoes.map((r) => `${r.acao === 'CANCELAR_REFEICAO' ? 'CANCELAR' : 'ADICIONAR'} ${NOME_REFEICAO_HORARIO[r.tipo]}: ${r.quantidade} estudante(s) — ${ETIQUETA_SLA[r.nivel]}`),
      ),
    },
    LIDERES_TURMA: { horarios: horariosDe(true) },
    NUTRICIONISTA: {
      refeicoes: lista_(
        d.refeicoes.map((r) => `${r.acao === 'CANCELAR_REFEICAO' ? 'CANCELAR' : 'ADICIONAR'} ${NOME_REFEICAO_HORARIO[r.tipo]}: ${r.quantidade} estudante(s) — ${ETIQUETA_SLA[r.nivel]}`),
      ),
    },
    CTP: { horarios: lista_(d.horarios.filter((h) => h.situacao === 'dispensa').map((h) => h.bloco)) },
    GRUPO_GESTAO_DIR_COORD: { horarios: horariosDe(false) },
  };
  const TIPO_CANAL: Record<CanalWhatsapp, TipoInteracao> = {
    GRUPO_PROFESSORES: 'convite_grupo',
    ASSISTENCIA_ESTUDANTIL: 'alimentacao',
    LIDERES_TURMA: 'aviso_turma',
    NUTRICIONISTA: 'alimentacao',
    CTP: 'ctp',
    GRUPO_GESTAO_DIR_COORD: 'gestao',
  };

  const doCanal = (c: CanalWhatsapp, texto: string | null, assunto: string) => {
    const cfg = canal.get(c);
    if (texto === null || (cfg && !cfg.ativo)) return;
    lista.push({
      tipo: TIPO_CANAL[c],
      variaveis: { ...base, ...VARIAVEIS_CANAL[c], ...(cfg?.saudacao ? { destinatarios: cfg.saudacao } : {}) },
      chave: `canal:${c}`,
      titulo: NOME_CANAL[c],
      canal: c,
      destino: NOME_CANAL[c],
      para: cfg?.email ?? null,
      whatsapp: null,
      aceitaWhatsapp: true,
      assunto: `${ASSUNTO} ${assunto} — ${quando}`,
      texto: `${saudacao(cfg?.saudacao, CAMPO_SAUDACAO[c])}\n\n${texto}`,
    });
  };
  const pessoa = (id: string | null | undefined) => (id ? x.pessoas.get(id) : undefined);

  doCanal('GRUPO_PROFESSORES', mensagemProfessores(d), 'Convite de substituição');

  for (const c of x.convites) {
    const p = pessoa(c.professorId);
    if (!p) continue;
    lista.push(
      individual(p, `convite:${c.id}`, 'Docente convidado(a)', `${ASSUNTO} Convite de substituição — ${quando}`, [
        `A Coordenação de Redes de Computadores convida você para substituir na turma *${d.turma}*:`,
        `- ${cabecalhoData(d)}, ${c.bloco} (${d.disciplina})`,
        `Para aceitar ou recusar, acesse o SGC-Redes, em Minha grade${x.linkMinhaGrade ? `: ${x.linkMinhaGrade}` : '.'}`,
        'Se preferir, responda a esta mensagem.',
      ], 'convite_individual', { ...base, horarios: `- ${c.bloco} (${d.disciplina})` }),
    );
  }

  const porSubstituto = new Map<string, string[]>();
  const porOrigem = new Map<string, LinhaHorario[]>();
  for (const h of d.horarios) {
    if (h.situacao === 'substituicao' && h.substitutoId) porSubstituto.set(h.substitutoId, [...(porSubstituto.get(h.substitutoId) ?? []), h.bloco]);
    if (h.situacao === 'adiantamento' && h.professorOrigemId) porOrigem.set(h.professorOrigemId, [...(porOrigem.get(h.professorOrigemId) ?? []), h]);
  }
  for (const [id, blocos] of porSubstituto) {
    const p = pessoa(id);
    if (!p) continue;
    lista.push(
      individual(p, `substituto:${id}`, 'Docente substituto(a)', `${ASSUNTO} Substituição confirmada — ${quando}`, [
        `Você está escalado(a) para substituir na turma *${d.turma}* em *${cabecalhoData(d)}*:`,
        ...blocos.map((b) => `- ${b} (no lugar de ${d.disciplina})`),
        onde(x.linkMinhaGrade),
        'Obrigado(a)!',
      ], 'substituicao', { ...base, horarios: lista_(blocos.map((b) => `${b} (no lugar de ${d.disciplina})`)) }),
    );
  }
  for (const [id, linhas] of porOrigem) {
    const p = pessoa(id);
    if (!p) continue;
    lista.push(
      individual(p, `adiantamento:${id}`, 'Docente com aula adiantada', `${ASSUNTO} Aula adiantada — ${quando}`, [
        `Em *${cabecalhoData(d)}*, na turma *${d.turma}*:`,
        ...linhas.map((h) => `- sua aula de ${h.disciplinaOrigem ?? 'sua disciplina'} ${h.blocoOrigem ? `(${h.blocoOrigem}) ` : ''}passa para ${h.bloco}.`),
        'O horário de origem fica vago.',
        onde(x.linkMinhaGrade),
      ], 'adiantamento', {
        ...base,
        horarios: lista_(linhas.map((h) => `${h.disciplinaOrigem ?? 'sua aula'} ${h.blocoOrigem ? `(${h.blocoOrigem}) ` : ''}passa para ${h.bloco}`)),
      }),
    );
  }

  doCanal('ASSISTENCIA_ESTUDANTIL', mensagemAssistencia(d), 'Replanejamento alimentar');
  doCanal('NUTRICIONISTA', mensagemNutricionista(d), 'Replanejamento alimentar');
  doCanal('LIDERES_TURMA', mensagemLideres(d), 'Aviso à turma');
  doCanal('CTP', mensagemCtp(d), 'Turma dispensada');
  doCanal('GRUPO_GESTAO_DIR_COORD', mensagemGestao(d), 'Informe à Gestão');

  const ausente = pessoa(x.ausenteId);
  const decididos = d.horarios.filter((h) => h.situacao !== 'pendente');
  // Ciência da ausência: assim que a ausência é registrada (antes da cobertura), com a orientação da Gestão de Pessoas.
  if (ausente && decididos.length === 0) {
    lista.push(
      individual(ausente, `ciencia:${ausente.id}`, 'Docente ausente', `${ASSUNTO} Ciência da sua ausência — ${quando}`, [
        d.informada
          ? `A Coordenação recebeu a ausência que você informou nas aulas de *${d.disciplina}* na turma *${d.turma}* em *${cabecalhoData(d)}*:`
          : `A Coordenação registrou a sua ausência nas aulas de *${d.disciplina}* na turma *${d.turma}* em *${cabecalhoData(d)}*:`,
        ...d.horarios.map((h) => `- ${h.bloco}`),
        'Vamos organizar a cobertura e avisar você quando estiver decidida.',
        '',
        ORIENTACAO_GESTAO_PESSOAS,
      ], 'docente_ausente', { ...base, horarios: lista_(d.horarios.map((h) => h.bloco)) }),
    );
  }
  if (ausente && decididos.length > 0) {
    lista.push(
      individual(ausente, `ausente:${ausente.id}`, 'Docente ausente', `${ASSUNTO} Cobertura das suas aulas — ${quando}`, [
        `A Coordenação registrou a cobertura das suas aulas de *${d.disciplina}* na turma *${d.turma}* em *${cabecalhoData(d)}*:`,
        ...d.horarios.map((h) => `- ${h.bloco}: ${textoHorario(h, false)}`),
        d.horarios.some((h) => h.situacao === 'dispensa')
          ? d.status === 'REPOSICAO_AGENDADA'
            ? 'A reposição das aulas dispensadas já está agendada.'
            : 'Combine com a Coordenação a reposição das aulas dispensadas.'
          : 'Nenhuma aula ficou sem atendimento.',
        '',
        ORIENTACAO_GESTAO_PESSOAS,
      ], 'docente_ausente', { ...base, horarios: horariosDe(false) }),
    );
  }
  return lista;
}
