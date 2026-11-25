import 'server-only';
import { prisma } from '@/lib/db';
import { dataDoBanco, dataParaBanco } from '@/lib/ausencias/regras';
import { carregarAno } from '@/lib/calendario/servidor';
import { prazoDeReposicao, somarDiasISO, type PrazoReposicao } from '@/lib/calendario/regras';
import { situacaoReposicao, type SituacaoReposicao } from './regras';

export interface LinhaReposicao {
  id: string;
  dataAula: string;
  docente: string;
  docenteId: string;
  disciplina: string;
  turma: string;
  situacao: SituacaoReposicao;
  prazo: PrazoReposicao | null;
  vencida: boolean;
  reposicaoEm: string | null;
  origem: 'DOCENTE' | 'COORDENACAO' | null;
  observacao: string | null;
  anexos: { id: string; nome: string; tamanho: number }[];
}

const ORDEM: Record<SituacaoReposicao, number> = { 'aguarda-ciencia': 0, pendente: 1, agendada: 2, reposta: 3 };

/**
 * Reposições dos últimos 120 dias: as dispensas ainda sem reposição (pendentes ou agendadas), as informadas e as
 * repostas. `docenteId` limita ao docente (quem não é Coordenação vê só as suas).
 */
export async function listarReposicoes(hojeISO: string, docenteId?: string): Promise<LinhaReposicao[]> {
  const desde = dataParaBanco(somarDiasISO(hojeISO, -120));
  const ausencias = await prisma.ausenciaDocente.findMany({
    where: {
      dataAula: { gte: desde },
      ...(docenteId ? { professorAusenteId: docenteId } : {}),
      OR: [{ status: { in: ['TURMA_DISPENSADA', 'REPOSICAO_AGENDADA'] } }, { reposicaoEm: { not: null } }],
    },
    select: {
      id: true,
      dataAula: true,
      status: true,
      reposicaoEm: true,
      reposicaoOrigem: true,
      reposicaoObservacao: true,
      reposicaoCienteEm: true,
      professorAusente: { select: { id: true, nome: true } },
      oferta: { select: { disciplina: { select: { nome: true } }, turma: { select: { codigo: true } } } },
      anexosReposicao: { select: { id: true, nome: true, tamanho: true }, orderBy: { criadoEm: 'asc' } },
    },
  });
  const anos = [...new Set(ausencias.map((a) => dataDoBanco(a.dataAula).slice(0, 4)))];
  const calendarios = new Map(await Promise.all(anos.map(async (a) => [a, await carregarAno(Number(a))] as const)));
  const linhas = ausencias.map((a) => {
    const dataAula = dataDoBanco(a.dataAula);
    const cal = calendarios.get(dataAula.slice(0, 4))!;
    const reposicaoEm = a.reposicaoEm ? dataDoBanco(a.reposicaoEm) : null;
    const situacao = situacaoReposicao({ status: a.status, reposicaoEm, reposicaoCienteEm: a.reposicaoCienteEm });
    const prazo = prazoDeReposicao(dataAula, cal.contagem.letivos, cal.etapas);
    return {
      id: a.id,
      dataAula,
      docente: a.professorAusente.nome,
      docenteId: a.professorAusente.id,
      disciplina: a.oferta.disciplina.nome,
      turma: a.oferta.turma.codigo,
      situacao,
      prazo,
      vencida: !reposicaoEm && prazo !== null && prazo.prazo < hojeISO,
      reposicaoEm,
      origem: a.reposicaoOrigem,
      observacao: a.reposicaoObservacao,
      anexos: a.anexosReposicao,
    };
  });
  return linhas.sort((x, y) => ORDEM[x.situacao] - ORDEM[y.situacao] || (x.prazo?.prazo ?? '9').localeCompare(y.prazo?.prazo ?? '9') || x.dataAula.localeCompare(y.dataAula));
}
