import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { dataDoBanco, formatarData } from '@/lib/ausencias/regras';
import { COLUNAS, filtroSigilo, NOME_COLUNA, NOME_TIPO, TIPOS } from '@/lib/processos/regras';
import { FormularioExclusaoProcesso, FormularioProcesso } from '../formularios';

export const metadata: Metadata = { title: 'Processo — SGC-Redes' };

export default async function PaginaProcesso({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await exigirPermissao('kanban:ver');
  const podeGerenciar = temPermissao(usuario, 'kanban:gerenciar');
  const podeSigilo = temPermissao(usuario, 'kanban:ver-sigiloso');
  const { id } = await params;
  // Sem permissão de sigilo, um item sigiloso responde 404 (não revela que existe).
  const p = await prisma.processoKanban.findFirst({ where: { id, ...filtroSigilo(podeSigilo) }, include: { criadoPor: { select: { nome: true } } } });
  if (!p) notFound();
  const prazo = p.prazo ? dataDoBanco(p.prazo) : '';

  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/processos" className="text-if-verde-700 underline underline-offset-2">Processos</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{p.titulo}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{p.titulo}</h1>
      <p className="mt-1 text-slate-700">
        {NOME_TIPO[p.tipo]} · {NOME_COLUNA[p.coluna]} · cadastrado por {p.criadoPor.nome}
        {p.sigiloso && ' · 🔒 Sigiloso'}
      </p>

      {podeGerenciar ? (
        <>
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <FormularioProcesso
              processoId={p.id}
              iniciais={{ titulo: p.titulo, tipo: p.tipo, coluna: p.coluna, numeroSei: p.numeroSei ?? '', prazo, descricao: p.descricao ?? '', sigiloso: p.sigiloso }}
              tipos={TIPOS.map((t) => ({ valor: t, rotulo: NOME_TIPO[t] }))}
              colunas={COLUNAS.map((c) => ({ valor: c, rotulo: NOME_COLUNA[c] }))}
              podeSigilo={podeSigilo}
            />
          </section>
          <section aria-labelledby="excluir" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="excluir" className="mb-3 text-lg font-semibold text-slate-900">Excluir</h2>
            <FormularioExclusaoProcesso processoId={p.id} />
          </section>
        </>
      ) : (
        <dl className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-slate-700">Número SEI</dt>
            <dd>{p.numeroSei ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-700">Prazo</dt>
            <dd>{prazo ? formatarData(prazo) : '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-semibold text-slate-700">Anotações</dt>
            <dd className="whitespace-pre-line">{p.descricao ?? '—'}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
