/**
 * Ausência docente e remanejamento (RF02). Funções puras: as páginas e Server Actions buscam a grade
 * do dia no banco e chamam estas funções para sugerir coberturas, validar a decisão e calcular o
 * impacto nas refeições (RF03/RF04).
 *
 * Vocabulário:
 * - "aula do dia": célula preenchida da grade que vale na data (G14: sábado letivo segue um dia da semana).
 * - "cobertura": decisão da Coordenação para um bloco perdido — substituição, adiantamento ou dispensa.
 * - "ocupação efetiva": quem dá aula em qual bloco depois de aplicar as coberturas já decididas no dia.
 */
import type { AcaoAlimentacao, StatusAusencia, TipoCobertura, TipoRefeicao, Turno } from '@prisma/client';
import * as z from 'zod';
import { calcularImpactoAlimentacao, validarDataISO, type ImpactoRefeicao, type PresencaTurnos } from '@/lib/alimentacao-engine';

export interface BlocoDia {
  id: string;
  turno: Turno;
  ordem: number;
  horaInicio: string;
  horaFim: string;
}

export interface AulaDia {
  turmaId: string;
  blocoId: string;
  ofertaId: string;
  professorId: string;
}

/** Cobertura já decidida em alguma ausência do dia. `professorOrigemId`: dono da aula adiantada. */
export interface CoberturaDia {
  ausenciaId: string;
  turmaId: string;
  blocoId: string;
  tipo: TipoCobertura;
  substitutoId?: string | null;
  blocoOrigemId?: string | null;
  professorOrigemId?: string | null;
}

export interface Ocupacao {
  professorId: string;
  turmaId: string;
  blocoId: string;
}

/** Motivos aceitos: só descrições operacionais, nunca dados médicos ou pessoais (RF02, LGPD). */
export const MOTIVOS_OPERACIONAIS = [
  'Ausência justificada',
  'Participação em evento',
  'Atividade institucional',
  'Capacitação ou formação',
  'Viagem a serviço',
  'Outro motivo operacional',
] as const;

export const NOME_STATUS: Record<StatusAusencia, string> = {
  PENDENTE_DECISAO: 'Aguardando decisão',
  COBERTA_POR_SUBSTITUICAO: 'Coberta por substituição',
  AULA_ADIANTADA: 'Aula adiantada',
  TURMA_DISPENSADA: 'Turma dispensada',
  REPOSICAO_AGENDADA: 'Reposição agendada',
};

/** Dias para trás aceitos no registro (lançamento atrasado) e para frente (ausência planejada). */
export const DIAS_RETROATIVOS = 30;
export const DIAS_ANTECEDENCIA_MAXIMA = 366;

/** Rótulo curto do bloco, igual ao campo `blocosAfetados`: M1…M4 (manhã), T1…T4 (tarde). */
export const codigoBloco = (b: Pick<BlocoDia, 'turno' | 'ordem'>) => `${b.turno === 'MANHA' ? 'M' : 'T'}${b.ordem}`;

/** Ex.: "Manhã A (07:30–08:30)". */
export function descreverBloco(b: BlocoDia): string {
  return `${b.turno === 'MANHA' ? 'Manhã' : 'Tarde'} ${String.fromCharCode(64 + b.ordem)} (${b.horaInicio}–${b.horaFim})`;
}

/** Posição do bloco no dia: manhã antes da tarde, depois a ordem. */
export const posicaoNoDia = (b: Pick<BlocoDia, 'turno' | 'ordem'>) => (b.turno === 'MANHA' ? 0 : 100) + b.ordem;

/** Data de hoje (AAAA-MM-DD) no fuso de Fortaleza. */
export function hojeEmFortaleza(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(agora);
}

/** Soma dias a uma data ISO. */
export function somarDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-24" → "24/11/2026". */
export const formatarData = (dataISO: string) => dataISO.split('-').reverse().join('/');

/** Data do banco (@db.Date, meia-noite UTC) ↔ ISO. */
export const dataParaBanco = (dataISO: string) => new Date(`${dataISO}T00:00:00Z`);
export const dataDoBanco = (d: Date) => d.toISOString().slice(0, 10);

/** Ano e semestre letivos de uma data: janeiro–junho → 1, julho–dezembro → 2. */
export function periodoDaData(dataISO: string): { anoLetivo: number; semestreLetivo: 1 | 2 } {
  const [ano, mes] = dataISO.split('-').map(Number);
  return { anoLetivo: ano, semestreLetivo: mes <= 6 ? 1 : 2 };
}

const ehDataValida = (v: string) => {
  try {
    validarDataISO(v);
    return true;
  } catch {
    return false;
  }
};

/** Primeira etapa do registro: quem falta e quando (formulário GET). */
export const ConsultaAusenciaSchema = z.object({
  professorId: z.string().trim().min(1, { error: 'Escolha o professor.' }),
  data: z.string().trim().min(1, { error: 'Informe a data.' }).refine(ehDataValida, { error: 'Informe uma data válida.' }),
});

/** Segunda etapa: aulas escolhidas e motivo. A janela de datas aceitas depende de "hoje". */
export function criarRegistroAusenciaSchema(hojeISO: string) {
  const minimo = somarDias(hojeISO, -DIAS_RETROATIVOS);
  const maximo = somarDias(hojeISO, DIAS_ANTECEDENCIA_MAXIMA);
  return ConsultaAusenciaSchema.extend({
    data: ConsultaAusenciaSchema.shape.data.refine((v) => v >= minimo && v <= maximo, {
      error: `Use uma data entre ${formatarData(minimo)} e ${formatarData(maximo)}.`,
    }),
    motivoOperacional: z.enum(MOTIVOS_OPERACIONAIS, { error: 'Escolha o motivo operacional.' }),
    aulas: z.array(z.string()).min(1, { error: 'Marque pelo menos uma aula afetada.' }),
  });
}

/** Valor do checkbox de cada aula na segunda etapa. */
export const chaveAula = (a: Pick<AulaDia, 'ofertaId' | 'blocoId'>) => `${a.ofertaId}|${a.blocoId}`;

/**
 * Agrupa as aulas escolhidas por oferta: cada oferta vira uma ausência (uma turma e uma disciplina),
 * com os blocos em ordem. Chaves que não correspondem a aulas do professor no dia são ignoradas.
 */
export function agruparAulasEscolhidas(aulasDoProfessor: readonly AulaDia[], chaves: readonly string[], blocos: readonly BlocoDia[]) {
  const escolhidas = new Set(chaves);
  const pos = new Map(blocos.map((b) => [b.id, posicaoNoDia(b)]));
  const grupos = new Map<string, { ofertaId: string; turmaId: string; blocoIds: string[] }>();
  for (const a of aulasDoProfessor) {
    if (!escolhidas.has(chaveAula(a))) continue;
    const g = grupos.get(a.ofertaId) ?? { ofertaId: a.ofertaId, turmaId: a.turmaId, blocoIds: [] };
    g.blocoIds.push(a.blocoId);
    grupos.set(a.ofertaId, g);
  }
  for (const g of grupos.values()) g.blocoIds.sort((x, y) => (pos.get(x) ?? 0) - (pos.get(y) ?? 0));
  return [...grupos.values()];
}

/**
 * Quem dá aula em cada bloco depois das coberturas decididas: adiantamento tira a aula da origem e a
 * põe no bloco coberto; substituição acrescenta o substituto. As aulas do professor ausente continuam
 * na lista (ele é excluído das sugestões por estar ausente).
 */
export function ocupacoesEfetivas(aulasDoDia: readonly AulaDia[], coberturas: readonly CoberturaDia[]): Ocupacao[] {
  const origensVagas = new Set(
    coberturas.filter((c) => c.tipo === 'ADIANTAMENTO' && c.blocoOrigemId).map((c) => `${c.turmaId}|${c.blocoOrigemId}`),
  );
  const ocupacoes: Ocupacao[] = aulasDoDia
    .filter((a) => !origensVagas.has(`${a.turmaId}|${a.blocoId}`))
    .map(({ professorId, turmaId, blocoId }) => ({ professorId, turmaId, blocoId }));
  for (const c of coberturas) {
    const professorId = c.tipo === 'SUBSTITUICAO' ? c.substitutoId : c.tipo === 'ADIANTAMENTO' ? c.professorOrigemId : null;
    if (professorId) ocupacoes.push({ professorId, turmaId: c.turmaId, blocoId: c.blocoId });
  }
  return ocupacoes;
}

export interface Docente {
  id: string;
  nome: string;
}

export interface SugestaoSubstituto extends Docente {
  /** Leciona na turma (G03: aparece primeiro). */
  daTurma: boolean;
}

export interface SugestaoAdiantamento {
  blocoOrigemId: string;
  ofertaId: string;
  professorId: string;
}

export interface ContextoDia {
  blocos: readonly BlocoDia[];
  aulasDoDia: readonly AulaDia[];
  /** Coberturas decididas nas OUTRAS ausências do dia (as desta ausência estão sendo redecididas). */
  coberturasOutras: readonly CoberturaDia[];
  /** Professores com ausência registrada no dia (qualquer turma). */
  ausentes: ReadonlySet<string>;
  /** Blocos perdidos por ausência, por turma, no dia (chave `${turmaId}|${blocoId}`): não podem ser origem de adiantamento. */
  blocosPerdidos: ReadonlySet<string>;
  docentes: readonly Docente[];
}

/**
 * Substitutos possíveis para um bloco (G03): docentes ativos que não faltam no dia e estão livres no
 * bloco. Quem leciona na turma vem primeiro; depois, os demais. Ordem alfabética dentro de cada grupo.
 */
export function sugerirSubstitutos(ctx: ContextoDia, turmaId: string, blocoId: string): SugestaoSubstituto[] {
  const ocupados = new Set(
    ocupacoesEfetivas(ctx.aulasDoDia, ctx.coberturasOutras)
      .filter((o) => o.blocoId === blocoId)
      .map((o) => o.professorId),
  );
  const daTurma = new Set(ctx.aulasDoDia.filter((a) => a.turmaId === turmaId).map((a) => a.professorId));
  return ctx.docentes
    .filter((d) => !ctx.ausentes.has(d.id) && !ocupados.has(d.id))
    .map((d) => ({ ...d, daTurma: daTurma.has(d.id) }))
    .sort((a, b) => Number(b.daTurma) - Number(a.daTurma) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Adiantamentos possíveis para um bloco: aulas posteriores da mesma turma, no mesmo dia (inclusive no
 * outro turno), cujo professor não falta e está livre no bloco vago. A aula sai da origem, que fica vaga.
 */
export function sugerirAdiantamentos(ctx: ContextoDia, turmaId: string, blocoId: string): SugestaoAdiantamento[] {
  const pos = new Map(ctx.blocos.map((b) => [b.id, posicaoNoDia(b)]));
  const destino = pos.get(blocoId);
  if (destino === undefined) return [];
  const efetivas = ocupacoesEfetivas(ctx.aulasDoDia, ctx.coberturasOutras);
  const ocupadosNoDestino = new Set(efetivas.filter((o) => o.blocoId === blocoId).map((o) => o.professorId));
  const ofertaPorCelula = new Map(ctx.aulasDoDia.map((a) => [`${a.turmaId}|${a.blocoId}`, a.ofertaId]));
  return efetivas
    .filter(
      (o) =>
        o.turmaId === turmaId &&
        (pos.get(o.blocoId) ?? -1) > destino &&
        !ctx.ausentes.has(o.professorId) &&
        !ocupadosNoDestino.has(o.professorId) &&
        !ctx.blocosPerdidos.has(`${turmaId}|${o.blocoId}`) &&
        ofertaPorCelula.has(`${turmaId}|${o.blocoId}`),
    )
    .sort((a, b) => (pos.get(a.blocoId) ?? 0) - (pos.get(b.blocoId) ?? 0))
    .map((o) => ({ blocoOrigemId: o.blocoId, ofertaId: ofertaPorCelula.get(`${turmaId}|${o.blocoId}`)!, professorId: o.professorId }));
}

/** Valor de cada opção do formulário de decisão (um `<select>` por bloco perdido). */
export const OPCAO_PENDENTE = '';
export const OPCAO_DISPENSA = 'dispensa';
export const opcaoSubstituto = (professorId: string) => `sub:${professorId}`;
export const opcaoAdiantamento = (blocoOrigemId: string) => `adi:${blocoOrigemId}`;
export const PREFIXO_DECISAO = 'decisao:';

export interface CoberturaPlanejada {
  blocoId: string;
  tipo: TipoCobertura;
  substitutoId: string | null;
  blocoOrigemId: string | null;
  professorOrigemId: string | null;
}

/**
 * Valida as escolhas do formulário contra as sugestões calculadas no servidor (nunca confia no valor
 * enviado). Blocos sem escolha ficam pendentes. Duas escolhas não podem adiantar a mesma aula.
 */
export function planejarCoberturas(
  ctx: ContextoDia,
  turmaId: string,
  blocoIds: readonly string[],
  escolhas: Readonly<Record<string, string>>,
): { coberturas: CoberturaPlanejada[]; erros: Record<string, string> } {
  const coberturas: CoberturaPlanejada[] = [];
  const erros: Record<string, string> = {};
  const origensUsadas = new Set<string>();
  for (const blocoId of blocoIds) {
    const escolha = escolhas[blocoId] ?? OPCAO_PENDENTE;
    if (escolha === OPCAO_PENDENTE) continue;
    if (escolha === OPCAO_DISPENSA) {
      coberturas.push({ blocoId, tipo: 'DISPENSA', substitutoId: null, blocoOrigemId: null, professorOrigemId: null });
    } else if (escolha.startsWith('sub:')) {
      const id = escolha.slice(4);
      if (!sugerirSubstitutos(ctx, turmaId, blocoId).some((s) => s.id === id)) {
        erros[blocoId] = 'Este professor não está mais livre neste horário. Escolha outra opção.';
        continue;
      }
      coberturas.push({ blocoId, tipo: 'SUBSTITUICAO', substitutoId: id, blocoOrigemId: null, professorOrigemId: null });
    } else if (escolha.startsWith('adi:')) {
      const origem = escolha.slice(4);
      const sugestao = sugerirAdiantamentos(ctx, turmaId, blocoId).find((s) => s.blocoOrigemId === origem);
      if (!sugestao) {
        erros[blocoId] = 'Esta aula não pode mais ser adiantada para este horário. Escolha outra opção.';
        continue;
      }
      if (origensUsadas.has(origem)) {
        erros[blocoId] = 'A mesma aula foi escolhida para adiantar em dois horários.';
        continue;
      }
      origensUsadas.add(origem);
      coberturas.push({ blocoId, tipo: 'ADIANTAMENTO', substitutoId: null, blocoOrigemId: origem, professorOrigemId: sugestao.professorId });
    } else {
      erros[blocoId] = 'Opção inválida.';
    }
  }
  return { coberturas, erros };
}

/** Situação da ausência a partir das coberturas: qualquer dispensa domina; depois adiantamento. */
export function statusDaAusencia(totalBlocos: number, coberturas: readonly Pick<CoberturaPlanejada, 'tipo'>[], reposicaoAgendada: boolean): StatusAusencia {
  if (coberturas.length < totalBlocos) return 'PENDENTE_DECISAO';
  if (coberturas.some((c) => c.tipo === 'DISPENSA')) return reposicaoAgendada ? 'REPOSICAO_AGENDADA' : 'TURMA_DISPENSADA';
  if (coberturas.some((c) => c.tipo === 'ADIANTAMENTO')) return 'AULA_ADIANTADA';
  return 'COBERTA_POR_SUBSTITUICAO';
}

/** Turnos com pelo menos uma aula, a partir dos blocos ocupados da turma no dia (RN01). */
export function presencaPorTurno(blocoIds: Iterable<string>, blocos: readonly BlocoDia[]): PresencaTurnos {
  const turno = new Map(blocos.map((b) => [b.id, b.turno]));
  const turnos = new Set([...blocoIds].map((id) => turno.get(id)));
  return { temAulaManha: turnos.has('MANHA'), temAulaTarde: turnos.has('TARDE') };
}

/**
 * Blocos em que a turma tem aula depois das coberturas decididas: dispensa esvazia o bloco; adiantamento
 * esvazia a origem (o bloco coberto segue ocupado). Blocos pendentes contam como ocupados até a decisão.
 */
export function blocosOcupadosDepois(blocosDaGrade: Iterable<string>, coberturasDaTurma: readonly Pick<CoberturaDia, 'tipo' | 'blocoId' | 'blocoOrigemId'>[]): Set<string> {
  const ocupados = new Set(blocosDaGrade);
  for (const c of coberturasDaTurma) {
    if (c.tipo === 'DISPENSA') ocupados.delete(c.blocoId);
    if (c.tipo === 'ADIANTAMENTO' && c.blocoOrigemId) ocupados.delete(c.blocoOrigemId);
  }
  return ocupados;
}

/**
 * Avisos de refeição que a turma precisa no dia (RF03/RF04). Refeição cujo horário já passou não gera
 * aviso (G13): a AE só recebe o que ainda dá para replanejar.
 */
export function impactosFuturos(dataISO: string, antes: PresencaTurnos, depois: PresencaTurnos, agora: Date): ImpactoRefeicao[] {
  return calcularImpactoAlimentacao({ dataAulaISO: dataISO, antes, depois, agora }).filter((i) => i.antecedenciaMinutos >= 0);
}

export const ACAO_DO_IMPACTO: Record<ImpactoRefeicao['acao'], AcaoAlimentacao> = {
  CANCELAR: 'CANCELAR_REFEICAO',
  ADICIONAR: 'ADICIONAR_REFEICAO',
};

export interface AlertaExistente {
  id: string;
  tipoRefeicao: TipoRefeicao;
  acao: AcaoAlimentacao;
  dataRefeicao: Date;
}

/**
 * Concilia os avisos ativos da turma no dia com os necessários agora. Avisos de refeições que já
 * passaram ficam como estão (são histórico). Os demais: cria os que faltam e cancela os que deixaram
 * de valer (a AE vê o cancelamento). Avisos que continuam valendo são mantidos, com a quantidade editada.
 */
export function conciliarAlertas(existentes: readonly AlertaExistente[], necessarios: readonly ImpactoRefeicao[], agora: Date) {
  const futuros = existentes.filter((a) => a.dataRefeicao.getTime() >= agora.getTime());
  const chave = (tipo: TipoRefeicao, acao: AcaoAlimentacao) => `${tipo}|${acao}`;
  const desejadas = new Set(necessarios.map((i) => chave(i.tipoRefeicao, ACAO_DO_IMPACTO[i.acao])));
  const atuais = new Set(futuros.map((a) => chave(a.tipoRefeicao, a.acao)));
  return {
    criar: necessarios.filter((i) => !atuais.has(chave(i.tipoRefeicao, ACAO_DO_IMPACTO[i.acao]))),
    cancelarIds: futuros.filter((a) => !desejadas.has(chave(a.tipoRefeicao, a.acao))).map((a) => a.id),
  };
}

/** Horário da refeição como instante (fuso de Fortaleza). */
export function instanteDaRefeicao(dataISO: string, horario: string): Date {
  return new Date(`${dataISO}T${horario}:00-03:00`);
}

/** G08: o grupo da Gestão só é avisado de dispensa, impacto na alimentação ou aula ainda sem cobertura. */
export function deveAvisarGestao(status: StatusAusencia, temImpactoAlimentar: boolean): boolean {
  return status === 'PENDENTE_DECISAO' || status === 'TURMA_DISPENSADA' || status === 'REPOSICAO_AGENDADA' || temImpactoAlimentar;
}

export const NOME_STATUS_CONVITE: Record<'PENDENTE' | 'ACEITO' | 'RECUSADO' | 'ENCERRADO', string> = {
  PENDENTE: '⏳ Aguardando resposta',
  ACEITO: '✔ Aceito',
  RECUSADO: '✖ Recusado',
  ENCERRADO: '— Encerrado (horário já decidido)',
};
