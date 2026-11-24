import type { Metadata } from 'next';
import { BarraImpressao } from '@/components/barra-impressao';
import { exigirPermissao } from '@/lib/auth/dal';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';
import { carregarRelatorio } from '@/lib/relatorios/servidor';
import { ConteudoRelatorio } from '../conteudo';

export const metadata: Metadata = { title: 'Relatórios (impressão) — SGC-Redes' };

/** Relatório consolidado do ano para imprimir ou salvar em PDF. */
export default async function PaginaImprimirRelatorio({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  await exigirPermissao('relatorios:ver');
  const ano = lerAnoLetivo((await searchParams).ano) ?? anoLetivoAtual();
  const r = await carregarRelatorio(ano);
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
  return (
    <div className="bg-white p-4 text-sm text-slate-900 print:p-0">
      <BarraImpressao voltar={`/relatorios?ano=${ano}`} rotulo="Voltar aos relatórios" />
      <header className="text-center">
        <p className="font-semibold">INSTITUTO FEDERAL DO CEARÁ — CAMPUS BOA VIAGEM</p>
        <p>Curso Técnico Integrado em Redes de Computadores</p>
        <h1 className="mt-2 text-lg font-bold">RELATÓRIO CONSOLIDADO {ano}</h1>
        <p className="text-xs text-slate-700">Gerado em {hoje}. Só números, sem nomes de estudantes nem motivos (LGPD).</p>
      </header>
      <ConteudoRelatorio r={r} impressao />
    </div>
  );
}
