import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QuadroGrade, SeletorPeriodo, type ConteudoCelula } from '@/components/quadro-grade';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { blocosOrdenados, celulasDaTurma, ofertasDoSemestre } from '@/lib/grade/consultas';
import { aulasSemanaisPrevistas, anosDoSeletor, chaveCelula, janelasLivres, periodoDaUrl } from '@/lib/grade/regras';
import { AvisoSabados } from '../../sabados/aviso';

export const metadata: Metadata = { title: 'Grade da turma — SGC-Redes' };

export default async function PaginaGradeTurma({
  params,
  searchParams,
}: {
  params: Promise<{ turmaId: string }>;
  searchParams: Promise<{ ano?: string; sem?: string }>;
}) {
  const { usuario } = await exigirPermissao('grade:ver');
  const { turmaId } = await params;
  const { anoLetivo, semestreLetivo } = periodoDaUrl(await searchParams);
  const turma = await prisma.turma.findUnique({ where: { id: turmaId }, select: { id: true, nome: true } });
  if (!turma) notFound();

  const [blocos, celulas, ofertas] = await Promise.all([
    blocosOrdenados(),
    celulasDaTurma(turma.id, anoLetivo, semestreLetivo),
    ofertasDoSemestre(turma.id, anoLetivo, semestreLetivo),
  ]);
  const conteudo = new Map<string, ConteudoCelula[]>();
  const aulasPorOferta = new Map<string, number>();
  for (const c of celulas) {
    if (!c.oferta || !c.ofertaId) continue;
    conteudo.set(chaveCelula(c.diaSemana, c.blocoId), [{ titulo: c.oferta.disciplina.nome, detalhe: c.oferta.professor.nome }]);
    aulasPorOferta.set(c.ofertaId, (aulasPorOferta.get(c.ofertaId) ?? 0) + 1);
  }
  const janelas = janelasLivres(new Set(conteudo.keys()), blocos);
  const periodo = `?ano=${anoLetivo}&sem=${semestreLetivo}`;

  return (
    <div>
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/grade${periodo}`} className="text-if-verde-700 underline underline-offset-2">
          Grade
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{turma.nome}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">
          {turma.nome} — {anoLetivo}.{semestreLetivo}
        </h1>
        {temPermissao(usuario.role, 'grade:editar') && (
          <Link
            href={`/grade/turma/${turma.id}/editar${periodo}`}
            className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800"
          >
            Editar grade
          </Link>
        )}
      </div>
      <div className="mt-4">
        <SeletorPeriodo anoLetivo={anoLetivo} semestreLetivo={semestreLetivo} anos={anosDoSeletor(anoLetivo)} />
      </div>

      <div className="mt-6">
        <QuadroGrade blocos={blocos} celulas={conteudo} janelas={janelas} legenda={`Grade da turma ${turma.nome} em ${anoLetivo}.${semestreLetivo}`} />
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {janelas.size} janela(s) livre(s): horários vagos em turnos com aula, disponíveis para remanejamentos.
      </p>

      <AvisoSabados anoLetivo={anoLetivo} semestreLetivo={semestreLetivo} />

      {ofertas.length > 0 && (
        <section aria-labelledby="conferencia" className="mt-8">
          <h2 id="conferencia" className="text-lg font-semibold text-slate-900">
            Aulas por semana
          </h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Aulas semanais de cada disciplina na grade, comparadas com o previsto pela matriz</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Disciplina</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Professor</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Na grade</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Previsto pela matriz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ofertas.map((o) => {
                  const naGrade = aulasPorOferta.get(o.id) ?? 0;
                  const previsto = aulasSemanaisPrevistas(o.disciplina.cargaHoraria, o.semestreLetivo);
                  return (
                    <tr key={o.id}>
                      <th scope="row" className="px-4 py-3 font-normal">{o.disciplina.nome}</th>
                      <td className="px-4 py-3">{o.professor.nome}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{naGrade}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {previsto}
                        {naGrade !== previsto && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 text-xs font-semibold text-amber-900">
                            <span aria-hidden="true">⚠</span> difere
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
