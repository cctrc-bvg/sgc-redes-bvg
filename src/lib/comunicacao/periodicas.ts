/**
 * Mensagens periódicas aos docentes (RF08-A, G27): resumo semanal na sexta-feira, com as aulas da semana
 * seguinte, as mudanças e os prazos calculados pelo calendário. Regras puras; os dados vêm de `periodicas-servidor`.
 */
import { diaDaSemanaISO, somarDiasISO } from '@/lib/calendario/regras';

/** Prazo para lançar a frequência de aula substituída (ROD, Art. 43). */
export const DIAS_LETIVOS_FREQUENCIA = 7;
/** Prazo de entrega da etapa depois do seu fim (ROD, Art. 171, XIX). */
export const DIAS_LETIVOS_ENTREGA_ETAPA = 5;

const NOME_DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const br = (iso: string) => iso.split('-').reverse().join('/');

/** Segunda-feira da semana seguinte a `hojeISO` (de sexta, o resumo é da semana que vem). */
export function proximaSegunda(hojeISO: string): string {
  const dia = diaDaSemanaISO(hojeISO); // 0=domingo
  return somarDiasISO(hojeISO, dia === 0 ? 1 : 8 - dia);
}

/** Segunda a sexta de uma semana, a partir da segunda. */
export const diasDaSemana = (segunda: string) => [0, 1, 2, 3, 4].map((i) => somarDiasISO(segunda, i));

/** O n-ésimo dia letivo depois de `dataISO` (ou null se o calendário não tem tantos dias). */
export function nesimoDiaLetivoDepois(dataISO: string, letivos: readonly string[], n: number): string | null {
  return letivos.filter((d) => d > dataISO)[n - 1] ?? null;
}

export interface PrazoEtapa {
  etapa: number;
  fim: string;
  entregaAte: string | null;
}

/**
 * Etapas que pedem aviso na semana: as que terminam até a sexta da semana e cuja entrega (5º dia letivo depois do
 * fim) ainda não passou na segunda. Quem já entregou a etapa anterior não recebe aviso dela.
 */
export function etapasComPrazo(etapas: readonly ({ inicio: string; fim: string } | null)[], letivos: readonly string[], segunda: string): PrazoEtapa[] {
  const sexta = somarDiasISO(segunda, 4);
  return etapas.flatMap((e, i) => {
    if (!e || e.fim > sexta) return [];
    const entregaAte = nesimoDiaLetivoDepois(e.fim, letivos, DIAS_LETIVOS_ENTREGA_ETAPA);
    if (entregaAte !== null && entregaAte < segunda) return [];
    return [{ etapa: i + 1, fim: e.fim, entregaAte }];
  });
}

export interface DadosResumo {
  nome: string;
  segunda: string;
  /** Um item por dia (segunda a sexta): motivo se não é dia letivo ou as aulas do docente. */
  dias: { data: string; semAula: string | null; aulas: { disciplina: string; turma: string; quantidade: number }[] }[];
  /** Aulas que o docente assume como substituto na semana. */
  substituicoes: { data: string; disciplina: string; turma: string; frequenciaAte: string | null }[];
  /** Ausências do próprio docente na semana, com a decisão da Coordenação. */
  ausencias: { data: string; disciplina: string; turma: string; situacao: string }[];
  /** Reposições pendentes: de qual aula e até quando. */
  reposicoes: { dataAula: string; disciplina: string; turma: string; ate: string }[];
  etapas: PrazoEtapa[];
}

/** Chave de envio: uma por docente e por semana (não repete). */
export const chaveResumoSemanal = (segunda: string, userId: string) => `resumo:${segunda}:${userId}`;

export function resumoSemanal(d: DadosResumo): { assunto: string; texto: string } {
  const sexta = somarDiasISO(d.segunda, 4);
  const L: string[] = [`Olá, ${d.nome}! Segue o resumo da semana de ${br(d.segunda)} a ${br(sexta)}.`, ''];

  L.push('*Suas aulas*');
  const comAula = d.dias.filter((x) => x.aulas.length > 0);
  if (comAula.length === 0 && d.dias.every((x) => x.semAula === null)) L.push('- Nenhuma aula na grade desta semana.');
  for (const x of d.dias) {
    const rotulo = `${NOME_DIA_CURTO[diaDaSemanaISO(x.data)]} ${br(x.data).slice(0, 5)}`;
    if (x.semAula) L.push(`- ${rotulo}: sem aula (${x.semAula}).`);
    else if (x.aulas.length > 0) L.push(`- ${rotulo}: ${x.aulas.map((a) => `${a.disciplina} (${a.turma}), ${a.quantidade} ${a.quantidade === 1 ? 'aula' : 'aulas'}`).join('; ')}.`);
  }

  const mudancas: string[] = [
    ...d.substituicoes.map((s) => `Você assume ${s.disciplina} (${s.turma}) em ${br(s.data)}.${s.frequenciaAte ? ` Lance a frequência até ${br(s.frequenciaAte)} (ROD, Art. 43).` : ''}`),
    ...d.ausencias.map((a) => `Sua aula de ${a.disciplina} (${a.turma}) em ${br(a.data)}: ${a.situacao.toLowerCase()}.`),
  ];
  if (mudancas.length > 0) L.push('', '*Mudanças*', ...mudancas.map((m) => `- ${m}`));

  const prazos: string[] = [
    ...d.reposicoes.map((r) => `Reposição de ${r.disciplina} (${r.turma}), aula de ${br(r.dataAula)}: até ${br(r.ate)} (ROD, Art. 37).`),
    ...d.etapas.map((e) =>
      e.entregaAte
        ? `N${e.etapa} termina em ${br(e.fim)}; entrega dos diários e notas até ${br(e.entregaAte)} (5 dias letivos, ROD, Art. 171, XIX).`
        : `N${e.etapa} termina em ${br(e.fim)}; a entrega é em 5 dias letivos (ROD, Art. 171, XIX).`,
    ),
  ];
  if (prazos.length > 0) L.push('', '*Prazos*', ...prazos.map((p) => `- ${p}`));

  L.push('', 'Qualquer dúvida, é só responder. Obrigado!', 'Coordenação do Curso Técnico em Redes de Computadores');
  return { assunto: `[SGC-Redes] Resumo da semana — ${br(d.segunda)} a ${br(sexta)}`, texto: L.join('\n') };
}
