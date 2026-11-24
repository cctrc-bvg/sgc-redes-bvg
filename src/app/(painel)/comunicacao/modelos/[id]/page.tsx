import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { FormularioModelo, FormularioRemocao } from '../formulario-modelo';

export const metadata: Metadata = { title: 'Texto-padrão — SGC-Redes' };

export default async function PaginaModelo({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao('comunicacao:enviar');
  const { id } = await params;
  const m = await prisma.modeloMensagem.findUnique({ where: { id } });
  if (!m) notFound();
  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/comunicacao/modelos" className="text-if-verde-700 underline underline-offset-2">
          Textos-padrão
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{m.rotulo}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Editar texto-padrão</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioModelo inicial={{ id: m.id, tipo: m.tipo, rotulo: m.rotulo, assunto: m.assunto, texto: m.texto, destinos: m.destinos }} />
      </div>
      <section aria-labelledby="remover" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="remover" className="mb-3 text-lg font-semibold text-slate-900">
          Remover
        </h2>
        <FormularioRemocao id={m.id} />
      </section>
    </div>
  );
}
