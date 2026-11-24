import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { verificarExclusaoTurma } from '@/lib/turmas/regras';
import { FormularioTurma } from '../formulario-turma';
import { FormularioExclusaoTurma } from '../formulario-exclusao';

export const metadata: Metadata = { title: 'Turma — SGC-Redes' };

export default async function PaginaTurma({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao('turmas:gerenciar');
  const { id } = await params;
  const t = await prisma.turma.findUnique({
    where: { id },
    include: { _count: { select: { ofertas: true, gradeHoraria: true, ausencias: true, alertasRefeicao: true } } },
  });
  if (!t) notFound();
  const podeExcluir = verificarExclusaoTurma(t._count) === null;

  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/turmas" className="text-if-verde-700 underline underline-offset-2">Turmas</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{t.nome}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{t.nome}</h1>
      <p className="mt-1 text-slate-700">
        {t._count.ofertas} oferta(s) em todos os anos letivos
        {t.anoCurso && (
          <>
            {' · '}
            <Link href={`/ofertas/${t.id}`} className="text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
              Ver ofertas
            </Link>
            {' · '}
            <Link href={`/grade/turma/${t.id}`} className="text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
              Ver grade
            </Link>
          </>
        )}
      </p>

      <section aria-labelledby="dados" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="dados" className="mb-4 text-lg font-semibold text-slate-900">Dados da turma</h2>
        <FormularioTurma
          modo="editar"
          turmaId={t.id}
          temOfertas={t._count.ofertas > 0}
          iniciais={{
            codigo: t.codigo,
            nome: t.nome,
            anoCurso: t.anoCurso ? String(t.anoCurso) : '',
            qtdAlunosAtivos: String(t.qtdAlunosAtivos),
            qtdMediaLancheManha: String(t.qtdMediaLancheManha),
            qtdMediaAlmoco: String(t.qtdMediaAlmoco),
            qtdMediaLancheTarde: String(t.qtdMediaLancheTarde),
            ativa: t.ativa,
          }}
        />
      </section>

      {podeExcluir && (
        <section aria-labelledby="exclusao" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="exclusao" className="text-lg font-semibold text-slate-900">Excluir</h2>
          <p className="mb-4 mt-1 text-sm text-slate-700">
            Disponível apenas enquanto a turma não tem ofertas, grade, ausências nem avisos de refeição. Depois disso, use
            &quot;Turma ativa&quot;.
          </p>
          <FormularioExclusaoTurma turmaId={t.id} />
        </section>
      )}
    </div>
  );
}
