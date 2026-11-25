import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/campo';
import { LinkExportar, LinkImpressao } from '@/components/barra-impressao';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { formatarData } from '@/lib/ausencias/regras';
import { DIAS_LETIVOS_ANO, DIAS_POR_ETAPA, MESES, NOME_TIPO_EVENTO, datasEntre, diaDaSemanaISO, nomeEtapa, situacaoDasAulas } from '@/lib/calendario/regras';
import { carregarAno } from '@/lib/calendario/servidor';
import { NOME_DIA_EXTENSO } from '@/lib/grade/regras';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';
import { montarDias } from './dias';
import { Legenda, MesCompacto, MesDetalhado } from './mes';

export const metadata: Metadata = { title: 'Calendário acadêmico — SGC-Redes' };

const AVISOS: Record<string, string> = {
  criado: 'Evento cadastrado.',
  removido: 'Evento removido.',
  etapas: 'Etapas e semestres salvos.',
};

const saldo = (valor: number, meta: number) => {
  const d = valor - meta;
  return d === 0 ? (
    <span className="text-if-verde-800">✔ na meta</span>
  ) : d > 0 ? (
    <span className="text-if-verde-800">+{d}</span>
  ) : (
    <span className="font-semibold text-if-vermelho-700">
      <span aria-hidden="true">⚠ </span>faltam {-d}
    </span>
  );
};

const periodo = (i: { inicio: string; fim: string } | null) => (i ? `${formatarData(i.inicio)} a ${formatarData(i.fim)}` : 'não cadastrado');

export default async function PaginaCalendario({ searchParams }: { searchParams: Promise<{ ano?: string; mes?: string; aviso?: string }> }) {
  const { usuario } = await exigirPermissao('calendario:ver');
  const podeEditar = temPermissao(usuario, 'calendario:gerenciar');
  const sp = await searchParams;
  const ano = lerAnoLetivo(sp.ano) ?? anoLetivoAtual();
  const mes = /^(?:[1-9]|1[0-2])$/.test(sp.mes ?? '') ? Number(sp.mes) : null;
  const cal = await carregarAno(ano);

  const dias = montarDias(cal);

  const totalLetivos = cal.contagem.letivos.length;
  const perdidos = cal.contagem.perdidosImprevistos.length;
  const contarTipo = (mesN: number, tipos: string[]) =>
    cal.eventos.filter((e) => tipos.includes(e.tipo)).reduce((n, e) => n + [...datasEntre(e.inicio, e.fim)].filter((d) => Number(d.slice(5, 7)) === mesN && d.startsWith(`${ano}`) && diaDaSemanaISO(d) % 6 !== 0).length, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendário acadêmico {ano}</h1>
          <p className="mt-1 text-slate-700">
            Dias letivos por mês, etapa e ano (meta de {DIAS_LETIVOS_ANO} no ano e {DIAS_POR_ETAPA} por etapa), sábados letivos, feriados e eventos.
          </p>
        </div>
        <nav aria-label="Ano" className="flex items-center gap-3 text-sm">
          <Link href={`/calendario?ano=${ano - 1}${mes ? `&mes=${mes}` : ''}`} className="text-if-verde-700 underline underline-offset-2">
            ← {ano - 1}
          </Link>
          <Link href={`/calendario?ano=${ano + 1}${mes ? `&mes=${mes}` : ''}`} className="text-if-verde-700 underline underline-offset-2">
            {ano + 1} →
          </Link>
        </nav>
      </div>

      {sp.aviso && AVISOS[sp.aviso] && (
        <div className="mt-4">
          <Alerta tipo="sucesso">{AVISOS[sp.aviso]}</Alerta>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <LinkImpressao href={`/calendario/imprimir?ano=${ano}`} />
        <LinkExportar href={`/exportar/calendario?ano=${ano}`} />
      </div>
      {podeEditar && (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/calendario/eventos/novo${mes ? `?inicio=${ano}-${String(mes).padStart(2, '0')}-01` : ''}`} className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
            Novo evento
          </Link>
          <Link href={`/calendario/etapas?ano=${ano}`} className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
            Etapas e semestres
          </Link>
          <Link href="/grade/sabados" className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
            Sábados letivos
          </Link>
          <Link href={`/calendario/importar?ano=${ano}`} className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
            Importar planilha
          </Link>
        </div>
      )}

      {cal.avisos.map((a) => (
        <div key={a} className="mt-4">
          <Alerta tipo="erro">{a}</Alerta>
        </div>
      ))}

      {!cal.intervalo && (
        <div className="mt-4">
          <Alerta tipo="info">
            Cadastre as etapas (N1 a N4) ou os semestres de {ano} para o sistema contar os dias letivos.{podeEditar ? ' Use "Etapas e semestres".' : ''}
          </Alerta>
        </div>
      )}

      <section aria-labelledby="resumo" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="resumo" className="text-lg font-semibold text-slate-900">Resumo de dias letivos</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Dias letivos por etapa, semestre e ano</caption>
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-700">
                <th scope="col" className="py-2 pr-3">Período</th>
                <th scope="col" className="py-2 pr-3">Datas</th>
                <th scope="col" className="py-2 pr-3 text-right">Dias letivos</th>
                <th scope="col" className="py-2 pr-3 text-right">Meta</th>
                <th scope="col" className="py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {cal.etapas.map((e, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <th scope="row" className="py-2 pr-3 text-left font-semibold">Etapa {nomeEtapa(i + 1)}</th>
                  <td className="py-2 pr-3">{periodo(e)}</td>
                  <td className="py-2 pr-3 text-right">{cal.porEtapa[i] ?? '—'}</td>
                  <td className="py-2 pr-3 text-right">{DIAS_POR_ETAPA}</td>
                  <td className="py-2 text-right">{cal.porEtapa[i] === null ? '—' : saldo(cal.porEtapa[i]!, DIAS_POR_ETAPA)}</td>
                </tr>
              ))}
              {cal.semestres.map((s, i) => (
                <tr key={`s${i}`} className="border-b border-slate-100">
                  <th scope="row" className="py-2 pr-3 text-left font-semibold">{i + 1}º semestre</th>
                  <td className="py-2 pr-3">{periodo(s)}</td>
                  <td className="py-2 pr-3 text-right">{cal.porSemestre[i] ?? '—'}</td>
                  <td className="py-2 pr-3 text-right">{DIAS_LETIVOS_ANO / 2}</td>
                  <td className="py-2 text-right">{cal.porSemestre[i] === null ? '—' : saldo(cal.porSemestre[i]!, DIAS_LETIVOS_ANO / 2)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row" className="py-2 pr-3 text-left">Ano letivo</th>
                <td className="py-2 pr-3">{periodo(cal.intervalo)}</td>
                <td className="py-2 pr-3 text-right">{totalLetivos}</td>
                <td className="py-2 pr-3 text-right">{DIAS_LETIVOS_ANO}</td>
                <td className="py-2 text-right">{cal.intervalo ? saldo(totalLetivos, DIAS_LETIVOS_ANO) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          {cal.contagem.sabados.length} sábado(s) letivo(s) contado(s).
          {perdidos > 0 && (
            <strong className="text-if-vermelho-700">
              {' '}
              {perdidos} dia(s) letivo(s) perdido(s) por alterações imprevistas ({cal.contagem.perdidosImprevistos.map(formatarData).join(', ')}): programe a reposição
              (ex.: sábados letivos).
            </strong>
          )}
        </p>
      </section>

      <section aria-labelledby="por-mes" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="por-mes" className="text-lg font-semibold text-slate-900">Dias letivos por mês</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-700">
                <th scope="col" className="py-2 pr-3">Mês</th>
                <th scope="col" className="py-2 pr-3 text-right">Dias letivos</th>
                <th scope="col" className="py-2 pr-3 text-right">Sábados letivos</th>
                <th scope="col" className="py-2 pr-3 text-right">Feriados e pontos facultativos</th>
                <th scope="col" className="py-2 text-right">Suspensões</th>
              </tr>
            </thead>
            <tbody>
              {MESES.map((nome, i) => {
                const chave = `${ano}-${String(i + 1).padStart(2, '0')}`;
                return (
                  <tr key={nome} className="border-b border-slate-100">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal capitalize">
                      <Link href={`/calendario?ano=${ano}&mes=${i + 1}`} className="text-if-verde-700 underline underline-offset-2">
                        {nome}
                      </Link>
                    </th>
                    <td className="py-1.5 pr-3 text-right font-semibold">{cal.porMes.get(chave) ?? 0}</td>
                    <td className="py-1.5 pr-3 text-right">{cal.contagem.sabados.filter((d) => d.startsWith(chave)).length}</td>
                    <td className="py-1.5 pr-3 text-right">{contarTipo(i + 1, ['FERIADO', 'PONTO_FACULTATIVO'])}</td>
                    <td className="py-1.5 text-right">{contarTipo(i + 1, ['SUSPENSAO_AULAS'])}</td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <th scope="row" className="py-2 pr-3 text-left">Total</th>
                <td className="py-2 pr-3 text-right">{totalLetivos}</td>
                <td className="py-2 pr-3 text-right">{cal.contagem.sabados.length}</td>
                <td className="py-2 pr-3 text-right">{MESES.reduce((n, _, i) => n + contarTipo(i + 1, ['FERIADO', 'PONTO_FACULTATIVO']), 0)}</td>
                <td className="py-2 text-right">{MESES.reduce((n, _, i) => n + contarTipo(i + 1, ['SUSPENSAO_AULAS']), 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="visao" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="visao" className="text-lg font-semibold capitalize text-slate-900">
            {mes ? `${MESES[mes - 1]} de ${ano}` : `Visão do ano ${ano}`}
          </h2>
          <nav aria-label="Visão" className="flex flex-wrap items-center gap-3 text-sm">
            {mes ? (
              <>
                {mes > 1 && (
                  <Link href={`/calendario?ano=${ano}&mes=${mes - 1}`} className="text-if-verde-700 underline underline-offset-2">
                    ← {MESES[mes - 2]}
                  </Link>
                )}
                {mes < 12 && (
                  <Link href={`/calendario?ano=${ano}&mes=${mes + 1}`} className="text-if-verde-700 underline underline-offset-2">
                    {MESES[mes]} →
                  </Link>
                )}
                <Link href={`/calendario?ano=${ano}`} className="text-if-verde-700 underline underline-offset-2">
                  Ver o ano
                </Link>
              </>
            ) : (
              <span className="text-slate-700">Clique num mês para ver os eventos de cada dia.</span>
            )}
          </nav>
        </div>
        <div className="mt-3">
          <Legenda />
        </div>
        <div className="mt-4">
          {mes ? (
            <MesDetalhado ano={ano} mes={mes} dias={dias} podeEditar={podeEditar} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MESES.map((_, i) => (
                <MesCompacto key={i} ano={ano} mes={i + 1} dias={dias} letivos={cal.porMes.get(`${ano}-${String(i + 1).padStart(2, '0')}`) ?? 0} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="eventos" className="mt-8">
        <h2 id="eventos" className="text-lg font-semibold text-slate-900">
          Eventos {mes ? `de ${MESES[mes - 1]}` : `de ${ano}`}
        </h2>
        {(() => {
          const lista = mes
            ? cal.eventos.filter((e) => e.inicio <= `${ano}-${String(mes).padStart(2, '0')}-31` && e.fim >= `${ano}-${String(mes).padStart(2, '0')}-01`)
            : cal.eventos;
          return lista.length === 0 ? (
            <p className="mt-2 text-slate-700">Nenhum evento cadastrado.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-slate-700">
                    <th scope="col" className="px-3 py-2">Período</th>
                    <th scope="col" className="px-3 py-2">Tipo</th>
                    <th scope="col" className="px-3 py-2">Descrição</th>
                    <th scope="col" className="px-3 py-2">Aulas</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 whitespace-nowrap">{e.inicio === e.fim ? formatarData(e.inicio) : `${formatarData(e.inicio)} a ${formatarData(e.fim)}`}</td>
                      <td className="px-3 py-2">
                        {podeEditar ? (
                          <Link href={`/calendario/eventos/${e.id}`} className="text-if-verde-700 underline underline-offset-2">
                            {NOME_TIPO_EVENTO[e.tipo]}
                          </Link>
                        ) : (
                          NOME_TIPO_EVENTO[e.tipo]
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {e.descricao ?? '—'}
                        {e.motivo ? ` (${e.motivo})` : ''}
                      </td>
                      <td className="px-3 py-2">
                        {situacaoDasAulas(e)}
                        {e.imprevisto ? ' · imprevisto (repor)' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </section>
    </>
  );
}
