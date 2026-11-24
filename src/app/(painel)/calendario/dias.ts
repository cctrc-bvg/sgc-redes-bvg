import { NOME_TIPO_EVENTO, datasEntre } from '@/lib/calendario/regras';
import type { carregarAno } from '@/lib/calendario/servidor';
import type { InfoDia } from './mes';

/** Informação de cada dia do ano: letivo, sábado letivo (grade de referência) e eventos. */
export function montarDias(cal: Awaited<ReturnType<typeof carregarAno>>): Map<string, InfoDia> {
  const { ano } = cal;
  const letivos = new Set(cal.contagem.letivos);
  const dias = new Map<string, InfoDia>();
  for (const d of datasEntre(`${ano}-01-01`, `${ano}-12-31`)) dias.set(d, { letivo: letivos.has(d), sabadoRef: null, eventos: [] });
  for (const s of cal.sabados) {
    const info = dias.get(s.data);
    if (info) info.sabadoRef = s.diaSemanaReferente;
  }
  for (const e of cal.eventos) {
    const titulo = e.descricao ? `${NOME_TIPO_EVENTO[e.tipo]}: ${e.descricao}` : NOME_TIPO_EVENTO[e.tipo];
    const de = e.inicio < `${ano}-01-01` ? `${ano}-01-01` : e.inicio;
    const ate = e.fim > `${ano}-12-31` ? `${ano}-12-31` : e.fim;
    for (const d of datasEntre(de, ate)) dias.get(d)?.eventos.unshift({ id: e.id, tipo: e.tipo, titulo, suspende: e.suspendeAulas });
  }
  return dias;
}
