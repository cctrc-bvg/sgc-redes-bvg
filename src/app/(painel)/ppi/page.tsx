import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta, BotaoSecundario, Campo } from '@/components/campo';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { avaliarProgressoPpi } from '@/lib/ppi-ppe-engines';
import { formatarHoras, NOME_STATUS_PPI } from '@/lib/ppi/regras';

export const metadata: Metadata = { title: 'PPI — SGC-Redes' };

export default async function PaginaPpi({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await exigirPermissao('ppi:ver');
  const q = ((await searchParams).q ?? '').trim().slice(0, 60);
  const solicitacoes = await prisma.ppiSolicitacao.findMany({
    where: q ? { OR: [{ matricula: { contains: q } }, { nomeEstudante: { contains: q, mode: 'insensitive' } }] } : {},
    orderBy: [{ status: 'asc' }, { nomeEstudante: 'asc' }],
    take: 200,
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PPI — Prática Profissional Integrada</h1>
          <p className="mt-1 text-slate-700">Meta de 40 horas (Manual 2022). Lançamento e auditoria só pela Coordenação (G11).</p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Link href="/ppi/resumo-cca" className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
          Resumo para a CCA
        </Link>
        <Link href="/ppi/nova" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
          Nova solicitação
        </Link>
        </div>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <Campo id="q" rotulo="Buscar por nome ou matrícula" defaultValue={q} />
        <BotaoSecundario type="submit">Buscar</BotaoSecundario>
      </form>

      {solicitacoes.length === 0 ? (
        <div className="mt-6">
          <Alerta tipo="info">{q ? 'Nenhuma solicitação encontrada.' : 'Nenhuma solicitação de PPI cadastrada ainda.'}</Alerta>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Solicitações de PPI com horas validadas e situação</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Estudante</th>
                <th scope="col" className="px-4 py-3 font-semibold">Turma</th>
                <th scope="col" className="px-4 py-3 font-semibold">Horas validadas</th>
                <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {solicitacoes.map((s) => {
                const p = avaliarProgressoPpi(s.totalValidado, s.metaHoras);
                return (
                  <tr key={s.id}>
                    <th scope="row" className="px-4 py-3 font-normal">
                      <Link href={`/ppi/${s.id}`} className="font-semibold text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                        {s.nomeEstudante}
                      </Link>
                      <span className="block text-slate-600">Matrícula {s.matricula}</span>
                    </th>
                    <td className="px-4 py-3">{s.turmaAtual}</td>
                    <td className="px-4 py-3">
                      <span className="tabular-nums">
                        {formatarHoras(s.totalValidado)}h de {s.metaHoras}h ({p.percentual}%)
                      </span>
                      <span className="mt-1 block h-2 w-32 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                        <span className="block h-full bg-if-verde-700" style={{ width: `${p.percentual}%` }} />
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.concluido && s.status !== 'DEFERIDA' && <span className="mr-1" aria-hidden="true">✔</span>}
                      {NOME_STATUS_PPI[s.status]}
                      {p.concluido && s.status === 'EM_ANALISE' && <span className="block text-xs text-if-verde-800">Meta atingida: pronta para deferir</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
