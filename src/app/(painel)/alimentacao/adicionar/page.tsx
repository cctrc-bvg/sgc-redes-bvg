import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { hojeEmFortaleza } from '@/lib/ausencias/regras';
import { FormularioAcrescimo } from './formulario-acrescimo';

export const metadata: Metadata = { title: 'Acrescentar refeição — SGC-Redes' };

export default async function PaginaAcrescimo() {
  await exigirPermissao('alimentacao:gerenciar');
  const turmas = await prisma.turma.findMany({
    where: { ativa: true },
    orderBy: [{ anoCurso: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }],
    select: { id: true, nome: true },
  });
  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/alimentacao" className="text-if-verde-700 underline underline-offset-2">Alimentação</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Acrescentar refeição</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Acrescentar refeição</h1>
      <p className="mt-1 text-slate-700">
        Para encontros no contraturno (PEI, laboratório, reposição) com grupos pequenos (G05). A Assistência Estudantil recebe o aviso no painel.
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioAcrescimo turmas={turmas} hoje={hojeEmFortaleza()} />
      </div>
    </div>
  );
}
