import type { Metadata } from 'next';
import Link from 'next/link';
import { ImportadorPlanilha } from '@/components/importador-planilha';
import { exigirPermissao } from '@/lib/auth/dal';
import { importarOfertas } from './actions';

export const metadata: Metadata = { title: 'Importar ofertas — SGC-Redes' };

export default async function PaginaImportarOfertas() {
  await exigirPermissao('ofertas:gerenciar');
  return (
    <div className="max-w-4xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/ofertas" className="text-if-verde-700 underline underline-offset-2">Ofertas</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Importar planilha</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Importar a distribuição de disciplinas por planilha</h1>
      <p className="mt-1 text-slate-700">
        Lance ou troque o professor de várias disciplinas e turmas de uma vez. O modelo já vem com as disciplinas da matriz curricular de cada turma (e os professores já lançados): preencha o e-mail do professor; linhas sem professor são ignoradas. Nada é removido pela planilha.
      </p>
      <div className="mt-6">
        <ImportadorPlanilha acao={importarOfertas} modeloBase="/ofertas/importar/modelo" itens="ofertas" />
      </div>
    </div>
  );
}
