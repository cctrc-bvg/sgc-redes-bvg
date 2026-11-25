import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkExportar, LinkImpressao } from '@/components/barra-impressao';
import { SeletorPeriodo } from '@/components/quadro-grade';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { anosDoSeletor, periodoDaUrl } from '@/lib/grade/regras';

export const metadata: Metadata = { title: 'Grade — SGC-Redes' };

const classeCartao = 'flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm';
const classeLink =
  'mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800';

export default async function PaginaGrade({ searchParams }: { searchParams: Promise<{ ano?: string; sem?: string }> }) {
  const { usuario } = await exigirPermissao('grade:ver');
  const { anoLetivo, semestreLetivo } = periodoDaUrl(await searchParams);
  const periodo = `?ano=${anoLetivo}&sem=${semestreLetivo}`;

  const [turmas, minhasAulas] = await Promise.all([
    prisma.turma.findMany({
      where: { ativa: true },
      orderBy: [{ anoCurso: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }],
      select: { id: true, nome: true, _count: { select: { gradeHoraria: { where: { anoLetivo, semestreLetivo, ofertaId: { not: null } } } } } },
    }),
    prisma.gradeHorario.count({ where: { anoLetivo, semestreLetivo, oferta: { professorId: usuario.id } } }),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Grade horária</h1>
      <p className="mt-1 text-slate-700">Horários das turmas e a sua grade individual.</p>
      <div className="mt-4">
        <SeletorPeriodo anoLetivo={anoLetivo} semestreLetivo={semestreLetivo} anos={anosDoSeletor(anoLetivo)} />
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li className={`${classeCartao} border-if-verde-700`}>
          <h2 className="font-semibold text-slate-900">Minha grade</h2>
          <p className="mt-1 flex-1 text-sm text-slate-700">{minhasAulas} aula(s) por semana em {anoLetivo}.{semestreLetivo}.</p>
          <Link href={`/grade/minha${periodo}`} className={classeLink}>
            Ver minha grade
          </Link>
        </li>
        {turmas.map((t) => (
          <li key={t.id} className={classeCartao}>
            <h2 className="font-semibold text-slate-900">{t.nome}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-700">{t._count.gradeHoraria} aula(s) por semana na grade.</p>
            <Link href={`/grade/turma/${t.id}${periodo}`} className={classeLink}>
              Ver grade<span className="sr-only"> de {t.nome}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <LinkImpressao href={`/grade/imprimir${periodo}`}>Imprimir / PDF de todas as turmas</LinkImpressao>
        <LinkExportar href={`/exportar/grade${periodo}`}>Exportar planilha</LinkExportar>
        {temPermissao(usuario, 'grade:editar') && (
          <Link href={`/grade/importar${periodo}`} className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
            Importar planilha
          </Link>
        )}
        <Link href={`/grade/sabados${periodo}`} className="inline-flex min-h-11 items-center text-if-verde-700 underline underline-offset-2">
          Sábados letivos
        </Link>
      </div>
    </>
  );
}
