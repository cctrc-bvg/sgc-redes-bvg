import 'server-only';
import { prisma } from '@/lib/db';
import { intervaloDoDia } from '@/lib/ausencias/servidor';
import { diaDaSemana } from '@/lib/comunicacao/modelos';
import { mensagensDeAlimentacao, type Gatilho } from './mensagens';

/** Avisos ativos do dia (todas as turmas) e as mensagens prontas para os setores. */
export async function mensagensDoDia(dataISO: string, gatilho: Gatilho | null) {
  const [alertas, canais] = await Promise.all([
    prisma.alertaAlimentacao.findMany({
      where: { dataRefeicao: intervaloDoDia(dataISO), canceladoEm: null },
      orderBy: [{ turma: { codigo: 'asc' } }, { dataRefeicao: 'asc' }],
      include: { turma: { select: { codigo: true } } },
    }),
    prisma.configuracaoCanal.findMany({ select: { canal: true, email: true, saudacao: true, ativo: true } }),
  ]);
  const mensagens = mensagensDeAlimentacao({
    dataISO,
    diaSemana: diaDaSemana(dataISO) ?? '',
    avisos: alertas.map((a) => ({
      codigoTurma: a.turma.codigo,
      tipo: a.tipoRefeicao,
      acao: a.acao,
      quantidade: a.qtdImpactada,
      nivel: a.nivelSla,
      manual: a.manual,
      descricao: a.descricao,
      confirmado: a.confirmadoAE,
    })),
    canais,
    gatilho,
  });
  return { alertas, mensagens };
}
