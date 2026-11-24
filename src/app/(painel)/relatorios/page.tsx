import type { Metadata } from 'next';
import { LinkExportar, LinkImpressao } from '@/components/barra-impressao';
import { BotaoSecundario, Selecao } from '@/components/campo';
import { exigirPermissao } from '@/lib/auth/dal';
import { lerAnoLetivo, anoLetivoAtual } from '@/lib/ofertas/regras';
import { carregarRelatorio } from '@/lib/relatorios/servidor';
import { ConteudoRelatorio } from './conteudo';

export const metadata: Metadata = { title: 'Relatórios — SGC-Redes' };

/** Consolidado para Coordenação, CTP e Direção: só números, sem nomes de estudantes nem motivos (LGPD). */
export default async function PaginaRelatorios({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  await exigirPermissao('relatorios:ver');
  const atual = anoLetivoAtual();
  const ano = lerAnoLetivo((await searchParams).ano) ?? atual;
  const r = await carregarRelatorio(ano);

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Relatórios — {ano}</h1>
      <p className="mt-1 text-slate-700">Números consolidados de faltas, substituições, alimentação, PPE e PPI. Sem nomes de estudantes nem motivos (LGPD).</p>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <Selecao id="ano" rotulo="Ano" opcoes={[atual - 1, atual, atual + 1].map((a) => ({ valor: String(a), rotulo: String(a) }))} defaultValue={String(ano)} />
        <BotaoSecundario type="submit">Ver</BotaoSecundario>
      </form>
      <div className="mt-4 flex flex-wrap gap-3">
        <LinkImpressao href={`/relatorios/imprimir?ano=${ano}`} />
        <LinkExportar href={`/exportar/relatorios?ano=${ano}`} />
      </div>
      <ConteudoRelatorio r={r} />
    </>
  );
}
