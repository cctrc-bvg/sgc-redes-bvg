import Link from 'next/link';
import type { TipoEventoCalendario } from '@prisma/client';
import { COR_TIPO_EVENTO, MESES, NOME_TIPO_EVENTO, semanasDoMes } from '@/lib/calendario/regras';
import { NOME_DIA_EXTENSO } from '@/lib/grade/regras';

export interface InfoDia {
  letivo: boolean;
  sabadoRef: number | null;
  eventos: { id: string; tipo: TipoEventoCalendario; titulo: string; suspende: boolean }[];
}

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const SEMANA_LONGA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Descrição do dia para leitores de tela e dica ao passar o mouse. */
function descricao(d: string, info: InfoDia | undefined) {
  const partes = [`${Number(d.slice(8))} de ${MESES[Number(d.slice(5, 7)) - 1]}`];
  if (info?.letivo) partes.push(info.sabadoRef ? `sábado letivo (grade de ${NOME_DIA_EXTENSO[info.sabadoRef]})` : 'dia letivo');
  else partes.push('sem aula');
  for (const e of info?.eventos ?? []) partes.push(e.titulo);
  return partes.join(' · ');
}

function classeDoDia(d: string, info: InfoDia | undefined) {
  const primeiro = info?.eventos[0];
  if (primeiro) return `${COR_TIPO_EVENTO[primeiro.tipo]} border`;
  if (info?.sabadoRef) return 'bg-if-verde-50 border border-if-verde-700';
  if (info?.letivo) return 'bg-white border border-slate-200';
  return 'bg-slate-100 border border-slate-100 text-slate-600'; // contraste AA (4,5:1) sobre o cinza
}

/** Mês compacto (visão anual): um quadrado por dia, cor pelo primeiro evento. */
export function MesCompacto({ ano, mes, dias, letivos }: { ano: number; mes: number; dias: ReadonlyMap<string, InfoDia>; letivos: number }) {
  return (
    <section aria-label={`${MESES[mes - 1]} de ${ano}`} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="flex items-baseline justify-between">
        <Link href={`/calendario?ano=${ano}&mes=${mes}`} className="font-semibold capitalize text-if-verde-700 underline underline-offset-2">
          {MESES[mes - 1]}
        </Link>
        <span className="text-sm text-slate-700">{letivos} dia(s) letivo(s)</span>
      </h3>
      <table className="mt-2 w-full table-fixed text-center text-xs">
        <thead>
          <tr>
            {SEMANA.map((s, i) => (
              <th key={i} scope="col" className="font-semibold text-slate-600">
                <abbr title={SEMANA_LONGA[i]} className="no-underline">
                  {s}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanasDoMes(ano, mes).map((semana, i) => (
            <tr key={i}>
              {semana.map((d, j) => (
                <td key={j} className="p-0.5">
                  {d && (
                    <span title={descricao(d, dias.get(d))} className={`block rounded py-0.5 ${classeDoDia(d, dias.get(d))}`}>
                      <span aria-hidden="true">{Number(d.slice(8))}</span>
                      <span className="sr-only">{descricao(d, dias.get(d))}</span>
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Mês detalhado: eventos escritos em cada dia. */
export function MesDetalhado({ ano, mes, dias, podeEditar }: { ano: number; mes: number; dias: ReadonlyMap<string, InfoDia>; podeEditar: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] table-fixed border-collapse text-sm">
        <caption className="sr-only">
          {MESES[mes - 1]} de {ano}
        </caption>
        <thead>
          <tr>
            {SEMANA_LONGA.map((s) => (
              <th key={s} scope="col" className="border-b border-slate-300 py-2 text-slate-700">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanasDoMes(ano, mes).map((semana, i) => (
            <tr key={i}>
              {semana.map((d, j) => {
                const info = d ? dias.get(d) : undefined;
                return (
                  <td key={j} className={`h-24 border border-slate-200 p-1 align-top ${d ? (info?.letivo ? 'bg-white' : 'bg-slate-50') : 'bg-slate-100'}`}>
                    {d && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          {podeEditar ? (
                            <Link href={`/calendario/eventos/novo?inicio=${d}`} className="font-semibold text-if-verde-700 underline underline-offset-2" title="Novo evento neste dia">
                              {Number(d.slice(8))}
                            </Link>
                          ) : (
                            <span className="font-semibold text-slate-800">{Number(d.slice(8))}</span>
                          )}
                          <span className="text-xs text-slate-600">{info?.letivo ? (info.sabadoRef ? `Letivo (${NOME_DIA_EXTENSO[info.sabadoRef]})` : 'Letivo') : 'Sem aula'}</span>
                        </div>
                        {info?.eventos.map((e) => (
                          <p key={e.id} className={`rounded border px-1 text-xs leading-tight ${COR_TIPO_EVENTO[e.tipo]}`}>
                            {podeEditar ? (
                              <Link href={`/calendario/eventos/${e.id}`} className="underline underline-offset-2">
                                {e.titulo}
                              </Link>
                            ) : (
                              e.titulo
                            )}
                          </p>
                        ))}
                      </div>
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

export function Legenda() {
  return (
    <ul className="flex flex-wrap gap-2 text-xs text-slate-800" aria-label="Legenda">
      <li className="rounded border border-slate-200 bg-white px-2 py-0.5">Dia letivo</li>
      <li className="rounded border border-if-verde-700 bg-if-verde-50 px-2 py-0.5">Sábado letivo</li>
      <li className="rounded border border-slate-100 bg-slate-100 px-2 py-0.5">Sem aula</li>
      {(Object.keys(NOME_TIPO_EVENTO) as TipoEventoCalendario[]).map((t) => (
        <li key={t} className={`rounded border px-2 py-0.5 ${COR_TIPO_EVENTO[t]}`}>
          {NOME_TIPO_EVENTO[t]}
        </li>
      ))}
    </ul>
  );
}
