/**
 * Textos para comunicar uma alteração no calendário (feriado, ponto facultativo, suspensão por força maior…)
 * a docentes, CAE, nutricionista, Gestão, CTP e turmas. Sem dados pessoais.
 */
import type { CanalWhatsapp, TipoEventoCalendario } from '@prisma/client';
import { formatarData } from '@/lib/ausencias/regras';
import { diaDaSemana } from '@/lib/comunicacao/modelos';
import { NOME_TIPO_EVENTO } from './regras';

export interface EventoComunicavel {
  tipo: TipoEventoCalendario;
  inicio: string;
  fim: string;
  descricao: string | null;
  motivo: string | null;
  suspendeAulas: boolean;
  imprevisto: boolean;
}

/** Destinos, na ordem de envio: quem prepara refeições primeiro, depois docentes, gestão e turmas. */
export const DESTINOS_CALENDARIO: { destino: string; publico: 'cae' | 'docentes' | 'gestao' | 'ctp' | 'turmas' }[] = [
  { destino: 'canal:ASSISTENCIA_ESTUDANTIL', publico: 'cae' },
  { destino: 'canal:NUTRICIONISTA', publico: 'cae' },
  { destino: 'docentes:todos', publico: 'docentes' },
  { destino: 'canal:GRUPO_GESTAO_DIR_COORD', publico: 'gestao' },
  { destino: 'canal:CTP', publico: 'ctp' },
  { destino: 'canal:LIDERES_TURMA', publico: 'turmas' },
];
export type PublicoCalendario = (typeof DESTINOS_CALENDARIO)[number]['publico'];

/** Alteração que pede comunicação imediata (não prevista no calendário aprovado). */
export const pedeComunicacao = (e: Pick<EventoComunicavel, 'tipo' | 'imprevisto'>) => e.imprevisto || e.tipo === 'SUSPENSAO_AULAS';

export function periodoDoEvento(e: Pick<EventoComunicavel, 'inicio' | 'fim'>): string {
  const dia = (d: string) => `${formatarData(d)} (${diaDaSemana(d) ?? ''})`.replace(' ()', '');
  return e.fim === e.inicio ? dia(e.inicio) : `${dia(e.inicio)} a ${dia(e.fim)}`;
}

export function assuntoDoEvento(e: EventoComunicavel): string {
  const o_que = e.tipo === 'AVALIACOES_FINAIS' ? 'Avaliações finais' : e.suspendeAulas ? 'Sem aulas' : NOME_TIPO_EVENTO[e.tipo];
  return `[SGC-Redes] ${e.imprevisto ? 'Alteração no calendário: ' : 'Calendário: '}${o_que} — ${e.fim === e.inicio ? formatarData(e.inicio) : `${formatarData(e.inicio)} a ${formatarData(e.fim)}`}`;
}

/** Corpo da mensagem (sem saudação: quem monta a mensagem acrescenta a do destinatário). */
export function textoDoEvento(e: EventoComunicavel, publico: PublicoCalendario): string {
  const nome = [NOME_TIPO_EVENTO[e.tipo], e.descricao, e.motivo].filter(Boolean).join(' — ');
  const linhas = [
    `*${e.imprevisto ? 'ALTERAÇÃO NO CALENDÁRIO ACADÊMICO' : 'CALENDÁRIO ACADÊMICO'} — COORD. REDES DE COMPUTADORES*`,
    `${e.fim === e.inicio ? 'Data' : 'Período'}: *${periodoDoEvento(e)}*`,
    `Motivo: ${nome}`,
  ];
  // Avaliações finais (ROD, Arts. 32 e 105): fim do ano, fora dos dias letivos, sem aula regular.
  if (e.tipo === 'AVALIACOES_FINAIS') {
    linhas.push('Período de *avaliações finais*: não há aulas regulares e os dias não contam como letivos.');
    if (publico === 'cae') linhas.push('Não há refeições previstas pela grade. Se houver estudantes no campus para as avaliações, a Coordenação informará os acréscimos por dia.');
    if (publico === 'docentes') linhas.push('Apliquem as avaliações finais conforme o cronograma (no mínimo 3 dias letivos após o registro da média parcial, ROD Art. 105) e entreguem os diários.');
    if (publico === 'gestao') linhas.push('O período já está fora da contagem de dias letivos (ROD, Art. 32).');
    if (publico === 'ctp') linhas.push('Período de avaliações finais do ano letivo.');
    if (publico === 'turmas') linhas.push('Repassem à turma o cronograma das avaliações finais, por favor.');
    linhas.push('_Calendário atualizado no SGC-Redes._');
    return linhas.join('\n');
  }
  linhas.push(e.suspendeAulas ? '*Não haverá aulas* no curso técnico integrado em Redes de Computadores.' : 'As aulas estão *mantidas*.');
  if (e.suspendeAulas) {
    if (publico === 'cae') linhas.push('As refeições (lanches e almoço) das turmas de Redes não serão necessárias nesse período. Por favor, ajustem a produção.');
    if (publico === 'docentes') linhas.push(e.imprevisto ? 'As aulas serão repostas conforme orientação da Coordenação (sábado letivo ou outra data). Registrem a ocorrência nos diários.' : 'Ajustem o planejamento e os diários.');
    if (publico === 'gestao') linhas.push(e.imprevisto ? 'O dia sai da contagem de dias letivos e precisará ser reposto.' : 'O dia já está fora da contagem de dias letivos.');
    if (publico === 'ctp') linhas.push('Atendimentos e avaliações previstos para o período precisam ser remarcados.');
    if (publico === 'turmas') linhas.push('Repassem à turma, por favor. Avisaremos a data de reposição.');
  } else if (publico === 'turmas') {
    linhas.push('Repassem à turma, por favor.');
  }
  linhas.push('_Calendário atualizado no SGC-Redes._');
  return linhas.join('\n');
}
