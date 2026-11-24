import 'server-only';
import { prisma } from '@/lib/db';
import { dataDoBanco } from '@/lib/ausencias/regras';
import { NOME_STATUS_PPE } from '@/lib/ppe/regras';
import { NOME_STATUS_PPI } from '@/lib/ppi/regras';
import { contarPor, NIVEIS_SLA, ORDEM_STATUS_PPE, ORDEM_STATUS_PPI, resumoMensalAusencias, totalizar } from './agregacoes';


/** Números consolidados do ano para a tela, a impressão (PDF) e a planilha. Sem nomes nem motivos (LGPD). */
export async function carregarRelatorio(ano: number) {
  const inicio = new Date(Date.UTC(ano, 0, 1));
  const fim = new Date(Date.UTC(ano + 1, 0, 1));
  const [ausencias, ppes, ppis, alertas] = await Promise.all([
    prisma.ausenciaDocente.findMany({
      where: { dataAula: { gte: inicio, lt: fim } },
      select: { dataAula: true, status: true, blocosAfetados: true, coberturas: { select: { tipo: true } } },
    }),
    prisma.registroPPE.findMany({ where: { semestre: { startsWith: `${ano}.` } }, select: { status: true, modalidade: true, alertaRetencao: true, matricula: true } }),
    prisma.ppiSolicitacao.findMany({ select: { status: true, totalValidado: true, metaHoras: true } }),
    prisma.alertaAlimentacao.findMany({ where: { dataRefeicao: { gte: inicio, lt: fim }, canceladoEm: null }, select: { nivelSla: true, acao: true } }),
  ]);
  const linhas = resumoMensalAusencias(
    ausencias.map((a) => ({
      mes: dataDoBanco(a.dataAula).slice(0, 7),
      status: a.status,
      coberturas: a.coberturas.map((c) => c.tipo),
      blocos: a.blocosAfetados.split(',').filter(Boolean).length,
    })),
  );
  const sla = contarPor(
    alertas.map((a) => a.nivelSla),
    NIVEIS_SLA.map((n) => n.chave),
  );
  return {
    ano,
    linhas,
    total: totalizar(linhas),
    alertas: alertas.length,
    sla: NIVEIS_SLA.map((n, i) => ({ ...n, total: sla[i].total })),
    ppes: ppes.length,
    ppePorStatus: contarPor(ppes.map((p) => p.status), ORDEM_STATUS_PPE).map((p) => ({ rotulo: NOME_STATUS_PPE[p.chave], total: p.total })),
    retidos: new Set(ppes.filter((p) => p.alertaRetencao).map((p) => p.matricula)).size,
    ppis: ppis.length,
    ppiPorStatus: contarPor(ppis.map((p) => p.status).filter((s) => s !== 'RASCUNHO'), ORDEM_STATUS_PPI).map((p) => ({ rotulo: NOME_STATUS_PPI[p.chave], total: p.total })),
    ppiConcluidas: ppis.filter((p) => p.totalValidado >= p.metaHoras).length,
  };
}
export type DadosRelatorio = Awaited<ReturnType<typeof carregarRelatorio>>;

