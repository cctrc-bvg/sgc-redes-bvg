import type { Metadata } from 'next';
import Link from 'next/link';
import { ImportadorPlanilha } from '@/components/importador-planilha';
import { exigirPermissao } from '@/lib/auth/dal';
import { importarDisciplinas } from './actions';

export const metadata: Metadata = { title: 'Importar disciplinas — SGC-Redes' };

export default async function PaginaImportarDisciplinas() {
  await exigirPermissao('disciplinas:gerenciar');
  return (
    <div className="max-w-4xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/disciplinas" className="text-if-verde-700 underline underline-offset-2">Disciplinas</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Importar planilha</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Importar disciplinas por planilha</h1>
      <p className="mt-1 text-slate-700">
        Cadastre ou atualize várias disciplinas de uma vez. O modelo vem com o catálogo atual: edite, acrescente linhas e envie.
        Nada é excluído pela planilha.
      </p>
      <div className="mt-6">
        <ImportadorPlanilha acao={importarDisciplinas} modeloBase="/disciplinas/importar/modelo" itens="disciplinas" />
      </div>
    </div>
  );
}
