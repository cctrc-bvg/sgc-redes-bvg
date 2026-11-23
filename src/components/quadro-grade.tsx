import { chaveCelula, DIAS_SEMANA, NOME_DIA } from '@/lib/grade/regras';

export interface BlocoQuadro {
  id: string;
  turno: string;
  ordem: number;
  horaInicio: string;
  horaFim: string;
}

export interface ConteudoCelula {
  titulo: string;
  detalhe?: string;
}

export const rotuloBloco = (b: { turno: string; ordem: number }) =>
  `${'ABCDEFGH'[b.ordem - 1] ?? b.ordem} ${b.turno === 'MANHA' ? 'Manhã' : 'Tarde'}`;

/**
 * Quadro semanal (blocos × segunda a sexta), somente leitura. Tabela com cabeçalhos de linha e coluna
 * para leitores de tela; janelas livres com ícone + texto (não só cor).
 */
export function QuadroGrade({
  blocos,
  celulas,
  janelas,
  legenda,
}: {
  blocos: readonly BlocoQuadro[];
  celulas: ReadonlyMap<string, ConteudoCelula[]>;
  janelas?: ReadonlySet<string>;
  legenda: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[52rem] table-fixed border-collapse text-left text-sm">
        <caption className="sr-only">{legenda}</caption>
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th scope="col" className="w-32 border-b border-slate-200 px-3 py-2 font-semibold">
              Horário
            </th>
            {DIAS_SEMANA.map((d) => (
              <th key={d} scope="col" className="border-b border-l border-slate-200 px-3 py-2 font-semibold">
                {NOME_DIA[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {blocos.map((b, i) => (
            <tr key={b.id} className={i > 0 && blocos[i - 1].turno !== b.turno ? 'border-t-4 border-slate-300' : 'border-t border-slate-200'}>
              <th scope="row" className="px-3 py-2 align-top font-semibold text-slate-800">
                {rotuloBloco(b)}
                <span className="block text-xs font-normal text-slate-600">
                  {b.horaInicio}–{b.horaFim}
                </span>
              </th>
              {DIAS_SEMANA.map((d) => {
                const chave = chaveCelula(d, b.id);
                const conteudo = celulas.get(chave);
                return (
                  <td key={d} className="border-l border-slate-200 px-3 py-2 align-top">
                    {conteudo?.length ? (
                      conteudo.map((c, j) => (
                        <div key={j} className={j > 0 ? 'mt-1 border-t border-slate-200 pt-1' : ''}>
                          <span className="block font-semibold text-slate-900">{c.titulo}</span>
                          {c.detalhe && <span className="block text-slate-600">{c.detalhe}</span>}
                        </div>
                      ))
                    ) : janelas?.has(chave) ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
                        <span aria-hidden="true">◌</span> Janela livre
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">Sem aula</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Seletor de ano e semestre letivo por GET (funciona sem JavaScript). */
export function SeletorPeriodo({ anoLetivo, semestreLetivo, anos }: { anoLetivo: number; semestreLetivo: number; anos: number[] }) {
  const classeSelect =
    'mt-1 block min-h-11 rounded-md border border-slate-400 bg-white px-3 py-2 text-base text-slate-900 focus:border-if-verde-700 focus:outline-none focus:ring-2 focus:ring-if-verde-700';
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="ano" className="block text-sm font-semibold text-slate-800">
          Ano letivo
        </label>
        <select id="ano" name="ano" defaultValue={String(anoLetivo)} className={classeSelect}>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="sem" className="block text-sm font-semibold text-slate-800">
          Semestre
        </label>
        <select id="sem" name="sem" defaultValue={String(semestreLetivo)} className={classeSelect}>
          <option value="1">1º semestre</option>
          <option value="2">2º semestre</option>
        </select>
      </div>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100"
      >
        Ver período
      </button>
    </form>
  );
}
