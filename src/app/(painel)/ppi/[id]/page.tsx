import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { dataDoBanco, formatarData } from '@/lib/ausencias/regras';
import { PERFIS_DOCENTES } from '@/lib/ofertas/regras';
import { avaliarProgressoPpi } from '@/lib/ppi-ppe-engines';
import { formatarHoras, NOME_GRUPO_ROMANO, NOME_STATUS_PPI, totaisPorGrupo } from '@/lib/ppi/regras';
import { BotaoAtividade, FormularioAtividade, FormularioDecisaoPpi } from '../formularios';

export const metadata: Metadata = { title: 'Solicitação de PPI — SGC-Redes' };

export default async function PaginaSolicitacaoPpi({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await exigirPermissao('ppi:ver');
  const podeGerenciar = temPermissao(usuario.role, 'ppi:gerenciar');
  const { id } = await params;
  const [s, regras, docentes] = await Promise.all([
    prisma.ppiSolicitacao.findUnique({
      where: { id },
      include: { atividades: { include: { regra: true, orientador: { select: { nome: true } } }, orderBy: [{ dataRealizacao: 'asc' }] } },
    }),
    prisma.ppiRegraCategoria.findMany({ orderBy: [{ grupo: 'asc' }, { descricao: 'asc' }] }),
    prisma.user.findMany({ where: { ativo: true, role: { in: [...PERFIS_DOCENTES] } }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ]);
  if (!s) notFound();
  const p = avaliarProgressoPpi(s.totalValidado, s.metaHoras);
  const grupoDaRegra = new Map(regras.map((r) => [r.id, r.grupo]));
  const { grupos } = totaisPorGrupo(s.atividades.map((a) => ({ regraId: a.regraId, horas: a.horasCalculadas })), grupoDaRegra);
  const editavel = podeGerenciar && s.status !== 'DEFERIDA';

  return (
    <div className="max-w-4xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/ppi" className="text-if-verde-700 underline underline-offset-2">PPI</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{s.nomeEstudante}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{s.nomeEstudante}</h1>
      <p className="mt-1 text-slate-700">
        Matrícula {s.matricula} · {s.turmaAtual} · {NOME_STATUS_PPI[s.status]} ·{' '}
        <Link href={`/ppi/${s.id}/ficha`} className="text-if-verde-700 underline underline-offset-2">
          Ficha para assinatura
        </Link>
        {temPermissao(usuario.role, 'comunicacao:enviar') && (s.status === 'DEFERIDA' || s.status === 'INDEFERIDA') && (
          <>
            {' · '}
            <Link href={`/ppi/${s.id}/comunicar`} className="text-if-verde-700 underline underline-offset-2">
              Comunicar a decisão
            </Link>
          </>
        )}
      </p>

      <section aria-labelledby="progresso" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="progresso" className="text-lg font-semibold text-slate-900">
          {formatarHoras(s.totalValidado)}h de {s.metaHoras}h validadas ({p.percentual}%)
        </h2>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div className="h-full bg-if-verde-700" style={{ width: `${p.percentual}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-700">
          {p.concluido ? '✔ Meta atingida.' : `Faltam ${formatarHoras(Math.round(p.restante * 10) / 10)}h.`} Por grupo:{' '}
          {[1, 2, 3, 4, 5, 6].map((g) => `${NOME_GRUPO_ROMANO[g]} ${formatarHoras(Math.round((grupos.get(g) ?? 0) * 10) / 10)}h`).join(' · ')}
        </p>
      </section>

      <section aria-labelledby="atividades" className="mt-6">
        <h2 id="atividades" className="text-lg font-semibold text-slate-900">Atividades ({s.atividades.length})</h2>
        {s.atividades.length === 0 ? (
          <p className="mt-2 text-slate-700">Nenhuma atividade lançada.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <caption className="sr-only">Atividades lançadas com horas validadas após os tetos do Manual</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Categoria</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Comprovante</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Qtd.</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Horas</th>
                  {editavel && <th scope="col" className="px-4 py-3 font-semibold">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.atividades.map((a) => {
                  const bruto = a.quantidadeInformada * a.regra.horasPorUnidade;
                  return (
                    <tr key={a.id} className={a.aprovada ? 'align-top' : 'bg-slate-50 align-top text-slate-600'}>
                      <th scope="row" className="px-4 py-3 font-normal">
                        <span className="font-semibold">Grupo {NOME_GRUPO_ROMANO[a.regra.grupo]}</span> — {a.regra.descricao}
                        <span className="block text-xs text-slate-600">
                          {a.regra.ponderacaoTexto}; até {a.regra.qtdMaxima} ({formatarHoras(a.regra.pontuacaoMaxima)}h)
                        </span>
                      </th>
                      <td className="px-4 py-3">
                        {a.descricaoComprovante}
                        <span className="block text-xs text-slate-600">
                          Cert. {a.codigoCertificado} · {formatarData(dataDoBanco(a.dataRealizacao))}
                          {(a.orientador?.nome ?? a.orientadorExterno) && ` · Orientação: ${a.orientador?.nome ?? a.orientadorExterno}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatarHoras(a.quantidadeInformada)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatarHoras(a.horasCalculadas)}h
                        {!a.aprovada ? (
                          <span className="block text-xs font-semibold">✖ Glosada</span>
                        ) : (
                          a.horasCalculadas < bruto && <span className="block text-xs text-amber-900">⚠ teto da categoria</span>
                        )}
                      </td>
                      {editavel && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <BotaoAtividade
                              atividadeId={a.id}
                              operacao={a.aprovada ? 'glosar' : 'aprovar'}
                              rotulo={a.aprovada ? 'Glosar' : 'Aprovar'}
                              rotuloAcessivel={`${a.aprovada ? 'Glosar' : 'Aprovar'} ${a.descricaoComprovante}`}
                            />
                            <BotaoAtividade atividadeId={a.id} operacao="remover" rotulo="Remover" rotuloAcessivel={`Remover ${a.descricaoComprovante}`} />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editavel && (
        <section aria-labelledby="lancar" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="lancar" className="mb-1 text-lg font-semibold text-slate-900">Lançar atividade</h2>
          <p className="mb-4 text-sm text-slate-700">
            O sistema aplica a quantidade máxima e o teto de horas da categoria somando todas as atividades. Cada certificado só pode ser usado
            uma vez.
          </p>
          <FormularioAtividade
            solicitacaoId={s.id}
            categorias={regras.map((r) => ({ valor: r.id, rotulo: `${NOME_GRUPO_ROMANO[r.grupo]} — ${r.descricao} (${r.ponderacaoTexto})` }))}
            docentes={docentes.map((d) => ({ valor: d.id, rotulo: d.nome }))}
          />
        </section>
      )}

      {podeGerenciar && (
        <section aria-labelledby="decisao" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="decisao" className="mb-4 text-lg font-semibold text-slate-900">Situação da solicitação</h2>
          <FormularioDecisaoPpi solicitacaoId={s.id} status={s.status} observacoes={s.observacoes ?? ''} />
        </section>
      )}
    </div>
  );
}
