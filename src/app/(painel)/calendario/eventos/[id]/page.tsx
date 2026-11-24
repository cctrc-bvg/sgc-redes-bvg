import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataDoBanco } from '@/lib/ausencias/regras';
import { FormularioEvento, FormularioRemocaoEvento } from '../../formularios';

export const metadata: Metadata = { title: 'Evento — SGC-Redes' };

export default async function PaginaEvento({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao('calendario:gerenciar');
  const { id } = await params;
  const e = await prisma.eventoCalendario.findUnique({ where: { id } });
  if (!e) notFound();
  const inicio = dataDoBanco(e.inicio);
  const fim = dataDoBanco(e.fim);
  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/calendario?ano=${inicio.slice(0, 4)}&mes=${Number(inicio.slice(5, 7))}`} className="text-if-verde-700 underline underline-offset-2">
          Calendário
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Editar evento</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Editar evento</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioEvento
          inicial={{ id: e.id, tipo: e.tipo, inicio, fim: fim === inicio ? '' : fim, descricao: e.descricao ?? '', suspendeAulas: e.suspendeAulas, imprevisto: e.imprevisto, motivo: e.motivo ?? '' }}
        />
      </div>
      <section aria-labelledby="remover" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="remover" className="mb-3 text-lg font-semibold text-slate-900">
          Remover
        </h2>
        <FormularioRemocaoEvento id={e.id} />
      </section>
    </div>
  );
}
