/**
 * Previsão de refeições por turma num dia (RF03), para o painel da Assistência Estudantil.
 * Base: turnos com aula na grade (RN01) × média da turma. Ajuste: avisos ativos (cancelar/adicionar).
 */
import type { AcaoAlimentacao, TipoRefeicao } from '@prisma/client';
import { calcularRefeicoesPrevistas, type PresencaTurnos } from '@/lib/alimentacao-engine';

export const REFEICOES: readonly TipoRefeicao[] = ['LANCHE_MANHA', 'ALMOCO', 'LANCHE_TARDE'];

export type Quantidades = Record<TipoRefeicao, number>;

export interface AvisoAtivo {
  tipoRefeicao: TipoRefeicao;
  acao: AcaoAlimentacao;
  qtdImpactada: number;
}

export interface PrevisaoTurma {
  /** Refeição prevista pela grade (RN01). */
  prevista: Record<TipoRefeicao, boolean>;
  base: Quantidades;
  final: Quantidades;
}

const zeros = (): Quantidades => ({ LANCHE_MANHA: 0, ALMOCO: 0, LANCHE_TARDE: 0 });

/**
 * Quantidade final = base − cancelamentos + acréscimos, nunca abaixo de zero. Um cancelamento com a
 * quantidade padrão zera a refeição; com quantidade menor (G04: quem espera o ônibus) mantém o restante.
 */
export function preverRefeicoesDaTurma(presenca: PresencaTurnos, medias: Quantidades, avisos: readonly AvisoAtivo[]): PrevisaoTurma {
  const previstas = new Set(calcularRefeicoesPrevistas(presenca));
  const prevista = { LANCHE_MANHA: false, ALMOCO: false, LANCHE_TARDE: false };
  const base = zeros();
  for (const r of REFEICOES) {
    prevista[r] = previstas.has(r);
    base[r] = prevista[r] ? medias[r] : 0;
  }
  const final = { ...base };
  for (const a of avisos) {
    final[a.tipoRefeicao] += a.acao === 'CANCELAR_REFEICAO' ? -a.qtdImpactada : a.qtdImpactada;
  }
  for (const r of REFEICOES) final[r] = Math.max(0, final[r]);
  return { prevista, base, final };
}

export function somarQuantidades(lista: readonly Quantidades[]): Quantidades {
  const total = zeros();
  for (const q of lista) for (const r of REFEICOES) total[r] += q[r];
  return total;
}

/** Quantidade editável do aviso (G04): de 0 até o limite de estudantes por turma. */
export function lerQuantidade(valor: unknown, maximo: number): number | null {
  if (typeof valor !== 'string' || !/^\d{1,3}$/.test(valor.trim())) return null;
  const n = Number(valor.trim());
  return n <= maximo ? n : null;
}
