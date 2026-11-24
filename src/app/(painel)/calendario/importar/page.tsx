import type { Metadata } from 'next';
import Link from 'next/link';
import { ImportadorPlanilha } from '@/components/importador-planilha';
import { exigirPermissao } from '@/lib/auth/dal';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';
import { importarCalendario } from './actions';

export const metadata: Metadata = { title: 'Importar calendário acadêmico — SGC-Redes' };

export default async function PaginaImportarCalendario({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  await exigirPermissao('calendario:gerenciar');
  const sp = await searchParams;
  const ano = lerAnoLetivo(sp.ano) ?? anoLetivoAtual();
  return (
    <div className="max-w-4xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/calendario?ano=${ano}`} className="text-if-verde-700 underline underline-offset-2">
          Calendário {ano}
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Importar planilha</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Importar o calendário de {ano} por planilha</h1>
      <p className="mt-1 text-slate-700">
        Etapas, semestres, eventos (feriados, reuniões, suspensões…) e sábados letivos numa só planilha — o mesmo formato da exportação. Itens já cadastrados são
        atualizados; nada é excluído pela planilha.
      </p>
      <nav aria-label="Ano da importação" className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-700">Importar para o ano:</span>
        {[ano - 1, ano, ano + 1].map((a) =>
          a === ano ? (
            <strong key={a} aria-current="true" className="text-slate-900">
              {a}
            </strong>
          ) : (
            <Link key={a} href={`/calendario/importar?ano=${a}`} className="text-if-verde-700 underline underline-offset-2">
              {a}
            </Link>
          ),
        )}
      </nav>
      <p className="mt-2 text-sm text-slate-700">
        Para montar outro ano a partir deste, baixe a planilha de {ano}, troque as datas e envie escolhendo o novo ano.
      </p>
      <div className="mt-6">
        <ImportadorPlanilha acao={importarCalendario} ocultos={{ anoLetivo: String(ano) }} modeloBase={`/calendario/importar/modelo?ano=${ano}`} itens="itens do calendário" />
      </div>
    </div>
  );
}
