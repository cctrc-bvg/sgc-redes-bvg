import 'server-only';
import { prisma } from '@/lib/db';
import { presencaPorTurno } from '@/lib/ausencias/regras';
import { carregarDia, intervaloDoDia } from '@/lib/ausencias/servidor';
import { mediasDaTurma, preverRefeicoesDaTurma, somarQuantidades, type Quantidades } from './previsao';

export interface TotaisDoDia {
  dataISO: string;
  /** Motivo de não haver aula (feriado, suspensão, fim de semana); null em dia com grade. */
  semAula: string | null;
  total: Quantidades;
  /** Avisos de alteração ativos na data (cancelamentos e acréscimos). */
  avisos: number;
}

/** Totais de refeições previstos para o dia, já com os avisos ativos (mesma conta da página de Alimentação). */
export async function totaisDoDia(dataISO: string): Promise<TotaisDoDia> {
  const [dia, turmas, avisos] = await Promise.all([
    carregarDia(dataISO),
    prisma.turma.findMany({
      where: { ativa: true },
      select: {
        id: true,
        qtdMediaLancheManha: true,
        qtdMediaAlmoco: true,
        qtdMediaLancheTarde: true,
      },
    }),
    prisma.alertaAlimentacao.findMany({
      where: { dataRefeicao: intervaloDoDia(dataISO), canceladoEm: null },
      select: {
        turmaId: true,
        tipoRefeicao: true,
        acao: true,
        qtdImpactada: true,
      },
    }),
  ]);
  const finais = turmas.map((t) => {
    const blocos = dia.aulasDoDia.filter((a) => a.turmaId === t.id).map((a) => a.blocoId);
    return preverRefeicoesDaTurma(
      presencaPorTurno(blocos, dia.blocos),
      mediasDaTurma(t),
      avisos.filter((a) => a.turmaId === t.id),
    ).final;
  });
  return {
    dataISO,
    semAula: dia.suspensao ? dia.suspensao.descricao : dia.diaSemana === null ? 'Sem aula' : null,
    total: somarQuantidades(finais),
    avisos: avisos.length,
  };
}
