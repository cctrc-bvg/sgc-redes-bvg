import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirPermissao } from '@/lib/auth/dal';
import { FormularioDisciplina } from '../formulario-disciplina';

export const metadata: Metadata = { title: 'Cadastrar disciplina — SGC-Redes' };

export default async function PaginaNovaDisciplina() {
  await exigirPermissao('disciplinas:gerenciar');
  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/disciplinas" className="text-if-verde-700 underline underline-offset-2">Disciplinas</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Cadastrar</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Cadastrar disciplina</h1>
      <p className="mt-1 text-slate-700">A carga horária e a exigência de prática são usadas nas travas do PEI (Arts. 117 e 121 do ROD).</p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioDisciplina modo="criar" />
      </div>
    </div>
  );
}
