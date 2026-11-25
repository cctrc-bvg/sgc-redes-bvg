import 'server-only';
import { chaveAula, datasDoPeriodo, descreverBloco, DIAS_MAXIMOS_PERIODO, formatarData, posicaoNoDia } from './regras';
import { carregarDia } from './servidor';

/** Uma aula do docente que pode ser marcada como ausência. */
export interface AulaOpcao {
  chave: string;
  rotulo: string;
  detalhe: string;
  jaRegistrada: boolean;
}

/** Aulas de um dia; `titulo` só no registro por período (vários dias). */
export interface DiaOpcao {
  dataISO: string;
  titulo: string | null;
  aulas: AulaOpcao[];
}

const diaDaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' });

/**
 * Aulas do docente na data (ou no período "até", de até 15 dias) pela grade vigente e pelo calendário, para o
 * registro pela Coordenação (/ausencias/nova) e para o docente informar a própria ausência (/ausencias/informar).
 * No período, a chave de cada aula leva a data ("AAAA-MM-DD#oferta|bloco").
 */
export async function aulasParaRegistro(professorId: string | null, dataISO: string, ateParam?: string) {
  const ate = ateParam && ateParam > dataISO ? ateParam : '';
  const periodo = datasDoPeriodo(dataISO, ate);
  const datas = periodo ?? [dataISO];
  const carregados = await Promise.all(datas.map((d) => carregarDia(d)));
  const varios = datas.length > 1;
  const dias: DiaOpcao[] = carregados.map((d) => {
    const pos = new Map(d.blocos.map((b) => [b.id, b]));
    const registradas = new Set(d.ausencias.flatMap((a) => a.blocoIds.map((b) => `${a.ofertaId}|${b}`)));
    const nome = diaDaSemana.format(new Date(`${d.dataISO}T12:00:00Z`));
    return {
      dataISO: d.dataISO,
      titulo: varios ? `${nome.charAt(0).toUpperCase()}${nome.slice(1)}, ${formatarData(d.dataISO)}` : null,
      aulas: !professorId
        ? []
        : d.aulasDoDia
            .filter((a) => a.professorId === professorId)
            .sort((x, y) => posicaoNoDia(pos.get(x.blocoId)!) - posicaoNoDia(pos.get(y.blocoId)!))
            .map((a) => ({
              chave: varios ? `${d.dataISO}#${chaveAula(a)}` : chaveAula(a),
              rotulo: descreverBloco(pos.get(a.blocoId)!),
              detalhe: `${a.turma} · ${a.disciplina}`,
              jaRegistrada: registradas.has(chaveAula(a)),
            })),
    };
  });
  return {
    /** Primeiro dia carregado: lista de docentes, suspensão e sábado letivo. */
    diaInicial: carregados[0],
    datas,
    varios,
    erroPeriodo: periodo ? null : `Use no máximo ${DIAS_MAXIMOS_PERIODO} dias, com o fim depois do início.`,
    dias,
    /** Dias com pelo menos uma aula ainda sem ausência. */
    comAulasLivres: dias.filter((d) => d.aulas.some((a) => !a.jaRegistrada)),
  };
}
