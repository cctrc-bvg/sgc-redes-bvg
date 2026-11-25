'use client';

import { useActionState } from 'react';
import { Alerta, BotaoPrimario, BotaoSecundario } from '@/components/campo';
import { copiarAnuaisDoPrimeiroSemestre, salvarGrade, type EstadoGrade } from '../../../actions';

export interface CelulaEditavel {
  chave: string; // "<dia>:<blocoId>"
  campo: string; // nome do campo no formulário
  rotulo: string; // "Segunda, A Manhã (07:30–08:30)" — rótulo acessível
  valor: string; // ofertaId atual ou ""
}

export interface LinhaEditavel {
  rotuloBloco: string;
  horario: string;
  separaTurno: boolean;
  celulas: CelulaEditavel[];
}

interface Contexto {
  turmaId: string;
  anoLetivo: number;
  semestreLetivo: number;
}

function CamposOcultos({ turmaId, anoLetivo, semestreLetivo }: Contexto) {
  return (
    <>
      <input type="hidden" name="turmaId" value={turmaId} />
      <input type="hidden" name="anoLetivo" value={anoLetivo} />
      <input type="hidden" name="semestreLetivo" value={semestreLetivo} />
    </>
  );
}

export function FormularioGrade(props: Contexto & { dias: string[]; linhas: LinhaEditavel[]; opcoes: { valor: string; rotulo: string }[] }) {
  const [estado, acao, enviando] = useActionState<EstadoGrade | undefined, FormData>(salvarGrade, undefined);

  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <CamposOcultos {...props} />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[60rem] table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">Edição da grade: escolha a disciplina de cada horário</caption>
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th scope="col" className="w-28 border-b border-slate-200 px-3 py-2 font-semibold">
                Horário
              </th>
              {props.dias.map((d) => (
                <th key={d} scope="col" className="border-b border-l border-slate-200 px-3 py-2 font-semibold">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.linhas.map((l) => (
              <tr key={l.rotuloBloco} className={l.separaTurno ? 'border-t-4 border-slate-300' : 'border-t border-slate-200'}>
                <th scope="row" className="px-3 py-2 align-top font-semibold text-slate-800">
                  {l.rotuloBloco}
                  <span className="block text-xs font-normal text-slate-600">{l.horario}</span>
                </th>
                {l.celulas.map((c) => {
                  const erro = estado?.erros?.[c.chave];
                  return (
                    <td key={c.chave} className="border-l border-slate-200 px-2 py-2 align-top">
                      <label htmlFor={c.campo} className="sr-only">
                        {c.rotulo}
                      </label>
                      <select
                        key={estado?.valores?.[c.chave] ?? c.valor}
                        id={c.campo}
                        name={c.campo}
                        defaultValue={estado?.valores?.[c.chave] ?? c.valor}
                        aria-invalid={erro ? true : undefined}
                        aria-describedby={erro ? `${c.campo}-erro` : undefined}
                        className={`block min-h-11 w-full rounded-md border bg-white px-2 py-1 text-sm text-slate-900 focus:border-if-verde-700 focus:outline-none focus:ring-2 focus:ring-if-verde-700 ${
                          erro ? 'border-if-vermelho-700' : 'border-slate-400'
                        }`}
                      >
                        {props.opcoes.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.rotulo}
                          </option>
                        ))}
                      </select>
                      {erro && (
                        <p id={`${c.campo}-erro`} className="mt-1 text-xs text-if-vermelho-700">
                          {erro}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : 'Salvar grade'}</BotaoPrimario>
      </div>
    </form>
  );
}

export function FormularioCopiarAnuais(props: Contexto) {
  const [estado, acao, enviando] = useActionState<EstadoGrade | undefined, FormData>(copiarAnuaisDoPrimeiroSemestre, undefined);
  return (
    <form action={acao} className="space-y-3">
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <CamposOcultos {...props} />
      <BotaoSecundario disabled={enviando}>{enviando ? 'Copiando…' : 'Copiar aulas anuais do 1º semestre'}</BotaoSecundario>
    </form>
  );
}
