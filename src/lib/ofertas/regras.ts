/**
 * Regras da distribuição de disciplinas (ofertas: turma × disciplina × professor por ano letivo).
 * Funções puras: a Server Action busca os dados, chama `planejarDistribuicao` e aplica o plano.
 */

import type { Role } from '@prisma/client';

/** Perfis que podem receber disciplinas (a Coordenação também leciona). */
export const PERFIS_DOCENTES: readonly Role[] = ['PROFESSOR', 'COORDENADOR'];

/** Nome do campo do formulário de distribuição: `professor:<disciplinaId>`. */
export const PREFIXO_CAMPO = 'professor:';

export const ANO_LETIVO_MINIMO = 2020;
export const ANO_LETIVO_MAXIMO = 2100;

/** Ano corrente no fuso de Fortaleza (evita virar o ano às 21h do dia 31 em servidor UTC). */
export function anoLetivoAtual(agora: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Fortaleza' }).format(agora));
}

/** Lê o ano letivo de um parâmetro de URL ou formulário; null se ausente ou fora da faixa. */
export function lerAnoLetivo(valor: unknown): number | null {
  if (typeof valor !== 'string' || !/^\d{4}$/.test(valor)) return null;
  const ano = Number(valor);
  return ano >= ANO_LETIVO_MINIMO && ano <= ANO_LETIVO_MAXIMO ? ano : null;
}

/**
 * Semestre letivo em que uma disciplina é ofertada. Técnicas são semestrais: semestres ímpares do
 * curso (1º, 3º, 5º) caem no 1º semestre do ano letivo e os pares no 2º. Anuais retornam null.
 */
export function semestreLetivoDaDisciplina(semestreCurso: number | null): 1 | 2 | null {
  if (semestreCurso === null) return null;
  return semestreCurso % 2 === 1 ? 1 : 2;
}

/** Ex.: "2026 (anual)", "2026.1". */
export function descreverPeriodoLetivo(anoLetivo: number, semestreLetivo: number | null): string {
  return semestreLetivo ? `${anoLetivo}.${semestreLetivo}` : `${anoLetivo} (anual)`;
}

export interface OfertaAtual {
  id: string;
  professorId: string;
  /** Já tem horários na grade ou ausências registradas: não pode ser removida. */
  emUso: boolean;
}

export interface PlanoDistribuicao {
  criar: { disciplinaId: string; professorId: string }[];
  alterar: { ofertaId: string; disciplinaId: string; professorAnterior: string; professorNovo: string }[];
  remover: { ofertaId: string; disciplinaId: string }[];
  /** Erro por disciplina. Se houver qualquer erro, nada deve ser gravado. */
  erros: Record<string, string>;
}

/**
 * Compara a distribuição atual de uma turma com a desejada (disciplinaId → professorId, ou "" para
 * "sem professor") e devolve o que criar, alterar e remover.
 *
 * - Só considera as disciplinas listadas em `desejado`, que a Server Action monta a partir do banco,
 *   nunca de ids arbitrários do formulário.
 * - Professor novo precisa estar em `professoresAptos` (ativo, perfil docente). Manter o professor
 *   atual é sempre permitido, mesmo que ele tenha sido desativado depois.
 * - Oferta com horários ou ausências não é removida: troque o professor em vez disso.
 */
export function planejarDistribuicao(params: {
  atuais: ReadonlyMap<string, OfertaAtual>;
  desejado: ReadonlyMap<string, string>;
  professoresAptos: ReadonlySet<string>;
}): PlanoDistribuicao {
  const plano: PlanoDistribuicao = { criar: [], alterar: [], remover: [], erros: {} };

  for (const [disciplinaId, professorId] of params.desejado) {
    const atual = params.atuais.get(disciplinaId);

    if (professorId === '') {
      if (!atual) continue;
      if (atual.emUso) {
        plano.erros[disciplinaId] = 'Já tem horários na grade ou ausências registradas; não pode ficar sem professor. Escolha outro professor.';
      } else {
        plano.remover.push({ ofertaId: atual.id, disciplinaId });
      }
      continue;
    }

    if (atual?.professorId === professorId) continue;
    if (!params.professoresAptos.has(professorId)) {
      plano.erros[disciplinaId] = 'Professor inválido ou desativado. Escolha outro na lista.';
      continue;
    }
    if (atual) {
      plano.alterar.push({ ofertaId: atual.id, disciplinaId, professorAnterior: atual.professorId, professorNovo: professorId });
    } else {
      plano.criar.push({ disciplinaId, professorId });
    }
  }
  return plano;
}

/** Resumo para a mensagem de sucesso. */
export function resumirPlano(plano: PlanoDistribuicao): string {
  const partes = [
    plano.criar.length && `${plano.criar.length} oferta(s) criada(s)`,
    plano.alterar.length && `${plano.alterar.length} professor(es) trocado(s)`,
    plano.remover.length && `${plano.remover.length} oferta(s) removida(s)`,
  ].filter(Boolean);
  return partes.length ? `Distribuição salva: ${partes.join(', ')}.` : 'Nenhuma alteração para salvar.';
}
