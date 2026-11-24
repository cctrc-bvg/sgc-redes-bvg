import type { Metadata } from 'next';
import { BarraImpressao } from '@/components/barra-impressao';
import { exigirPermissao } from '@/lib/auth/dal';
import { formatarData } from '@/lib/ausencias/regras';
import { DIAS_LETIVOS_ANO, DIAS_POR_ETAPA, MESES, NOME_TIPO_EVENTO, nomeEtapa } from '@/lib/calendario/regras';
import { carregarAno } from '@/lib/calendario/servidor';
import { NOME_DIA_EXTENSO } from '@/lib/grade/regras';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';
import { montarDias } from '../dias';
import { Legenda, MesCompacto } from '../mes';

export const metadata: Metadata = { title: 'Calendário acadêmico (impressão) — SGC-Redes' };

const periodo = (i: { inicio: string; fim: string } | null) => (i ? `${formatarData(i.inicio)} a ${formatarData(i.fim)}` : '—');

/** Calendário do ano para imprimir ou salvar em PDF: resumo, 12 meses, sábados letivos e eventos. */
export default async function PaginaImprimirCalendario({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  await exigirPermissao('calendario:ver');
  const ano = lerAnoLetivo((await searchParams).ano) ?? anoLetivoAtual();
  const cal = await carregarAno(ano);
  const dias = montarDias(cal);
  return (
    <div className="bg-white p-4 text-sm text-slate-900 print:p-0">
      <BarraImpressao voltar={`/calendario?ano=${ano}`} rotulo="Voltar ao calendário" paisagem />
      <header className="text-center">
        <p className="font-semibold">INSTITUTO FEDERAL DO CEARÁ — CAMPUS BOA VIAGEM</p>
        <p>Curso Técnico Integrado em Redes de Computadores</p>
        <h1 className="mt-2 text-lg font-bold">CALENDÁRIO ACADÊMICO {ano}</h1>
      </header>

      <table className="mt-4 w-full border-collapse text-xs">
        <caption className="mb-1 text-left font-semibold">Dias letivos</caption>
        <thead>
          <tr>
            {['Período', 'Datas', 'Dias letivos', 'Meta'].map((t) => (
              <th key={t} scope="col" className="border border-slate-400 px-2 py-1 text-left">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cal.etapas.map((e, i) => (
            <tr key={i}>
              <th scope="row" className="border border-slate-400 px-2 py-1 text-left">Etapa {nomeEtapa(i + 1)}</th>
              <td className="border border-slate-400 px-2 py-1">{periodo(e)}</td>
              <td className="border border-slate-400 px-2 py-1">{cal.porEtapa[i] ?? '—'}</td>
              <td className="border border-slate-400 px-2 py-1">{DIAS_POR_ETAPA}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <th scope="row" className="border border-slate-400 px-2 py-1 text-left">Ano letivo</th>
            <td className="border border-slate-400 px-2 py-1">{periodo(cal.intervalo)}</td>
            <td className="border border-slate-400 px-2 py-1">{cal.contagem.letivos.length}</td>
            <td className="border border-slate-400 px-2 py-1">{DIAS_LETIVOS_ANO}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-xs">
        Por mês:{' '}
        {MESES.map((m, i) => `${m.slice(0, 3)} ${cal.porMes.get(`${ano}-${String(i + 1).padStart(2, '0')}`) ?? 0}`).join(' · ')}
      </p>

      <div className="mt-3">
        <Legenda />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 print:grid-cols-4">
        {MESES.map((_, i) => (
          <MesCompacto key={i} ano={ano} mes={i + 1} dias={dias} letivos={cal.porMes.get(`${ano}-${String(i + 1).padStart(2, '0')}`) ?? 0} />
        ))}
      </div>

      <section className="mt-4 break-before-page">
        <h2 className="font-semibold">Eventos e sábados letivos</h2>
        <table className="mt-1 w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Data', 'Evento', 'Aulas'].map((t) => (
                <th key={t} scope="col" className="border border-slate-400 px-2 py-1 text-left">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ...cal.eventos.map((e) => ({
                inicio: e.inicio,
                data: e.inicio === e.fim ? formatarData(e.inicio) : `${formatarData(e.inicio)} a ${formatarData(e.fim)}`,
                evento: `${NOME_TIPO_EVENTO[e.tipo]}${e.descricao ? `: ${e.descricao}` : ''}${e.motivo ? ` (${e.motivo})` : ''}`,
                aulas: e.suspendeAulas ? 'Sem aula' : 'Mantidas',
              })),
              ...cal.sabados.map((s) => ({
                inicio: s.data,
                data: formatarData(s.data),
                evento: `Sábado letivo (grade de ${NOME_DIA_EXTENSO[s.diaSemanaReferente]})${s.observacao ? ` — ${s.observacao}` : ''}`,
                aulas: 'Letivo',
              })),
            ]
              .sort((a, b) => a.inicio.localeCompare(b.inicio))
              .map((l, i) => (
                <tr key={i}>
                  <td className="border border-slate-400 px-2 py-1 whitespace-nowrap">{l.data}</td>
                  <td className="border border-slate-400 px-2 py-1">{l.evento}</td>
                  <td className="border border-slate-400 px-2 py-1">{l.aulas}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
