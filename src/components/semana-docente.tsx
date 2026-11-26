import Link from 'next/link';
import { Icone } from '@/components/icone';
import { SeloPapel } from '@/components/papel';
import type { DiaDaAgenda } from '@/lib/painel/agenda';

/** Semana do docente: aulas, eventos e mudanças (substituições aceitas e aulas adiantadas) dia a dia. */
export function SemanaDoDocente({
  dias,
  acumula,
  navegacao,
}: {
  dias: DiaDaAgenda[];
  acumula: boolean;
  /** Em Minha grade: setas para ver outras semanas. Sem isso, é o resumo do painel, com link para a grade completa. */
  navegacao?: { anterior: string; proxima: string; atual: string; titulo: string; ehSemanaAtual: boolean };
}) {
  const cor = acumula ? 'text-docencia-700' : 'text-if-verde-700';
  return (
    <section aria-labelledby="semana" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="semana" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Icone nome="minha-grade" className={`size-5 ${cor}`} />
          Minha semana
          {acumula && <SeloPapel papel="docencia" cargo="" />}
        </h3>
        {!navegacao && (
          <Link href="/grade/minha" className={`text-sm underline underline-offset-2 ${cor}`}>
            Grade completa
          </Link>
        )}
      </div>
      {navegacao && (
        <nav aria-label="Semanas" className="flex flex-wrap items-center gap-2">
          <Link href={navegacao.anterior} className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100">
            <span aria-hidden="true">← </span>Semana anterior
          </Link>
          <span className="px-1 text-sm font-semibold text-slate-900" aria-live="polite">{navegacao.titulo}</span>
          <Link href={navegacao.proxima} className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100">
            Próxima semana<span aria-hidden="true"> →</span>
          </Link>
          {!navegacao.ehSemanaAtual && (
            <Link href={navegacao.atual} className={`text-sm underline underline-offset-2 ${cor}`}>
              Voltar para esta semana
            </Link>
          )}
        </nav>
      )}
      <ol className="space-y-2">
        {dias.map((d) => {
          // Dia sem aula, evento ou mudança: uma linha só, para a semana caber sem rolagem.
          const vazio = !d.semAula && !d.gradeDe && d.eventos.length === 0 && d.aulas.length === 0 && d.mudancas.length === 0;
          return (
            <li
              key={d.dataISO}
              aria-current={d.ehHoje ? 'date' : undefined}
              className={`rounded-lg border bg-white shadow-sm ${vazio ? 'px-3 py-2' : 'p-3'} ${d.ehHoje ? (acumula ? 'border-docencia-700 ring-1 ring-docencia-700' : 'border-if-verde-700 ring-1 ring-if-verde-700') : 'border-slate-200'}`}
            >
              <p className="flex items-center justify-between gap-2 font-semibold text-slate-900">
                <span>
                  {d.rotulo}
                  {vazio && <span className="font-normal text-slate-600"> · sem aulas suas</span>}
                </span>
                {d.ehHoje && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${acumula ? 'bg-docencia-50 text-docencia-800' : 'bg-if-verde-50 text-if-verde-800'}`}>Hoje</span>}
              </p>
              {d.gradeDe && <p className="text-xs text-slate-600">Sábado letivo: grade de {d.gradeDe}</p>}
              {d.semAula && <p className="mt-1 text-sm text-slate-600">{d.semAula}</p>}
              {d.eventos.map((e) => (
                <p key={e} className="mt-1 text-sm text-slate-700">
                  <Icone nome="calendario" className="mr-1 inline size-4 align-[-2px] text-slate-500" />
                  {e}
                </p>
              ))}
              {d.aulas.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-sm">
                  {d.aulas.map((a) => (
                    <li key={a.horario} title={a.horario} className={`flex gap-2 ${a.ausente ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                      <span className="w-11 shrink-0 font-semibold tabular-nums">{a.inicio}</span>
                      <span>
                        {a.turma} · {a.disciplina}
                      </span>
                      {a.ausente && <span className="sr-only"> (ausência registrada)</span>}
                    </li>
                  ))}
                </ul>
              )}
              {d.mudancas.map((m) => (
                <p key={`${m.bloco}-${m.tipo}`} className="mt-1 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">
                  <strong>{m.tipo === 'substituicao' ? 'Substituição' : 'Aula adiantada'}:</strong> {m.bloco} · {m.turma}. {m.detalhe}
                </p>
              ))}
              {!vazio && !d.semAula && d.aulas.length === 0 && d.mudancas.length === 0 && <p className="mt-1 text-sm text-slate-600">Sem aulas suas neste dia.</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
