import type { Metadata } from 'next';
import Link from 'next/link';
import { ImportadorPlanilha } from '@/components/importador-planilha';
import { exigirPermissao } from '@/lib/auth/dal';
import { importarUsuarios } from './actions';

export const metadata: Metadata = { title: 'Importar usuários — SGC-Redes' };

export default async function PaginaImportarUsuarios() {
  await exigirPermissao('usuarios:gerenciar');
  return (
    <div className="max-w-4xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/usuarios" className="text-if-verde-700 underline underline-offset-2">Usuários</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Importar planilha</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Importar usuários por planilha</h1>
      <p className="mt-1 text-slate-700">
        Cadastre vários professores e servidores de uma vez. Cada pessoa recebe uma senha provisória, exibida uma única vez ao
        final, e troca a senha no primeiro acesso. E-mails já cadastrados são ignorados.
      </p>
      <div className="mt-6">
        <ImportadorPlanilha acao={importarUsuarios} modeloBase="/usuarios/importar/modelo" itens="usuários" />
      </div>
    </div>
  );
}
