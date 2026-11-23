import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { FormularioDisciplina } from '../formulario-disciplina';
import { FormularioExclusao } from '../formulario-exclusao';

export const metadata: Metadata = { title: 'Editar disciplina — SGC-Redes' };

export default async function PaginaEditarDisciplina({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao('disciplinas:gerenciar');
  const { id } = await params;
  const d = await prisma.disciplina.findUnique({
    where: { id },
    include: { _count: { select: { ofertas: true, ppes: true } } },
  });
  if (!d) notFound();
  const usada = d._count.ofertas > 0 || d._count.ppes > 0;

  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/disciplinas" className="text-if-verde-700 underline underline-offset-2">Disciplinas</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{d.nome}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{d.nome}</h1>
      <p className="mt-1 text-slate-700">
        {d._count.ofertas} oferta(s) · {d._count.ppes} registro(s) de PPE
      </p>

      <section aria-labelledby="dados" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="dados" className="mb-4 text-lg font-semibold text-slate-900">Dados da disciplina</h2>
        <FormularioDisciplina
          modo="editar"
          disciplinaId={d.id}
          iniciais={{
            codigo: d.codigo ?? '',
            nome: d.nome,
            cargaHoraria: String(d.cargaHoraria),
            exigePratica: d.exigePratica,
            ementaUrl: d.ementaUrl ?? '',
            programaTexto: d.programaTexto ?? '',
            ativa: d.ativa,
          }}
        />
      </section>

      {!usada && (
        <section aria-labelledby="exclusao" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="exclusao" className="text-lg font-semibold text-slate-900">Excluir</h2>
          <p className="mb-4 mt-1 text-sm text-slate-700">
            Disponível apenas enquanto a disciplina não tem ofertas nem PPEs. Depois disso, use &quot;Disciplina ativa&quot;.
          </p>
          <FormularioExclusao disciplinaId={d.id} />
        </section>
      )}
    </div>
  );
}
