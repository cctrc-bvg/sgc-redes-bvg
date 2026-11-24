import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirPermissao } from '@/lib/auth/dal';
import { FormularioTurma } from '../formulario-turma';

export const metadata: Metadata = { title: 'Cadastrar turma — SGC-Redes' };

export default async function PaginaNovaTurma() {
  await exigirPermissao('turmas:gerenciar');
  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/turmas" className="text-if-verde-700 underline underline-offset-2">Turmas</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Cadastrar</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Cadastrar turma</h1>
      <p className="mt-1 text-slate-700">
        A mesma turma vale para todos os anos letivos: as disciplinas de cada ano são lançadas em Ofertas.
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioTurma modo="criar" />
      </div>
    </div>
  );
}
