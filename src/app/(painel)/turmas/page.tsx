import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkExportar } from '@/components/barra-impressao';
import { Alerta } from '@/components/campo';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';

export const metadata: Metadata = { title: 'Turmas — SGC-Redes' };

export default async function PaginaTurmas({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirPermissao('turmas:gerenciar');
  const { aviso } = await searchParams;
  const turmas = await prisma.turma.findMany({
    orderBy: [{ ativa: 'desc' }, { anoCurso: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }],
    select: {
      id: true,
      codigo: true,
      nome: true,
      anoCurso: true,
      ativa: true,
      qtdAlunosAtivos: true,
      qtdMediaLancheManha: true,
      qtdMediaAlmoco: true,
      qtdMediaLancheTarde: true,
    },
  });
  const ativas = turmas.filter((t) => t.ativa).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Turmas</h1>
          <p className="mt-1 text-slate-700">
            Estudantes ativos e médias de refeição usadas nos avisos à Assistência Estudantil.{' '}
            {turmas.length > 0 &&
              `${ativas} ativa(s)${turmas.length > ativas ? ` · ${turmas.length - ativas} desativada(s)` : ''}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LinkExportar href="/exportar/turmas" />
          <Link href="/turmas/nova" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
            Cadastrar turma
          </Link>
        </div>
      </div>

      {aviso === 'excluida' && (
        <div className="mt-4">
          <Alerta tipo="sucesso">Turma excluída.</Alerta>
        </div>
      )}

      {turmas.length === 0 ? (
        <div className="mt-6">
          <Alerta tipo="info">Nenhuma turma cadastrada ainda.</Alerta>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Turmas, com ano do curso, estudantes ativos, médias de refeição e situação</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Turma</th>
                <th scope="col" className="px-4 py-3 font-semibold">Ano do curso</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Estudantes ativos</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Refeições <span className="font-normal">(manhã / almoço / tarde)</span>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {turmas.map((t) => (
                <tr key={t.id} className={t.ativa ? '' : 'bg-slate-50 text-slate-600'}>
                  <th scope="row" className="px-4 py-3 font-normal">
                    <Link href={`/turmas/${t.id}`} className="font-semibold text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                      {t.nome}
                    </Link>
                    <span className="block text-slate-600">{t.codigo}</span>
                  </th>
                  <td className="px-4 py-3">
                    {t.anoCurso ? (
                      `${t.anoCurso}º ano`
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-if-vermelho-700">
                        <span aria-hidden="true">⚠</span> Não informado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.qtdAlunosAtivos}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t.qtdMediaLancheManha} / {t.qtdMediaAlmoco} / {t.qtdMediaLancheTarde}
                  </td>
                  <td className="px-4 py-3">
                    {t.ativa ? (
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
