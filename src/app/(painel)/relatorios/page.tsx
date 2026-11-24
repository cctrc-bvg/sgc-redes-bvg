import type { Metadata } from 'next';
import { BotaoSecundario, Selecao } from '@/components/campo';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataDoBanco } from '@/lib/ausencias/regras';
import { lerAnoLetivo, anoLetivoAtual } from '@/lib/ofertas/regras';
import { NOME_STATUS_PPE } from '@/lib/ppe/regras';
import { NOME_STATUS_PPI } from '@/lib/ppi/regras';
import { contarPor, nomeMes, ORDEM_STATUS_PPE, ORDEM_STATUS_PPI, resumoMensalAusencias, totalizar } from '@/lib/relatorios/agregacoes';

export const metadata: Metadata = { title: 'Relatórios — SGC-Redes' };

/** Consolidado para Coordenação, CTP e Direção: só números, sem nomes de estudantes nem motivos (LGPD). */
export default async function PaginaRelatorios({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  await exigirPermissao('relatorios:ver');
  const atual = anoLetivoAtual();
  const ano = lerAnoLetivo((await searchParams).ano) ?? atual;
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
  const total = totalizar(linhas);
  const ppePorStatus = contarPor(ppes.map((p) => p.status), ORDEM_STATUS_PPE);
  const retidos = new Set(ppes.filter((p) => p.alertaRetencao).map((p) => p.matricula)).size;
  const ppiPorStatus = contarPor(ppis.map((p) => p.status).filter((s) => s !== 'RASCUNHO'), ORDEM_STATUS_PPI);
  const ppiConcluidas = ppis.filter((p) => p.totalValidado >= p.metaHoras).length;
  const sla = contarPor(alertas.map((a) => a.nivelSla), ['VERDE_24H_MAIS', 'AMARELO_4H_A_24H', 'VERMELHO_MENOS_4H'] as const);
  const th = 'px-4 py-3 font-semibold';
  const td = 'px-4 py-3 text-right tabular-nums';

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Relatórios — {ano}</h1>
      <p className="mt-1 text-slate-700">Números consolidados de faltas, substituições, alimentação, PPE e PPI. Sem nomes de estudantes nem motivos (LGPD).</p>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <Selecao id="ano" rotulo="Ano" opcoes={[atual - 1, atual, atual + 1].map((a) => ({ valor: String(a), rotulo: String(a) }))} defaultValue={String(ano)} />
        <BotaoSecundario type="submit">Ver</BotaoSecundario>
      </form>

      <section aria-labelledby="ausencias" className="mt-8">
        <h2 id="ausencias" className="text-lg font-semibold text-slate-900">Ausências docentes e cobertura das aulas</h2>
        {linhas.length === 0 ? (
          <p className="mt-2 text-slate-700">Nenhuma ausência registrada em {ano}.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">Ausências por mês com aulas perdidas e como foram cobertas</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <tr>
                  <th scope="col" className={th}>Mês</th>
                  <th scope="col" className={`${th} text-right`}>Ausências</th>
                  <th scope="col" className={`${th} text-right`}>Aulas perdidas</th>
                  <th scope="col" className={`${th} text-right`}>Substituídas</th>
                  <th scope="col" className={`${th} text-right`}>Adiantadas</th>
                  <th scope="col" className={`${th} text-right`}>Dispensadas</th>
                  <th scope="col" className={`${th} text-right`}>Sem decisão</th>
                  <th scope="col" className={`${th} text-right`}>Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((l) => (
                  <tr key={l.mes}>
                    <th scope="row" className="px-4 py-3 font-semibold">{nomeMes(l.mes)}</th>
                    <td className={td}>{l.ausencias}</td>
                    <td className={td}>{l.aulasPerdidas}</td>
                    <td className={td}>{l.substituidas}</td>
                    <td className={td}>{l.adiantadas}</td>
                    <td className={td}>{l.dispensadas}</td>
                    <td className={td}>{l.pendentes}</td>
                    <td className={td}>{l.cobertura}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-300 bg-slate-50 font-semibold">
                <tr>
                  <th scope="row" className="px-4 py-3">Total</th>
                  <td className={td}>{total.ausencias}</td>
                  <td className={td}>{total.aulasPerdidas}</td>
                  <td className={td}>{total.substituidas}</td>
                  <td className={td}>{total.adiantadas}</td>
                  <td className={td}>{total.dispensadas}</td>
                  <td className={td}>{total.pendentes}</td>
                  <td className={td}>{total.cobertura}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <section aria-labelledby="alimentacao" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="alimentacao" className="font-semibold text-slate-900">Avisos de refeição ({alertas.length})</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-800">
            <li>🟢 Planejados (24h+): {sla[0].total}</li>
            <li>🟡 Imprevistos (4h–24h): {sla[1].total}</li>
            <li>🔴 Emergências (&lt; 4h): {sla[2].total}</li>
          </ul>
        </section>
        <section aria-labelledby="ppe" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="ppe" className="font-semibold text-slate-900">PPE em {ano} ({ppes.length})</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-800">
            {ppePorStatus.map((p) => (
              <li key={p.chave}>
                {NOME_STATUS_PPE[p.chave]}: {p.total}
              </li>
            ))}
            <li className="font-semibold">Estudantes com alerta de retenção (Art. 115): {retidos}</li>
          </ul>
        </section>
        <section aria-labelledby="ppi" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="ppi" className="font-semibold text-slate-900">PPI ({ppis.length} solicitações)</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-800">
            {ppiPorStatus.map((p) => (
              <li key={p.chave}>
                {NOME_STATUS_PPI[p.chave]}: {p.total}
              </li>
            ))}
            <li className="font-semibold">Com 40h ou mais validadas: {ppiConcluidas}</li>
          </ul>
        </section>
      </div>
    </>
  );
}
