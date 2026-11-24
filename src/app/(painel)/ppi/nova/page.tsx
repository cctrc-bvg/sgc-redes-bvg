import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { FormularioSolicitacao } from '../formularios';

export const metadata: Metadata = { title: 'Nova solicitação de PPI — SGC-Redes' };

export default async function PaginaNovaPpi() {
  await exigirPermissao('ppi:gerenciar');
  const turmas = await prisma.turma.findMany({ where: { ativa: true }, orderBy: [{ anoCurso: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }], select: { codigo: true, nome: true } });
  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/ppi" className="text-if-verde-700 underline underline-offset-2">PPI</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Nova solicitação</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Nova solicitação de PPI</h1>
      <p className="mt-1 text-slate-700">Uma por estudante. Depois de criar, lance as atividades com os comprovantes.</p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioSolicitacao turmas={turmas.map((t) => ({ valor: t.codigo, rotulo: t.nome }))} />
      </div>
    </div>
  );
}
