import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { formatarData, hojeEmFortaleza } from '@/lib/ausencias/regras';
import { lembreteDoDiario } from '@/lib/diarios/regras';
import { CaixaMensagem } from '@/components/caixa-mensagem';
import { carregarModelos } from '@/lib/comunicacao/servidor';
import { descreverPeriodoLetivo } from '@/lib/ofertas/regras';
import { FormularioDiario, FormularioLembrete } from '../formularios';

export const metadata: Metadata = { title: 'Diário — SGC-Redes' };

export default async function PaginaDiario({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await exigirPermissao('diarios:ver-todos');
  const { id } = await params;
  const o = await prisma.disciplinaOferta.findUnique({
    where: { id },
    include: { turma: { select: { codigo: true, nome: true } }, disciplina: { select: { nome: true } }, professor: { select: { nome: true, email: true, whatsapp: true, usaWhatsapp: true } } },
  });
  if (!o) notFound();
  const lembrete = lembreteDoDiario(o);
  const modelos = await carregarModelos();
  const sem = o.semestreLetivo ?? 1;

  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/diarios?ano=${o.anoLetivo}&sem=${sem}`} className="text-if-verde-700 underline underline-offset-2">
          Diários
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{o.disciplina.nome}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{o.disciplina.nome}</h1>
      <p className="mt-1 text-slate-700">
        {o.turma.nome} · {descreverPeriodoLetivo(o.anoLetivo, o.semestreLetivo)} · {o.professor.nome}
      </p>

      <section aria-labelledby="diario" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="diario" className="mb-4 text-lg font-semibold text-slate-900">Situação do diário</h2>
        <FormularioDiario ofertaId={o.id} ministradas={o.aulasMinistradas} emDia={o.diarioEmDia} observacao={o.observacaoDiario ?? ''} previstas={o.aulasPrevistas} />
      </section>

      <section aria-labelledby="lembrete" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="lembrete" className="text-lg font-semibold text-slate-900">Lembrete ao docente</h2>
        {o.ultimaCobranca && <p className="mt-1 text-sm text-slate-700">Último lembrete: {formatarData(hojeEmFortaleza(o.ultimaCobranca))}.</p>}
        <div className="mt-3">
          <CaixaMensagem mensagem={lembrete} mostrarWhatsapp={usuario.usaWhatsapp} modelos={modelos}>
            <FormularioLembrete ofertaId={o.id} mostrarWhatsapp={usuario.usaWhatsapp} />
          </CaixaMensagem>
        </div>
      </section>
    </div>
  );
}
