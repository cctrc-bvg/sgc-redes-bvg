import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';

export const metadata: Metadata = { title: 'Ofertas — SGC-Redes' };

const classeBotao =
  'inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100';

export default async function PaginaOfertas({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  await exigirPermissao('ofertas:gerenciar');
  const atual = anoLetivoAtual();
  const anoLetivo = lerAnoLetivo((await searchParams).ano) ?? atual;

  const [turmas, anosComOferta, porProfessor] = await Promise.all([
    prisma.turma.findMany({
      where: { ativa: true },
      orderBy: [{ anoCurso: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }],
      select: { id: true, nome: true, anoCurso: true, _count: { select: { ofertas: { where: { anoLetivo } } } } },
    }),
    prisma.disciplinaOferta.findMany({ distinct: ['anoLetivo'], select: { anoLetivo: true } }),
    prisma.disciplinaOferta.findMany({
      where: { anoLetivo },
      select: { professor: { select: { id: true, nome: true } }, disciplina: { select: { cargaHoraria: true } } },
    }),
  ]);

  // Disciplinas ativas da matriz por ano do curso, para comparar com as ofertas de cada turma.
  const porAnoCurso = new Map(
    (await prisma.disciplina.groupBy({ by: ['anoCurso'], where: { ativa: true }, _count: true })).map((g) => [g.anoCurso, g._count]),
  );
  const anos = [...new Set([atual - 1, atual, atual + 1, anoLetivo, ...anosComOferta.map((a) => a.anoLetivo)])].sort();

  const carga = new Map<string, { id: string; nome: string; ofertas: number; horas: number }>();
  for (const o of porProfessor) {
    const c = carga.get(o.professor.id) ?? { id: o.professor.id, nome: o.professor.nome, ofertas: 0, horas: 0 };
    c.ofertas += 1;
    c.horas += o.disciplina.cargaHoraria;
    carga.set(o.professor.id, c);
  }
  const professores = [...carga.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Ofertas de disciplinas</h1>
      <p className="mt-1 text-slate-700">Distribuição das disciplinas aos professores por turma e ano letivo (Art. 22, XXIV).</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="ano" className="block text-sm font-semibold text-slate-800">
            Ano letivo
          </label>
          <select
            id="ano"
            name="ano"
            defaultValue={String(anoLetivo)}
            className="mt-1 block min-h-11 rounded-md border border-slate-400 bg-white px-3 py-2 text-base text-slate-900 focus:border-if-verde-700 focus:outline-none focus:ring-2 focus:ring-if-verde-700"
          >
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={classeBotao}>
          Ver ano
        </button>
      </form>

      <section aria-labelledby="turmas" className="mt-6">
        <h2 id="turmas" className="text-lg font-semibold text-slate-900">
          Turmas em {anoLetivo}
        </h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-3">
          {turmas.map((t) => {
            const total = t.anoCurso ? (porAnoCurso.get(t.anoCurso) ?? 0) : 0;
            const completa = total > 0 && t._count.ofertas >= total;
            return (
              <li key={t.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900">{t.nome}</h3>
                <p className="mt-1 flex-1 text-sm text-slate-700">
                  {t.anoCurso ? `${t._count.ofertas} de ${total} disciplina(s) com professor` : 'Ano do curso não definido'}
                </p>
                <p className="mt-2">
                  {completa ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-if-verde-50 px-2.5 py-0.5 text-xs font-semibold text-if-verde-800">
                      <span aria-hidden="true">✔</span> Completa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                      <span aria-hidden="true">⏳</span> Pendente
                    </span>
                  )}
                </p>
                <Link
                  href={`/ofertas/${t.id}?ano=${anoLetivo}`}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800"
                >
                  Distribuir disciplinas<span className="sr-only"> de {t.nome}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="carga" className="mt-8">
        <h2 id="carga" className="text-lg font-semibold text-slate-900">
          Carga por professor em {anoLetivo}
        </h2>
        {professores.length === 0 ? (
          <p className="mt-2 text-slate-700">Nenhuma disciplina distribuída neste ano.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="sr-only">Quantidade de disciplinas e carga horária anual de cada professor</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Professor</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Disciplinas</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Carga horária no ano</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {professores.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className="px-4 py-3 font-normal">{p.nome}</th>
                    <td className="px-4 py-3 text-right tabular-nums">{p.ofertas}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.horas}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
