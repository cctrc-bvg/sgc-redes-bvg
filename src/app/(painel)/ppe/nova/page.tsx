import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { semestreAtual } from '@/lib/ppe/regras';
import { FormularioRegistroPpe } from '../formularios';

export const metadata: Metadata = { title: 'Registrar PPE — SGC-Redes' };

export default async function PaginaNovaPpe() {
  await exigirPermissao('ppe:gerenciar');
  const disciplinas = await prisma.disciplina.findMany({
    where: { ativa: true },
    orderBy: [{ anoCurso: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }],
    select: { id: true, nome: true, codigo: true, cargaHoraria: true },
  });
  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/ppe" className="text-if-verde-700 underline underline-offset-2">PPE / PEI</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Registrar</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Registrar PPE</h1>
      <p className="mt-1 text-slate-700">Um registro por estudante e componente pendente. Com 3 ou mais no semestre, o sistema alerta a retenção (Art. 115).</p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioRegistroPpe
          semestre={semestreAtual()}
          disciplinas={disciplinas.map((d) => ({ valor: d.id, rotulo: `${d.nome}${d.codigo ? ` (${d.codigo})` : ''} — ${d.cargaHoraria}h` }))}
        />
      </div>
    </div>
  );
}
