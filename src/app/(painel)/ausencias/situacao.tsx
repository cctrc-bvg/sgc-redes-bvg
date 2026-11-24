import type { StatusAusencia } from '@prisma/client';
import { NOME_STATUS } from '@/lib/ausencias/regras';

/** Situação da ausência sempre com ícone + texto (não só cor). */
const ESTILO: Record<StatusAusencia, { icone: string; classe: string }> = {
  PENDENTE_DECISAO: { icone: '⚠', classe: 'bg-amber-100 text-amber-900' },
  COBERTA_POR_SUBSTITUICAO: { icone: '✔', classe: 'bg-if-verde-50 text-if-verde-800' },
  AULA_ADIANTADA: { icone: '✔', classe: 'bg-if-verde-50 text-if-verde-800' },
  TURMA_DISPENSADA: { icone: '⏹', classe: 'bg-slate-200 text-slate-800' },
  REPOSICAO_AGENDADA: { icone: '↻', classe: 'bg-slate-200 text-slate-800' },
};

export function SituacaoAusencia({ status }: { status: StatusAusencia }) {
  const e = ESTILO[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.classe}`}>
      <span aria-hidden="true">{e.icone}</span> {NOME_STATUS[status]}
    </span>
  );
}
