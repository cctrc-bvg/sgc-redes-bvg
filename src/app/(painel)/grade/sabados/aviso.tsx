import Link from 'next/link';
import { sabadosDoSemestre } from '@/lib/grade/consultas';
import { NOME_DIA_EXTENSO } from '@/lib/grade/regras';

export const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

/** Lista os sábados letivos do semestre e qual grade cada um segue (G14). */
export async function AvisoSabados({ anoLetivo, semestreLetivo }: { anoLetivo: number; semestreLetivo: number }) {
  const sabados = await sabadosDoSemestre(anoLetivo, semestreLetivo);
  return (
    <section aria-labelledby="sabados" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="sabados" className="font-semibold text-slate-900">
        Sábados letivos em {anoLetivo}.{semestreLetivo}
      </h2>
      {sabados.length === 0 ? (
        <p className="mt-1 text-sm text-slate-700">Nenhum sábado letivo cadastrado neste semestre.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-slate-800">
          {sabados.map((s) => (
            <li key={s.id}>
              <strong>{dataCurta.format(s.data)}</strong>: segue a grade de {NOME_DIA_EXTENSO[s.diaSemanaReferente]}
              {s.observacao && <span className="text-slate-600"> — {s.observacao}</span>}
            </li>
          ))}
        </ul>
      )}
      <Link href={`/grade/sabados?ano=${anoLetivo}&sem=${semestreLetivo}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-if-verde-700 underline underline-offset-2">
        Ver todos os sábados letivos
      </Link>
    </section>
  );
}
