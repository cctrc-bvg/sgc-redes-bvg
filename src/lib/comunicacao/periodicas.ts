/**
 * Mensagens periódicas aos docentes (RF08-A, G27): resumo semanal na sexta-feira, com as aulas da semana
 * seguinte, as mudanças e os prazos calculados pelo calendário. Regras puras; os dados vêm de `periodicas-servidor`.
 */
import { diaDaSemanaISO, somarDiasISO } from '@/lib/calendario/regras';
import { COORDENACAO_CURSO } from '@/lib/reposicao/regras';

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
  if (d.reposicoes.length > 0) L.push(`  Já repôs? Informe no SGC-Redes (Reposição de aulas) ou envie o formulário pelo e-mail institucional para ${COORDENACAO_CURSO.email}.`);

  L.push('', 'Qualquer dúvida, é só responder. Obrigado!', 'Coordenação do Curso Técnico em Redes de Computadores');
  return { assunto: `[SGC-Redes] Resumo da semana — ${br(d.segunda)} a ${br(sexta)}`, texto: L.join('\n') };
}

// ---------------------------------------------------------------------------------------------------------------
// Avisos próprios do período (G27): fim de etapa e fechamento do semestre. Cada docente recebe um de cada.
// ---------------------------------------------------------------------------------------------------------------

/** O aviso de etapa começa a aparecer 7 dias antes do fim dela; o de fechamento, 14 dias antes do fim do semestre. */
export const DIAS_ANTECEDENCIA_ETAPA = 7;
export const DIAS_ANTECEDENCIA_FECHAMENTO = 14;

export interface AvisoDoPeriodo {
  /** "etapa:2026:2" ou "fechamento:2026:1". */
  id: string;
  tipo: 'ETAPA' | 'FECHAMENTO';
  /** Etapa (1 a 4) ou semestre (1 ou 2). */
  numero: number;
  /** Semestre letivo a que o aviso se refere (define as ofertas que entram). */
  semestre: number;
  fim: string;
  entregaAte: string | null;
}

type Intervalo = { inicio: string; fim: string } | null;

/** Avisos que a Coordenação deve preparar hoje: etapas perto do fim (até a entrega) e semestre perto de fechar. */
export function avisosDoPeriodo(ano: number, etapas: readonly Intervalo[], semestres: readonly Intervalo[], letivos: readonly string[], hojeISO: string): AvisoDoPeriodo[] {
  const lista: AvisoDoPeriodo[] = [];
  etapas.forEach((e, i) => {
    if (!e) return;
    const entregaAte = nesimoDiaLetivoDepois(e.fim, letivos, DIAS_LETIVOS_ENTREGA_ETAPA);
    const limite = entregaAte ?? somarDiasISO(e.fim, 7);
    if (hojeISO >= somarDiasISO(e.fim, -DIAS_ANTECEDENCIA_ETAPA) && hojeISO <= limite) {
      lista.push({ id: `etapa:${ano}:${i + 1}`, tipo: 'ETAPA', numero: i + 1, semestre: i < 2 ? 1 : 2, fim: e.fim, entregaAte });
    }
  });
  semestres.forEach((s, i) => {
    if (!s) return;
    if (hojeISO >= somarDiasISO(s.fim, -DIAS_ANTECEDENCIA_FECHAMENTO) && hojeISO <= s.fim) {
      lista.push({ id: `fechamento:${ano}:${i + 1}`, tipo: 'FECHAMENTO', numero: i + 1, semestre: i + 1, fim: s.fim, entregaAte: null });
    }
  });
  return lista;
}

/** Chave de envio: uma por aviso e por docente (não repete). */
export const chaveAviso = (avisoId: string, userId: string) => `aviso:${avisoId}:${userId}`;

const lista = (itens: readonly string[]) => itens.map((i) => `- ${i}`);

export function avisoFimDeEtapa(d: { nome: string; etapa: number; fim: string; entregaAte: string | null; hojeISO: string; disciplinas: readonly string[] }): { assunto: string; texto: string } {
  const encerrada = d.hojeISO > d.fim;
  const L = [`Olá, ${d.nome}!`, ''];
  L.push(
    encerrada
      ? `A N${d.etapa} terminou em ${br(d.fim)}.`
      : d.hojeISO === d.fim
        ? `Hoje, ${br(d.fim)}, é o último dia da N${d.etapa}.`
        : `A N${d.etapa} termina em ${br(d.fim)}.`,
  );
  L.push(
    d.entregaAte
      ? `A entrega dos diários e das notas vai até ${br(d.entregaAte)} (5 dias letivos depois do fim da etapa, ROD, Art. 171, XIX).`
      : 'A entrega dos diários e das notas é em até 5 dias letivos depois do fim da etapa (ROD, Art. 171, XIX).',
  );
  if (d.disciplinas.length > 0) L.push('', '*Suas disciplinas*', ...lista(d.disciplinas));
  L.push('', 'No SGC-Redes (Diários), confira as aulas dadas de cada disciplina antes de entregar. Reposições de aulas dispensadas também precisam ser concluídas no prazo.');
  L.push('', 'Qualquer dúvida, é só responder. Obrigado!', 'Coordenação do Curso Técnico em Redes de Computadores');
  return { assunto: `[SGC-Redes] Fim da N${d.etapa}: entrega dos diários até ${d.entregaAte ? br(d.entregaAte) : 'o prazo'}`, texto: L.join('\n') };
}

export function avisoFechamento(d: {
  nome: string;
  semestre: number;
  ano: number;
  fim: string;
  disciplinas: readonly string[];
  reposicoes: readonly { dataAula: string; disciplina: string; turma: string }[];
}): { assunto: string; texto: string } {
  const L = [`Olá, ${d.nome}!`, '', `O semestre ${d.ano}.${d.semestre} termina em ${br(d.fim)}.`];
  if (d.disciplinas.length > 0) L.push('', '*Suas disciplinas*', ...lista(d.disciplinas));
  const pendencias = [
    'Conferir no SGC-Redes (Diários) se as aulas dadas e o conteúdo estão completos.',
    'Entregar o diário e as notas da última etapa no prazo (5 dias letivos depois do fim dela).',
    ...d.reposicoes.map((r) => `Concluir a reposição de ${r.disciplina} (${r.turma}), aula de ${br(r.dataAula)}, e informá-la no sistema (Reposição de aulas).`),
  ];
  L.push('', '*Antes do fechamento*', ...lista(pendencias));
  L.push('', 'Qualquer dúvida, é só responder. Obrigado!', 'Coordenação do Curso Técnico em Redes de Computadores');
  return { assunto: `[SGC-Redes] Fechamento do semestre ${d.ano}.${d.semestre}: ${br(d.fim)}`, texto: L.join('\n') };
}
