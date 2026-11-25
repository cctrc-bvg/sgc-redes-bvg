import type { Metadata } from 'next';
import Link from 'next/link';
import type { TipoProcesso } from '@prisma/client';
import { Alerta } from '@/components/campo';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { dataDoBanco, formatarData, hojeEmFortaleza, somarDias } from '@/lib/ausencias/regras';
import { COLUNAS, filtroSigilo, NOME_COLUNA, NOME_TIPO, situacaoPrazo, TIPOS, vizinhas } from '@/lib/processos/regras';
import { BotaoMover } from './formularios';

export const metadata: Metadata = { title: 'Processos SEI — SGC-Redes' };

const PRAZO: Record<ReturnType<typeof situacaoPrazo>, { texto: string; classe: string } | null> = {
  'sem-prazo': null,
  concluido: null,
  ok: null,
  proximo: { texto: '⏳ Prazo próximo', classe: 'bg-amber-100 text-amber-900' },
  hoje: { texto: '⚠ Vence hoje', classe: 'bg-amber-100 text-amber-900' },
  vencido: { texto: '⚠ Prazo vencido', classe: 'bg-if-vermelho-50 text-if-vermelho-700' },
};

const AVISOS: Record<string, string> = { criado: 'Item cadastrado no quadro.', excluido: 'Item excluído.' };

export default async function PaginaProcessos({ searchParams }: { searchParams: Promise<{ tipo?: string; aviso?: string }> }) {
  const { usuario } = await exigirPermissao('kanban:ver');
  const podeGerenciar = temPermissao(usuario, 'kanban:gerenciar');
  const podeSigilo = temPermissao(usuario, 'kanban:ver-sigiloso');
  const { tipo: tipoUrl, aviso } = await searchParams;
  const tipo = TIPOS.includes(tipoUrl as TipoProcesso) ? (tipoUrl as TipoProcesso) : undefined;
  const hoje = hojeEmFortaleza();

  const itens = await prisma.processoKanban.findMany({
    where: {
      ...filtroSigilo(podeSigilo),
      ...(tipo ? { tipo } : {}),
      // Concluídos ficam visíveis por 30 dias; o histórico completo segue no banco e na auditoria.
      OR: [{ coluna: { not: 'CONCLUIDO' } }, { updatedAt: { gte: new Date(`${somarDias(hoje, -30)}T00:00:00-03:00`) } }],
    },
    orderBy: [{ prazo: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    select: { id: true, titulo: true, tipo: true, coluna: true, numeroSei: true, prazo: true, sigiloso: true },
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Processos SEI e atendimentos</h1>
          <p className="mt-1 text-slate-700">
            Quadro por etapa (RF09). {podeSigilo ? 'Itens sigilosos aparecem só para a Coordenação.' : ''}
          </p>
        </div>
        {podeGerenciar && (
          <Link href="/processos/novo" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
            Novo item
          </Link>
        )}
      </div>

      {aviso && AVISOS[aviso] && (
        <div className="mt-4">
          <Alerta tipo="sucesso">{AVISOS[aviso]}</Alerta>
        </div>
      )}

      <nav aria-label="Filtrar por etiqueta" className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href="/processos" aria-current={!tipo ? 'page' : undefined} className={`rounded-full border px-3 py-1.5 ${!tipo ? 'border-if-verde-700 bg-if-verde-50 font-semibold text-if-verde-800' : 'border-slate-300 text-slate-700'}`}>
          Todas
        </Link>
        {TIPOS.map((t) => (
          <Link
            key={t}
            href={`/processos?tipo=${t}`}
            aria-current={tipo === t ? 'page' : undefined}
            className={`rounded-full border px-3 py-1.5 ${tipo === t ? 'border-if-verde-700 bg-if-verde-50 font-semibold text-if-verde-800' : 'border-slate-300 text-slate-700'}`}
          >
            {NOME_TIPO[t]}
          </Link>
        ))}
      </nav>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUNAS.map((coluna) => {
          const daColuna = itens.filter((i) => i.coluna === coluna);
          return (
            <section key={coluna} aria-labelledby={`col-${coluna}`} className="rounded-lg border border-slate-200 bg-slate-100 p-3">
              <h2 id={`col-${coluna}`} className="mb-3 font-semibold text-slate-900">
                {NOME_COLUNA[coluna]} <span className="font-normal text-slate-600">({daColuna.length})</span>
              </h2>
              {daColuna.length === 0 ? (
                <p className="text-sm text-slate-600">Nenhum item.</p>
              ) : (
                <ul className="space-y-3">
                  {daColuna.map((i) => {
                    const prazoISO = i.prazo ? dataDoBanco(i.prazo) : null;
                    const p = PRAZO[situacaoPrazo(prazoISO, hoje, i.coluna)];
                    const { anterior, proxima } = vizinhas(i.coluna);
                    return (
                      <li key={i.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                        <Link href={`/processos/${i.id}`} className="font-semibold text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                          {i.titulo}
                        </Link>
                        <p className="mt-1 text-sm text-slate-700">{NOME_TIPO[i.tipo]}</p>
                        {i.numeroSei && <p className="text-sm tabular-nums text-slate-700">SEI {i.numeroSei}</p>}
                        {prazoISO && <p className="text-sm text-slate-700">Prazo: {formatarData(prazoISO)}</p>}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {i.sigiloso && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white">
                              <span aria-hidden="true">🔒</span> Sigiloso
                            </span>
                          )}
                          {p && <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${p.classe}`}>{p.texto}</span>}
                        </div>
                        {podeGerenciar && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {anterior && (
                              <BotaoMover processoId={i.id} coluna={anterior} rotulo="←" rotuloAcessivel={`Mover "${i.titulo}" para ${NOME_COLUNA[anterior]}`} />
                            )}
                            {proxima && (
                              <BotaoMover
                                processoId={i.id}
                                coluna={proxima}
                                rotulo={`${NOME_COLUNA[proxima]} →`}
                                rotuloAcessivel={`Mover "${i.titulo}" para ${NOME_COLUNA[proxima]}`}
                              />
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
