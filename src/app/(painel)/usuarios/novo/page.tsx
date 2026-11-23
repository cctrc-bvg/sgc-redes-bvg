import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirPermissao } from '@/lib/auth/dal';
import { FormularioUsuario } from '../formulario-usuario';

export const metadata: Metadata = { title: 'Cadastrar usuário — SGC-Redes' };

export default async function PaginaNovoUsuario() {
  await exigirPermissao('usuarios:gerenciar');
  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/usuarios" className="text-if-verde-700 underline underline-offset-2">Usuários</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Cadastrar</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Cadastrar usuário</h1>
      <p className="mt-1 text-slate-700">O sistema gera uma senha provisória, que a pessoa troca no primeiro acesso.</p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioUsuario modo="criar" />
      </div>
    </div>
  );
}
