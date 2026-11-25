/**
 * Andamento do PEI depois de pronto: quais encontros já passaram sem registro e quando o docente deve lançar o
 * resultado (Art. 123). Funções puras; o servidor só busca os encontros.
 */

export interface EncontroAndamento {
  /** Data do encontro, "AAAA-MM-DD". */
  data: string;
  conteudo: string;
  realizado: boolean;
}

export interface AndamentoPei {
  /** Encontros com data já passada e ainda não marcados como realizados. */
  encontrosAConfirmar: number;
  /** Último dia do PEI: o último encontro ou a data da prorrogação (Art. 124), o que vier depois. */
  prazoFinal: string | null;
  /** Hora de lançar o resultado: todos os encontros feitos ou prazo final já passado. */
  prontoParaConcluir: boolean;
}

export function andamentoDoPei(encontros: readonly EncontroAndamento[], prorrogadoAte: string | null, hojeISO: string): AndamentoPei {
  if (encontros.length === 0) return { encontrosAConfirmar: 0, prazoFinal: prorrogadoAte, prontoParaConcluir: false };
  const ultimo = encontros.reduce((max, e) => (e.data > max ? e.data : max), encontros[0].data);
  const prazoFinal = prorrogadoAte && prorrogadoAte > ultimo ? prorrogadoAte : ultimo;
  const encontrosAConfirmar = encontros.filter((e) => e.data < hojeISO && !e.realizado).length;
  const todosFeitos = encontros.every((e) => e.realizado);
  return { encontrosAConfirmar, prazoFinal, prontoParaConcluir: todosFeitos || prazoFinal < hojeISO };
}

/**
 * Ao salvar o PEI de novo (o cronograma é regravado inteiro), mantém marcado como realizado o encontro que continua
 * com a mesma data e o mesmo conteúdo.
 */
export function manterRealizados<T extends { data: string; conteudo: string }>(
  novos: readonly T[],
  antigos: readonly EncontroAndamento[],
): (T & { realizado: boolean })[] {
  const feitos = new Set(antigos.filter((a) => a.realizado).map((a) => `${a.data}|${a.conteudo.trim()}`));
  return novos.map((n) => ({ ...n, realizado: feitos.has(`${n.data}|${n.conteudo.trim()}`) }));
}
