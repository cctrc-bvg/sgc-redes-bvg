import type { TipoEventoCalendario } from '@prisma/client';
import { formatarData } from '@/lib/ausencias/regras';
import {
  ETAPAS,
  EventoSchema,
  MOTIVOS_SUSPENSAO,
  NOME_TIPO_EVENTO,
  SUSPENDE_POR_PADRAO,
  TIPOS_EVENTO,
  nomeEtapa,
  validarSequencia,
  type Intervalo,
} from '@/lib/calendario/regras';
import { NOME_DIA, SabadoLetivoSchema } from '@/lib/grade/regras';
import type { LinhaResultado } from './estado';
import { lerDataPlanilha, lerDiaSemana, OPCOES_DIA_PLANILHA } from './sabados';
import { lerSimNao, normalizarCabecalho } from './tabela';

/**
 * Planilha do calendário acadêmico: o mesmo formato serve para exportar e importar, de modo que a
 * Coordenação pode baixar o calendário, editar no Excel e enviar de volta (ou copiar para outro ano).
 * Cada linha é uma etapa, um semestre, um evento ou um sábado letivo.
 */
export const COLUNAS_CALENDARIO = [
  { campo: 'tipo', titulo: 'Tipo', apelidos: ['evento', 'tipo_de_evento'], obrigatoria: true, largura: 34 },
  { campo: 'inicio', titulo: 'Início', apelidos: ['data', 'data_inicio', 'de'], obrigatoria: true, largura: 12 },
  { campo: 'fim', titulo: 'Término', apelidos: ['fim', 'data_fim', 'ate'], largura: 12 },
  { campo: 'descricao', titulo: 'Descrição', apelidos: ['observacao', 'obs', 'nome'], largura: 40 },
  { campo: 'motivo', titulo: 'Motivo', apelidos: ['motivo_da_suspensao'], largura: 28 },
  { campo: 'aulas', titulo: 'Aulas', apelidos: ['suspende_aulas', 'tem_aula'], largura: 11 },
  { campo: 'imprevisto', titulo: 'Imprevisto', apelidos: ['nao_previsto', 'a_repor'], largura: 11 },
  { campo: 'grade', titulo: 'Segue a grade de', apelidos: ['grade_de', 'dia_referente'], largura: 17 },
] as const;

export type CampoCalendario = (typeof COLUNAS_CALENDARIO)[number]['campo'];
export type RegistroCalendario = Record<CampoCalendario, string>;

export const TIPO_SABADO = 'Sábado letivo';
export const nomeSemestre = (n: number) => `${n}º semestre`;
const nomeEtapaPlanilha = (n: number) => `Etapa ${nomeEtapa(n)}`;
const SEM_AULA = 'Sem aula';
const MANTIDAS = 'Mantidas';

/** Listas suspensas do modelo .xlsx (o Excel limita cada lista a 255 caracteres; "Tipo" vai nas instruções). */
export const OPCOES_CALENDARIO: Partial<Record<CampoCalendario, readonly string[]>> = {
  aulas: [SEM_AULA, MANTIDAS],
  imprevisto: ['Sim', 'Não'],
  motivo: MOTIVOS_SUSPENSAO,
  grade: OPCOES_DIA_PLANILHA,
};

type TipoLinha = { tipo: 'etapa'; numero: number } | { tipo: 'semestre'; numero: number } | { tipo: 'sabado' } | { tipo: 'evento'; evento: TipoEventoCalendario };

/** "Etapa N1", "N1", "1º semestre", "Sábado letivo", "Feriado", "FERIADO"… → tipo da linha. */
export function lerTipoLinha(v: string): TipoLinha | null {
  const n = normalizarCabecalho(v);
  const etapa = /^(etapa_)?n([1-4])$/.exec(n);
  if (etapa) return { tipo: 'etapa', numero: Number(etapa[2]) };
  const semestre = /^([12])(o)?_?semestre$/.exec(n) ?? /^semestre_([12])$/.exec(n);
  if (semestre) return { tipo: 'semestre', numero: Number(semestre[1]) };
  if (n === 'sabado_letivo' || n === 'sabado') return { tipo: 'sabado' };
  for (const t of TIPOS_EVENTO) {
    if (n === normalizarCabecalho(t) || n === normalizarCabecalho(NOME_TIPO_EVENTO[t])) return { tipo: 'evento', evento: t };
  }
  const apelidos: Record<string, TipoEventoCalendario> = {
    ferias: 'FERIAS_DOCENTES',
    reunioes: 'REUNIAO',
    pits: 'PITS_RITS',
    pit_rit: 'PITS_RITS',
    avaliacoes_finais: 'AVALIACOES_FINAIS',
    suspensao: 'SUSPENSAO_AULAS',
    suspensao_de_aulas: 'SUSPENSAO_AULAS',
    forca_maior: 'SUSPENSAO_AULAS',
  };
  return apelidos[n] ? { tipo: 'evento', evento: apelidos[n] } : null;
}

/** "Sem aula" → true; "Mantidas"/"Letivo" → false; vazio → padrão do tipo; outro → null. */
export function lerAulas(v: string, padrao: boolean): boolean | null {
  const n = normalizarCabecalho(v);
  if (n === '') return padrao;
  if (['sem_aula', 'sem_aulas', 'suspensas', 'suspende', 'sim'].includes(n)) return true;
  if (['mantidas', 'mantida', 'com_aula', 'letivo', 'nao'].includes(n)) return false;
  return null;
}

export interface EventoExistente {
  id: string;
  tipo: TipoEventoCalendario;
  inicio: string;
  fim: string;
  descricao: string | null;
  suspendeAulas: boolean;
  imprevisto: boolean;
  motivo: string | null;
}
export interface SabadoExistenteCal {
  id: string;
  data: string;
  diaSemanaReferente: number;
  observacao: string | null;
}
export interface CalendarioExistente {
  etapas: readonly (Intervalo | null)[];
  semestres: readonly (Intervalo | null)[];
  eventos: readonly EventoExistente[];
  sabados: readonly SabadoExistenteCal[];
}

export type DadosEventoPlano = Omit<EventoExistente, 'id'>;

export interface PlanoImportacaoCalendario {
  linhas: LinhaResultado[];
  /** Etapas e semestres a gravar (upsert); null = mantém o cadastrado. */
  etapas: (Intervalo | null)[];
  semestres: (Intervalo | null)[];
  eventosCriar: DadosEventoPlano[];
  eventosAtualizar: ({ id: string } & DadosEventoPlano)[];
  sabadosCriar: { data: string; diaSemanaReferente: number; observacao: string | null }[];
  sabadosAtualizar: { id: string; diaSemanaReferente: number; observacao: string | null }[];
  temErros: boolean;
  /** Quantos itens serão gravados (criados ou alterados). */
  mudancas: number;
}

const mesmoIntervalo = (a: Intervalo | null, b: Intervalo | null) => a?.inicio === b?.inicio && a?.fim === b?.fim;
const chaveEvento = (e: { tipo: string; inicio: string; fim: string }) => `${e.tipo}|${e.inicio}|${e.fim}`;

export function planejarImportacaoCalendario(params: {
  ano: number;
  registros: { numero: number; valores: RegistroCalendario }[];
  existente: CalendarioExistente;
}): PlanoImportacaoCalendario {
  const { ano, existente } = params;
  const plano: PlanoImportacaoCalendario = {
    linhas: [],
    etapas: ETAPAS.map(() => null),
    semestres: [null, null],
    eventosCriar: [],
    eventosAtualizar: [],
    sabadosCriar: [],
    sabadosAtualizar: [],
    temErros: false,
    mudancas: 0,
  };
  const erro = (numero: number, descricao: string, detalhe: string) => {
    plano.linhas.push({ numero, descricao, situacao: 'erro', detalhe });
    plano.temErros = true;
  };
  const doAno = (i: Intervalo) => i.inicio.startsWith(`${ano}-`) || i.fim.startsWith(`${ano}-`);
  const vistos = new Map<string, number>();
  const repetida = (chave: string, numero: number) => {
    const antes = vistos.get(chave);
    if (antes) return antes;
    vistos.set(chave, numero);
    return null;
  };
  const eventosPorChave = new Map(existente.eventos.map((e) => [chaveEvento(e), e]));
  const sabadosPorData = new Map(existente.sabados.map((s) => [s.data, s]));
  // Linha de cada período, para apontar o erro de sequência na linha certa.
  const linhaDoPeriodo = new Map<string, { numero: number; descricao: string }>();

  for (const { numero, valores } of params.registros) {
    const tipo = lerTipoLinha(valores.tipo);
    const inicio = lerDataPlanilha(valores.inicio);
    const fim = valores.fim.trim() ? lerDataPlanilha(valores.fim) : inicio;
    const rotulo = `${valores.tipo.trim() || '(sem tipo)'} — ${valores.inicio.trim() || '(sem data)'}${valores.fim.trim() && fim !== inicio ? ` a ${valores.fim.trim()}` : ''}`;
    if (!tipo) {
      erro(numero, rotulo, 'Tipo não reconhecido. Use os nomes da aba "Instruções".');
      continue;
    }

    if (tipo.tipo === 'etapa' || tipo.tipo === 'semestre') {
      const nome = tipo.tipo === 'etapa' ? nomeEtapaPlanilha(tipo.numero) : nomeSemestre(tipo.numero);
      const i = { inicio, fim };
      const erros = validarSequencia([nome], [i]);
      if (erros[0]) {
        erro(numero, rotulo, erros[0]);
        continue;
      }
      if (!valores.fim.trim()) {
        erro(numero, rotulo, 'Informe o término do período.');
        continue;
      }
      if (!doAno(i)) {
        erro(numero, rotulo, `Use datas de ${ano}.`);
        continue;
      }
      const antes = repetida(`${tipo.tipo}${tipo.numero}`, numero);
      if (antes) {
        erro(numero, rotulo, `${nome} já aparece na linha ${antes}.`);
        continue;
      }
      const lista = tipo.tipo === 'etapa' ? plano.etapas : plano.semestres;
      const atual = (tipo.tipo === 'etapa' ? existente.etapas : existente.semestres)[tipo.numero - 1] ?? null;
      lista[tipo.numero - 1] = i;
      linhaDoPeriodo.set(`${tipo.tipo}${tipo.numero}`, { numero, descricao: rotulo });
      plano.linhas.push({ numero, descricao: rotulo, situacao: !atual ? 'criar' : mesmoIntervalo(atual, i) ? 'igual' : 'atualizar' });
      continue;
    }

    if (tipo.tipo === 'sabado') {
      const dia = lerDiaSemana(valores.grade);
      const observacao = valores.descricao.trim() || null;
      const r = SabadoLetivoSchema.safeParse({ data: inicio, diaSemanaReferente: dia ? String(dia) : '', observacao: observacao ?? '' });
      if (!r.success || dia === null) {
        const msgs = r.success ? [] : r.error.issues.map((x) => x.message).filter((m) => !m.includes('dia da semana'));
        if (dia === null) msgs.push('Segue a grade de: use Segunda, Terça, Quarta, Quinta ou Sexta.');
        erro(numero, rotulo, [...new Set(msgs)].join(' '));
        continue;
      }
      if (!inicio.startsWith(`${ano}-`)) {
        erro(numero, rotulo, `Use datas de ${ano}.`);
        continue;
      }
      const antes = repetida(`sabado${inicio}`, numero);
      if (antes) {
        erro(numero, rotulo, `Repete o sábado da linha ${antes}.`);
        continue;
      }
      const descricao = `${rotulo} → grade de ${NOME_DIA[dia].toLowerCase()}`;
      const atual = sabadosPorData.get(inicio);
      if (!atual) {
        plano.sabadosCriar.push({ data: inicio, diaSemanaReferente: dia, observacao });
        plano.linhas.push({ numero, descricao, situacao: 'criar' });
      } else if (atual.diaSemanaReferente === dia && atual.observacao === observacao) {
        plano.linhas.push({ numero, descricao, situacao: 'igual' });
      } else {
        plano.sabadosAtualizar.push({ id: atual.id, diaSemanaReferente: dia, observacao });
        plano.linhas.push({ numero, descricao, situacao: 'atualizar' });
      }
      continue;
    }

    // Evento
    const suspende = lerAulas(valores.aulas, SUSPENDE_POR_PADRAO[tipo.evento]);
    const imprevisto = lerSimNao(valores.imprevisto);
    if (suspende === null || imprevisto === null) {
      erro(numero, rotulo, [suspende === null ? 'Aulas: use "Sem aula" ou "Mantidas".' : '', imprevisto === null ? 'Imprevisto: use Sim ou Não.' : ''].filter(Boolean).join(' '));
      continue;
    }
    const r = EventoSchema.safeParse({ tipo: tipo.evento, inicio, fim, descricao: valores.descricao, suspendeAulas: suspende, imprevisto, motivo: valores.motivo });
    if (!r.success) {
      erro(numero, rotulo, [...new Set(r.error.issues.map((x) => x.message))].join(' '));
      continue;
    }
    const d = r.data;
    if (!doAno(d)) {
      erro(numero, rotulo, `Use datas de ${ano}.`);
      continue;
    }
    const dados: DadosEventoPlano = {
      tipo: d.tipo,
      inicio: d.inicio,
      fim: d.fim,
      descricao: d.descricao || null,
      suspendeAulas: d.suspendeAulas,
      imprevisto: d.imprevisto,
      motivo: d.tipo === 'SUSPENSAO_AULAS' ? d.motivo : null,
    };
    const antes = repetida(`evento${chaveEvento(dados)}`, numero);
    if (antes) {
      erro(numero, rotulo, `Mesmo tipo e datas da linha ${antes}.`);
      continue;
    }
    const atual = eventosPorChave.get(chaveEvento(dados));
    if (!atual) {
      plano.eventosCriar.push(dados);
      plano.linhas.push({ numero, descricao: rotulo, situacao: 'criar' });
    } else if (atual.descricao === dados.descricao && atual.suspendeAulas === dados.suspendeAulas && atual.imprevisto === dados.imprevisto && atual.motivo === dados.motivo) {
      plano.linhas.push({ numero, descricao: rotulo, situacao: 'igual' });
    } else {
      plano.eventosAtualizar.push({ id: atual.id, ...dados });
      plano.linhas.push({ numero, descricao: rotulo, situacao: 'atualizar' });
    }
  }

  // Sequência das etapas e dos semestres já com o que a planilha muda.
  const conferir = (tipo: 'etapa' | 'semestre', novos: (Intervalo | null)[], atuais: readonly (Intervalo | null)[], rotulos: string[]) => {
    const finais = novos.map((x, i) => x ?? atuais[i] ?? null);
    for (const [k, msg] of Object.entries(validarSequencia(rotulos, finais))) {
      const onde = linhaDoPeriodo.get(`${tipo}${Number(k) + 1}`) ?? [...linhaDoPeriodo.entries()].find(([c]) => c.startsWith(tipo))?.[1];
      if (!onde) continue;
      const linha = plano.linhas.find((l) => l.numero === onde.numero);
      if (linha) Object.assign(linha, { situacao: 'erro', detalhe: `${msg} Confira também os períodos já cadastrados.` });
      plano.temErros = true;
    }
  };
  conferir('etapa', plano.etapas, existente.etapas, ETAPAS.map(nomeEtapa));
  conferir('semestre', plano.semestres, existente.semestres, ['1º semestre', '2º semestre']);

  // Períodos iguais não precisam ser gravados.
  plano.etapas = plano.etapas.map((x, i) => (x && !mesmoIntervalo(x, existente.etapas[i] ?? null) ? x : null));
  plano.semestres = plano.semestres.map((x, i) => (x && !mesmoIntervalo(x, existente.semestres[i] ?? null) ? x : null));
  plano.mudancas =
    plano.etapas.filter(Boolean).length +
    plano.semestres.filter(Boolean).length +
    plano.eventosCriar.length +
    plano.eventosAtualizar.length +
    plano.sabadosCriar.length +
    plano.sabadosAtualizar.length;
  return plano;
}

/** Linhas da planilha (exportação e modelo pré-preenchido) a partir do calendário cadastrado. */
export function linhasDoCalendario(cal: CalendarioExistente): string[][] {
  const linhas: { ordem: string; l: string[] }[] = [];
  const vazio = (n: number) => Array<string>(n).fill('');
  cal.etapas.forEach((e, i) => e && linhas.push({ ordem: `0${e.inicio}`, l: [nomeEtapaPlanilha(i + 1), formatarData(e.inicio), formatarData(e.fim), ...vazio(5)] }));
  cal.semestres.forEach((s, i) => s && linhas.push({ ordem: `1${s.inicio}`, l: [nomeSemestre(i + 1), formatarData(s.inicio), formatarData(s.fim), ...vazio(5)] }));
  for (const e of cal.eventos) {
    linhas.push({
      ordem: `2${e.inicio}`,
      l: [
        NOME_TIPO_EVENTO[e.tipo],
        formatarData(e.inicio),
        formatarData(e.fim),
        e.descricao ?? '',
        e.motivo ?? '',
        e.suspendeAulas ? SEM_AULA : MANTIDAS,
        e.imprevisto ? 'Sim' : 'Não',
        '',
      ],
    });
  }
  for (const s of cal.sabados) {
    linhas.push({ ordem: `2${s.data}`, l: [TIPO_SABADO, formatarData(s.data), '', s.observacao ?? '', '', '', '', NOME_DIA[s.diaSemanaReferente]] });
  }
  return linhas.sort((a, b) => a.ordem.localeCompare(b.ordem)).map((x) => x.l);
}

export const INSTRUCOES_CALENDARIO = [
  'Calendário acadêmico — SGC-Redes',
  'Esta planilha serve para exportar e para importar o calendário de um ano letivo. Baixe-a em Calendário › Planilha, edite no Excel ou LibreOffice e envie em Calendário › Importar planilha. Antes de gravar, o sistema mostra a prévia.',
  'Uma linha por item. Tipo: "Etapa N1" a "Etapa N4", "1º semestre", "2º semestre", "Sábado letivo" ou um tipo de evento:',
  ...TIPOS_EVENTO.map((t) => `   • ${NOME_TIPO_EVENTO[t]}${SUSPENDE_POR_PADRAO[t] ? ' (por padrão, sem aula)' : ''}`),
  'Início e Término: dd/mm/aaaa. Término vazio = um dia só (obrigatório para etapas e semestres). Eventos de até 120 dias.',
  'Descrição: nome do feriado, da reunião etc. (obrigatória no tipo "Outro"). No sábado letivo, vira a observação.',
  `Motivo: só para "${NOME_TIPO_EVENTO.SUSPENSAO_AULAS}" — ${MOTIVOS_SUSPENSAO.join(', ')}.`,
  'Aulas: "Sem aula" (o dia sai da contagem de dias letivos) ou "Mantidas". Vazio = padrão do tipo.',
  'Imprevisto: "Sim" para alteração não prevista (dias a repor). Vazio = Não.',
  'Segue a grade de: só para sábado letivo — Segunda, Terça, Quarta, Quinta ou Sexta.',
  'Itens já cadastrados (mesma etapa, mesmo sábado, ou evento do mesmo tipo com as mesmas datas) são atualizados; nada é excluído pela planilha. Máximo de 500 linhas.',
  'Para montar o calendário de outro ano, baixe a planilha do ano anterior, troque as datas e importe escolhendo o novo ano.',
];
