import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { NOME_DIA_EXTENSO, periodoDaUrl } from '@/lib/grade/regras';
import { excluirSabado } from '../actions';
import { dataCurta } from './aviso';
import { FormularioSabado } from './formulario-sabado';

export const metadata: Metadata = { title: 'Sábados letivos — SGC-Redes' };

export default async function PaginaSabados({ searchParams }: { searchParams: Promise<{ ano?: string; sem?: string }> }) {
  const { usuario } = await exigirPermissao('grade:ver');
  const podeEditar = temPermissao(usuario.role, 'grade:editar');
  const { anoLetivo, semestreLetivo } = periodoDaUrl(await searchParams);
  const sabados = await prisma.sabadoLetivo.findMany({
    where: { data: { gte: new Date(Date.UTC(anoLetivo, 0, 1)), lt: new Date(Date.UTC(anoLetivo + 1, 0, 1)) } },
    orderBy: { data: 'asc' },
  });

  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/grade?ano=${anoLetivo}&sem=${semestreLetivo}`} className="text-if-verde-700 underline underline-offset-2">
          Grade
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Sábados letivos</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Sábados letivos de {anoLetivo}</h1>
      <p className="mt-1 text-slate-700">
        Os sábados letivos variam com o calendário acadêmico. Em cada um, vale a grade do dia da semana indicado.
      </p>
      {podeEditar && (
        <p className="mt-3">
          <Link href="/grade/sabados/importar" className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
            Importar planilha
          </Link>
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {sabados.length === 0 ? (
          <p className="p-5 text-slate-700">Nenhum sábado letivo cadastrado em {anoLetivo}.</p>
        ) : (
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Sábados letivos do ano e a grade que cada um segue</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Data</th>
                <th scope="col" className="px-4 py-3 font-semibold">Segue a grade de</th>
                <th scope="col" className="px-4 py-3 font-semibold">Observação</th>
                {podeEditar && (
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Ações</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sabados.map((s) => (
                <tr key={s.id}>
                  <th scope="row" className="px-4 py-3 font-semibold">{dataCurta.format(s.data)}</th>
                  <td className="px-4 py-3">{NOME_DIA_EXTENSO[s.diaSemanaReferente]}</td>
                  <td className="px-4 py-3">{s.observacao ?? '—'}</td>
                  {podeEditar && (
                    <td className="px-4 py-3 text-right">
                      <form action={excluirSabado}>
                        <input type="hidden" name="sabadoId" value={s.id} />
                        <button
                          type="submit"
                          className="inline-flex min-h-11 items-center rounded-md border border-slate-400 px-3 font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          Excluir<span className="sr-only"> o sábado {dataCurta.format(s.data)}</span>
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {podeEditar && (
        <section aria-labelledby="novo" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="novo" className="mb-4 text-lg font-semibold text-slate-900">Cadastrar sábado letivo</h2>
          <FormularioSabado />
        </section>
      )}
    </div>
  );
}
