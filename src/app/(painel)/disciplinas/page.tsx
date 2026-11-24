import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/campo';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { calcularTetoPei } from '@/lib/ppi-ppe-engines';
import { NOME_NUCLEO, descreverPeriodo } from '@/lib/disciplinas/regras';

export const metadata: Metadata = { title: 'Disciplinas — SGC-Redes' };

export default async function PaginaDisciplinas({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { usuario } = await exigirPermissao('disciplinas:ver');
  const podeGerenciar = temPermissao(usuario.role, 'disciplinas:gerenciar');
  const { aviso } = await searchParams;
  const disciplinas = await prisma.disciplina.findMany({
    // Ordem da matriz: ano, anuais antes das semestrais, semestre, núcleo, nome. Desativadas no fim.
    orderBy: [
      { ativa: 'desc' },
      { anoCurso: { sort: 'asc', nulls: 'last' } },
      { semestreCurso: { sort: 'asc', nulls: 'first' } },
      { nucleo: { sort: 'asc', nulls: 'last' } },
      { nome: 'asc' },
    ],
    select: {
      id: true,
      codigo: true,
      nome: true,
      cargaHoraria: true,
      exigePratica: true,
      ativa: true,
      nucleo: true,
      anoCurso: true,
      semestreCurso: true,
    },
  });
  const ativas = disciplinas.filter((d) => d.ativa).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Disciplinas</h1>
          <p className="mt-1 text-slate-700">
            Catálogo da estrutura curricular (Art. 22, III e IX).{' '}
            {disciplinas.length > 0 &&
              `${ativas} ativa(s)${disciplinas.length > ativas ? ` · ${disciplinas.length - ativas} desativada(s)` : ''}.`}
          </p>
        </div>
        {podeGerenciar && (
          <div className="flex flex-wrap gap-3">
            <Link
              href="/disciplinas/importar"
              className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100"
            >
              Importar planilha
            </Link>
            <Link href="/disciplinas/nova" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
              Cadastrar disciplina
            </Link>
          </div>
        )}
      </div>

      {aviso === 'excluida' && (
        <div className="mt-4">
          <Alerta tipo="sucesso">Disciplina excluída.</Alerta>
        </div>
      )}

      {disciplinas.length === 0 ? (
        <div className="mt-6">
          <Alerta tipo="info">
            {podeGerenciar
              ? 'Nenhuma disciplina cadastrada ainda. Comece pelas disciplinas da matriz vigente do curso.'
              : 'Nenhuma disciplina cadastrada ainda.'}
          </Alerta>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <caption className="sr-only">Disciplinas do curso, com período, carga horária, teto do PEI, prática e situação</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Disciplina</th>
                <th scope="col" className="px-4 py-3 font-semibold">Período</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Carga horária</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Teto do PEI <span className="font-normal">(30%)</span>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">Prática</th>
                <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {disciplinas.map((d) => (
                <tr key={d.id} className={d.ativa ? '' : 'bg-slate-50 text-slate-600'}>
                  <th scope="row" className="px-4 py-3 font-normal">
                    <Link href={`/disciplinas/${d.id}`} className="font-semibold text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                      {d.nome}
                    </Link>
                    <span className="block text-slate-600">
                      {[d.codigo, d.nucleo && NOME_NUCLEO[d.nucleo]].filter(Boolean).join(' · ')}
                    </span>
                  </th>
                  <td className="px-4 py-3">{descreverPeriodo(d)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.cargaHoraria}h</td>
                  <td className="px-4 py-3 text-right tabular-nums">{calcularTetoPei(d.cargaHoraria)}h</td>
                  <td className="px-4 py-3">{d.exigePratica ? 'Exige prática' : '—'}</td>
                  <td className="px-4 py-3">
                    {d.ativa ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-if-verde-50 px-2.5 py-0.5 text-xs font-semibold text-if-verde-800">
                        <span aria-hidden="true">✔</span> Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                        <span aria-hidden="true">⏸</span> Desativada
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
