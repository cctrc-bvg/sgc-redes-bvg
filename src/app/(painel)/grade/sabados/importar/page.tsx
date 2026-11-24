import type { Metadata } from 'next';
import Link from 'next/link';
import { ImportadorPlanilha } from '@/components/importador-planilha';
import { exigirPermissao } from '@/lib/auth/dal';
import { importarSabados } from './actions';

export const metadata: Metadata = { title: 'Importar sábados letivos — SGC-Redes' };

export default async function PaginaImportarSabados() {
  await exigirPermissao('grade:editar');
  return (
    <div className="max-w-4xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/grade/sabados" className="text-if-verde-700 underline underline-offset-2">Sábados letivos</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Importar planilha</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Importar sábados letivos por planilha</h1>
      <p className="mt-1 text-slate-700">
        Cadastre os sábados do calendário acadêmico de uma vez, cada um com o dia da semana cuja grade ele segue (G14). Nada é excluído pela planilha.
      </p>
      <div className="mt-6">
        <ImportadorPlanilha acao={importarSabados} modeloBase="/grade/sabados/importar/modelo" itens="sábados letivos" />
      </div>
    </div>
  );
}
