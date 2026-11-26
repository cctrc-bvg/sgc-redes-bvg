import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkExportar } from '@/components/barra-impressao';
import { Alerta } from '@/components/campo';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataDoBanco, dataParaBanco, formatarData, hojeEmFortaleza, somarDias } from '@/lib/ausencias/regras';
import { SituacaoAusencia } from './situacao';

export const metadata: Metadata = { title: 'Ausências — SGC-Redes' };

const AVISOS: Record<string, string> = {
  registradas: 'Ausências registradas, uma por turma e disciplina. Abra cada uma para decidir a ocupação dos horários.',
  cancelada: 'Registro de ausência cancelado. Os avisos de refeição ligados a ele foram cancelados.',
};

export default async function PaginaAusencias({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirPermissao('ausencias:registrar');
  const { aviso } = await searchParams;
  const hoje = hojeEmFortaleza();
  const ausencias = await prisma.ausenciaDocente.findMany({
    where: { dataAula: { gte: dataParaBanco(somarDias(hoje, -30)) } },
    orderBy: [{ dataAula: 'asc' }, { blocosAfetados: 'asc' }],
    select: {
      id: true,
      dataAula: true,
      blocosAfetados: true,
      status: true,
      informadaPeloDocente: true,
      turma: { select: { nome: true } },
      professorAusente: { select: { nome: true } },
      oferta: { select: { disciplina: { select: { nome: true } } } },
    },
  });
  const proximas = ausencias.filter((a) => dataDoBanco(a.dataAula) >= hoje);
  const anteriores = ausencias.filter((a) => dataDoBanco(a.dataAula) < hoje).reverse();
  const pendentes = proximas.filter((a) => a.status === 'PENDENTE_DECISAO').length;

  const tabela = (lista: typeof ausencias, titulo: string) => (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">{titulo}</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Data</th>
            <th scope="col" className="px-4 py-3 font-semibold">Docente</th>
            <th scope="col" className="px-4 py-3 font-semibold">Turma e disciplina</th>
            <th scope="col" className="px-4 py-3 font-semibold">Horários</th>
            <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lista.map((a) => (
            <tr key={a.id}>
              <th scope="row" className="px-4 py-3 font-normal">
                <Link href={`/ausencias/${a.id}`} className="font-semibold text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                  {formatarData(dataDoBanco(a.dataAula))}
                </Link>
              </th>
              <td className="px-4 py-3">
                {a.professorAusente.nome}
                {a.informadaPeloDocente && <span className="block text-xs font-semibold text-docencia-800">Informada pelo docente</span>}
              </td>
              <td className="px-4 py-3">
                {a.turma.nome}
                <span className="block text-slate-600">{a.oferta.disciplina.nome}</span>
              </td>
              <td className="px-4 py-3 tabular-nums">{a.blocosAfetados.replaceAll(',', ', ')}</td>
              <td className="px-4 py-3">
                <SituacaoAusencia status={a.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ausências e substituições</h1>
          <p className="mt-1 text-slate-700">
            Registro de ausência docente, sugestão de substituto ou adiantamento e aviso automático de refeições (RF02–RF04).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LinkExportar href="/exportar/ausencias" />
          <Link href="/ausencias/nova" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
            Registrar ausência
          </Link>
        </div>
      </div>

      {aviso && AVISOS[aviso] && (
        <div className="mt-4">
          <Alerta tipo="sucesso">{AVISOS[aviso]}</Alerta>
        </div>
      )}

      <section aria-labelledby="proximas" className="mt-6">
        <h2 id="proximas" className="text-lg font-semibold text-slate-900">
          Hoje e próximos dias
          {pendentes > 0 && <span className="ml-2 text-base font-normal text-amber-900">· {pendentes} aguardando decisão</span>}
        </h2>
        {proximas.length === 0 ? (
          <p className="mt-2 text-slate-700">Nenhuma ausência registrada a partir de hoje ({formatarData(hoje)}).</p>
        ) : (
          tabela(proximas, 'Ausências de hoje em diante')
        )}
      </section>

      {anteriores.length > 0 && (
        <section aria-labelledby="anteriores" className="mt-8">
          <h2 id="anteriores" className="text-lg font-semibold text-slate-900">Últimos 30 dias</h2>
          {tabela(anteriores, 'Ausências dos últimos 30 dias')}
        </section>
      )}
    </>
  );
}
