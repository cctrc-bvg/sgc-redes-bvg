'use client';

import { useActionState } from 'react';
import { ajustarQuantidade, cancelarAcrescimo, darCiencia, type EstadoAviso } from './actions';

const classeMensagem = (sucesso?: boolean) => `text-sm font-semibold ${sucesso ? 'text-if-verde-800' : 'text-if-vermelho-700'}`;

export function FormularioCiencia({ alertaId }: { alertaId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoAviso | undefined, FormData>(darCiencia, undefined);
  return (
    <form action={acao} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="alertaId" value={alertaId} />
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800 disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? 'Registrando…' : 'Dar ciência'}
      </button>
      {estado?.mensagem && (
        <span role="status" className={classeMensagem(estado.sucesso)}>
          {estado.mensagem}
        </span>
      )}
    </form>
  );
}

export function FormularioQuantidade({ alertaId, quantidade }: { alertaId: string; quantidade: number }) {
  const [estado, acao, enviando] = useActionState<EstadoAviso | undefined, FormData>(ajustarQuantidade, undefined);
  const id = `qtd-${alertaId}`;
  return (
    <form action={acao} className="flex flex-wrap items-end gap-2" noValidate>
      <input type="hidden" name="alertaId" value={alertaId} />
      <div>
        <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
          Quantidade
        </label>
        <input
          id={id}
          name="qtdImpactada"
          inputMode="numeric"
          maxLength={2}
          defaultValue={String(quantidade)}
          className="mt-1 block w-20 rounded-md border border-slate-400 bg-white px-3 py-2 text-base text-slate-900"
        />
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? 'Salvando…' : 'Ajustar'}
      </button>
      {estado?.mensagem && (
        <span role="status" className={`w-full ${classeMensagem(estado.sucesso)}`}>
          {estado.mensagem}
        </span>
      )}
    </form>
  );
}

export function FormularioCancelarAcrescimo({ alertaId }: { alertaId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoAviso | undefined, FormData>(cancelarAcrescimo, undefined);
  return (
    <form action={acao} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="alertaId" value={alertaId} />
      <input type="hidden" name="cancelarAcrescimo" value="1" />
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md border border-if-vermelho-700 bg-white px-3 font-semibold text-if-vermelho-700 hover:bg-if-vermelho-50 disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? 'Cancelando…' : 'Cancelar acréscimo'}
      </button>
      {estado?.mensagem && (
        <span role="status" className={classeMensagem(estado.sucesso)}>
          {estado.mensagem}
        </span>
      )}
    </form>
  );
}
