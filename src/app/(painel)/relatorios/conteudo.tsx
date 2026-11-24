import { COLUNAS_MENSAIS, nomeMes } from '@/lib/relatorios/agregacoes';
import type { DadosRelatorio } from '@/lib/relatorios/servidor';

/** Seções do relatório (tela e impressão). `impressao` troca cartões e sombras por bordas simples. */
export function ConteudoRelatorio({ r, impressao = false }: { r: DadosRelatorio; impressao?: boolean }) {
  const th = impressao ? 'border border-slate-400 px-2 py-1' : 'px-4 py-3 font-semibold';
  const td = impressao ? 'border border-slate-400 px-2 py-1 text-right tabular-nums' : 'px-4 py-3 text-right tabular-nums';
  const cartao = impressao ? 'break-inside-avoid rounded border border-slate-400 p-3' : 'rounded-lg border border-slate-200 bg-white p-5 shadow-sm';
  const valor = (l: DadosRelatorio['total'], campo: (typeof COLUNAS_MENSAIS)[number][0]) => (campo === 'cobertura' ? `${l.cobertura}%` : l[campo]);

  return (
    <>
      <section aria-labelledby="ausencias" className={impressao ? 'mt-4' : 'mt-8'}>
        <h2 id="ausencias" className="text-lg font-semibold text-slate-900">
          Ausências docentes e cobertura das aulas
        </h2>
        {r.linhas.length === 0 ? (
          <p className="mt-2 text-slate-700">Nenhuma ausência registrada em {r.ano}.</p>
        ) : (
          <div className={impressao ? 'mt-2' : 'mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm'}>
            <table className={`w-full text-left text-sm ${impressao ? 'border-collapse' : 'min-w-[44rem]'}`}>
              <caption className="sr-only">Ausências por mês com aulas perdidas e como foram cobertas</caption>
              <thead className={impressao ? '' : 'border-b border-slate-200 bg-slate-50 text-slate-700'}>
                <tr>
                  <th scope="col" className={th}>
                    Mês
                  </th>
                  {COLUNAS_MENSAIS.map(([campo, rotulo]) => (
                    <th key={campo} scope="col" className={`${th} text-right`}>
                      {rotulo.replace(' (%)', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={impressao ? '' : 'divide-y divide-slate-100'}>
                {r.linhas.map((l) => (
                  <tr key={l.mes}>
                    <th scope="row" className={`${th} font-semibold`}>
                      {nomeMes(l.mes)}
                    </th>
                    {COLUNAS_MENSAIS.map(([campo]) => (
                      <td key={campo} className={td}>
                        {valor(l, campo)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className={impressao ? 'font-semibold' : 'border-t border-slate-300 bg-slate-50 font-semibold'}>
                <tr>
                  <th scope="row" className={th}>
                    Total
                  </th>
                  {COLUNAS_MENSAIS.map(([campo]) => (
                    <td key={campo} className={td}>
                      {valor(r.total, campo)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <div className={`grid gap-6 ${impressao ? 'mt-4 grid-cols-3 gap-3' : 'mt-8 md:grid-cols-3'}`}>
        <section aria-labelledby="alimentacao" className={cartao}>
          <h2 id="alimentacao" className="font-semibold text-slate-900">
            Avisos de refeição ({r.alertas})
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-800">
            {r.sla.map((s) => (
              <li key={s.chave}>
                {s.icone} {s.rotulo}: {s.total}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="ppe" className={cartao}>
          <h2 id="ppe" className="font-semibold text-slate-900">
            PPE em {r.ano} ({r.ppes})
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-800">
            {r.ppePorStatus.map((p) => (
              <li key={p.rotulo}>
                {p.rotulo}: {p.total}
              </li>
            ))}
            <li className="font-semibold">Estudantes com alerta de retenção (Art. 115): {r.retidos}</li>
          </ul>
        </section>
        <section aria-labelledby="ppi" className={cartao}>
          <h2 id="ppi" className="font-semibold text-slate-900">
            PPI ({r.ppis} solicitações)
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-800">
            {r.ppiPorStatus.map((p) => (
              <li key={p.rotulo}>
                {p.rotulo}: {p.total}
              </li>
            ))}
            <li className="font-semibold">Com 40h ou mais validadas: {r.ppiConcluidas}</li>
          </ul>
        </section>
      </div>
    </>
  );
}
