import type { Metadata } from 'next';
import Link from 'next/link';
import { BotaoSecundario, Campo, Selecao } from '@/components/campo';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { condicaoAuditoria, descreverAcao, lerFiltrosAuditoria, NOME_ACAO, POR_PAGINA, urlDaPagina } from '@/lib/auditoria-filtros';

export const metadata: Metadata = { title: 'Auditoria — SGC-Redes' };

const dataHora = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'medium' }).format(d);

/** Links para registros que têm página própria. */
const LINK_ENTIDADE: Record<string, (id: string) => string> = {
  User: (id) => `/usuarios/${id}`,
  Disciplina: (id) => `/disciplinas/${id}`,
  Turma: (id) => `/turmas/${id}`,
  AusenciaDocente: (id) => `/ausencias/${id}`,
  ProcessoKanban: (id) => `/processos/${id}`,
};

export default async function PaginaAuditoria({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await exigirPermissao('auditoria:ver');
  const filtros = lerFiltrosAuditoria(await searchParams);
  const where = condicaoAuditoria(filtros);
  const [registros, total, acoes, usuarios] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filtros.pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: { user: { select: { nome: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ['acao'], select: { acao: true }, orderBy: { acao: 'asc' } }),
    prisma.user.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const opcoesAcao = [...new Set([...acoes.map((a) => a.acao)])].sort((a, b) => descreverAcao(a).localeCompare(descreverAcao(b), 'pt-BR'));

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Auditoria</h1>
      <p className="mt-1 text-slate-700">
        Registro das ações no sistema (ARQUITETURA_LGPD, item 4). Os detalhes nunca trazem senhas, nomes ou motivos pessoais.
      </p>

      <form method="get" className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-[1.4fr_1.2fr_1fr_1fr_auto] lg:items-end">
        <Selecao
          id="acao"
          rotulo="Ação"
          opcoes={[{ valor: '', rotulo: 'Todas' }, ...opcoesAcao.map((a) => ({ valor: a, rotulo: descreverAcao(a) }))]}
          defaultValue={filtros.acao ?? ''}
        />
        <Selecao
          id="usuario"
          rotulo="Usuário"
          opcoes={[{ valor: '', rotulo: 'Todos' }, ...usuarios.map((u) => ({ valor: u.id, rotulo: u.nome }))]}
          defaultValue={filtros.usuarioId ?? ''}
        />
        <Campo id="de" rotulo="De" type="date" defaultValue={filtros.de ?? ''} />
        <Campo id="ate" rotulo="Até" type="date" defaultValue={filtros.ate ?? ''} />
        <BotaoSecundario type="submit">Filtrar</BotaoSecundario>
      </form>

      <p className="mt-4 text-slate-700" role="status">
        {total} registro(s){total > POR_PAGINA ? ` · página ${filtros.pagina} de ${paginas}` : ''}.
        {(filtros.acao || filtros.usuarioId || filtros.de || filtros.ate) && (
          <>
            {' '}
            <Link href="/auditoria" className="text-if-verde-700 underline underline-offset-2">
              Limpar filtros
            </Link>
          </>
        )}
      </p>

      {registros.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <caption className="sr-only">Registros de auditoria, do mais recente ao mais antigo</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Quando</th>
                <th scope="col" className="px-4 py-3 font-semibold">Quem</th>
                <th scope="col" className="px-4 py-3 font-semibold">Ação</th>
                <th scope="col" className="px-4 py-3 font-semibold">Registro</th>
                <th scope="col" className="px-4 py-3 font-semibold">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registros.map((r) => {
                const link = LINK_ENTIDADE[r.entidade];
                return (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{dataHora(r.createdAt)}</td>
                    <td className="px-4 py-3">{r.user?.nome ?? '—'}</td>
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {descreverAcao(r.acao)}
                      {!NOME_ACAO[r.acao] ? null : <span className="block text-xs font-normal text-slate-600">{r.acao}</span>}
                    </th>
                    <td className="px-4 py-3">
                      {r.entidade}{' '}
                      {link ? (
                        <Link href={link(r.entidadeId)} className="break-all text-if-verde-700 underline underline-offset-2">
                          abrir
                        </Link>
                      ) : null}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      {r.detalhes ? <code className="block break-all text-xs text-slate-700">{JSON.stringify(r.detalhes)}</code> : '—'}
                      {r.ipAddress && <span className="block text-xs text-slate-600">IP {r.ipAddress}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <nav aria-label="Paginação" className="mt-4 flex flex-wrap gap-3">
          {filtros.pagina > 1 && (
            <Link href={urlDaPagina(filtros, filtros.pagina - 1)} className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
              ← Mais recentes
            </Link>
          )}
          {filtros.pagina < paginas && (
            <Link href={urlDaPagina(filtros, filtros.pagina + 1)} className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
              Mais antigos →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
