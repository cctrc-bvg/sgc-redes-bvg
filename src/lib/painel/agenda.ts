/**
 * Agenda do painel. Professor: a semana (aulas, sem-aula, eventos e mudanças). Funções puras e testáveis; o
 * servidor (servidor.ts) só busca os dados.
 */
import { codigoBloco, descreverBloco, formatarData, posicaoNoDia, somarDias, type BlocoDia } from '@/lib/ausencias/regras';
import { diaDaGradeNaData, NOME_DIA_EXTENSO } from '@/lib/grade/regras';

const SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const diaDaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** Segunda-feira da semana mostrada: a atual de segunda a sexta; no fim de semana, a próxima. */
export function inicioDaSemana(hojeISO: string): string {
  const d = diaDaSemana(hojeISO);
  if (d === 6) return somarDias(hojeISO, 2);
  if (d === 0) return somarDias(hojeISO, 1);
  return somarDias(hojeISO, 1 - d);
}

export interface EventoAgenda {
  inicio: string;
  fim: string;
  titulo: string;
  suspende: boolean;
}

export interface CelulaAgenda {
  diaSemana: number;
  bloco: BlocoDia;
  turma: string;
  disciplina: string;
}

export interface MudancaAgenda {
  dataISO: string;
  turma: string;
  bloco: string;
  tipo: 'substituicao' | 'adiantamento';
  detalhe: string;
}

export interface AulaDoDia {
  horario: string;
  /** Hora de início ("07:30"), para a lista compacta. */
  inicio: string;
  turma: string;
  disciplina: string;
  /** O próprio docente registrou ausência nesta aula. */
  ausente: boolean;
}

export interface DiaDaAgenda {
  dataISO: string;
  rotulo: string;
  ehHoje: boolean;
  /** Motivo de não haver aula (feriado, suspensão); null em dia com grade. */
  semAula: string | null;
  /** Sábado letivo: qual grade vale. */
  gradeDe: string | null;
  eventos: string[];
  aulas: AulaDoDia[];
  mudancas: MudancaAgenda[];
}

export interface EntradaSemana {
  hojeISO: string;
  sabados: ReadonlyMap<string, number>;
  eventos: readonly EventoAgenda[];
  /** Células do docente por período "ano.semestre" (a semana pode cruzar o fim de semestre). */
  celulas: ReadonlyMap<string, readonly CelulaAgenda[]>;
  /** Blocos com ausência registrada pelo docente, por data (códigos M1…T4). */
  ausencias: ReadonlyMap<string, ReadonlySet<string>>;
  mudancas: readonly MudancaAgenda[];
}

export const chavePeriodo = (iso: string) => `${iso.slice(0, 4)}.${Number(iso.slice(5, 7)) <= 6 ? 1 : 2}`;

/** Monta a semana do docente: segunda a sexta, mais o sábado quando é letivo ou tem mudança. */
export function montarSemana(e: EntradaSemana): DiaDaAgenda[] {
  const inicio = inicioDaSemana(e.hojeISO);
  const datas = [0, 1, 2, 3, 4, 5].map((n) => somarDias(inicio, n));
  const dias: DiaDaAgenda[] = [];
  for (const dataISO of datas) {
    const sabado = diaDaSemana(dataISO) === 6;
    const mudancas = e.mudancas.filter((m) => m.dataISO === dataISO);
    if (sabado && !e.sabados.has(dataISO) && mudancas.length === 0) continue;
    const doDia = e.eventos.filter((ev) => ev.inicio <= dataISO && ev.fim >= dataISO);
    const suspensao = doDia.find((ev) => ev.suspende);
    const grade = suspensao ? null : diaDaGradeNaData(dataISO, e.sabados);
    const ausentes = e.ausencias.get(dataISO) ?? new Set<string>();
    const aulas =
      grade === null
        ? []
        : [...(e.celulas.get(chavePeriodo(dataISO)) ?? [])]
            .filter((c) => c.diaSemana === grade)
            .sort((a, b) => posicaoNoDia(a.bloco) - posicaoNoDia(b.bloco))
            .map((c) => ({ horario: descreverBloco(c.bloco), inicio: c.bloco.horaInicio, turma: c.turma, disciplina: c.disciplina, ausente: ausentes.has(codigoBloco(c.bloco)) }));
    dias.push({
      dataISO,
      rotulo: `${SEMANA[diaDaSemana(dataISO)]}, ${formatarData(dataISO).slice(0, 5)}`,
      ehHoje: dataISO === e.hojeISO,
      semAula: suspensao ? suspensao.titulo : grade === null ? 'Sem aula' : null,
      gradeDe: sabado && grade !== null ? NOME_DIA_EXTENSO[grade] : null,
      eventos: doDia.filter((ev) => ev !== suspensao).map((ev) => ev.titulo),
      aulas,
      mudancas,
    });
  }
  return dias;
}

/** Título do evento: "Tipo: descrição", sem repetir quando a descrição já começa pelo tipo. */
export function tituloDoEvento(nomeTipo: string, descricao: string | null): string {
  if (!descricao) return nomeTipo;
  const base = (t: string) => t.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[^a-z ]/g, '').split(' ').slice(0, 2).join(' ');
  return base(descricao) === base(nomeTipo) ? descricao : `${nomeTipo}: ${descricao}`;
}

/** Eventos dos próximos dias, para a agenda dos demais perfis. */
export function proximosEventos(eventos: readonly EventoAgenda[], hojeISO: string, dias = 30, limite = 6): EventoAgenda[] {
  const ate = somarDias(hojeISO, dias);
  return eventos
    .filter((e) => e.fim >= hojeISO && e.inicio <= ate)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, limite);
}

/** "25/11" ou "25/11 a 28/11". */
export function periodoCurto(e: Pick<EventoAgenda, 'inicio' | 'fim'>): string {
  const a = formatarData(e.inicio).slice(0, 5);
  return e.fim === e.inicio ? a : `${a} a ${formatarData(e.fim).slice(0, 5)}`;
}
