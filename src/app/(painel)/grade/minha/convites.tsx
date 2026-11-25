'use client';

import { useActionState } from 'react';
import { cancelarAusenciaInformada, responderConvite, type EstadoCancelamento, type EstadoConvite } from '../../ausencias/actions';

/** Aceitar ou recusar um convite de substituição (sem JavaScript: dois botões no mesmo formulário). */
export function RespostaConvite({ conviteId, descricao }: { conviteId: string; descricao: string }) {
  const [estado, acao, enviando] = useActionState<EstadoConvite | undefined, FormData>(responderConvite, undefined);
  if (estado?.sucesso) {
    return (
      <p role="status" className="text-sm font-semibold text-if-verde-800">
        {estado.mensagem}
      </p>
    );
  }
  return (
    <form action={acao} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="conviteId" value={conviteId} />
      <button
        type="submit"
        name="resposta"
        value="aceitar"
        disabled={enviando}
        aria-label={`Aceitar: ${descricao}`}
        className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800 disabled:opacity-70"
      >
        Aceitar
      </button>
      <button
        type="submit"
        name="resposta"
        value="recusar"
        disabled={enviando}
        aria-label={`Recusar: ${descricao}`}
        className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-70"
      >
        Recusar
      </button>
      {estado?.mensagem && <span className="w-full text-sm text-if-vermelho-700">{estado.mensagem}</span>}
    </form>
  );
}

/** RF02-A: o docente desiste da ausência que informou, enquanto a Coordenação não decidiu a cobertura. */
export function CancelarAusenciaInformada({ ausenciaId, descricao }: { ausenciaId: string; descricao: string }) {
  const [estado, acao, enviando] = useActionState<EstadoCancelamento | undefined, FormData>(cancelarAusenciaInformada, undefined);
  if (estado?.sucesso) {
    return (
      <p role="status" className="text-sm font-semibold text-if-verde-800">
        {estado.mensagem}
      </p>
    );
  }
  return (
    <form action={acao} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="ausenciaId" value={ausenciaId} />
      <button
        type="submit"
        disabled={enviando}
        aria-label={`Cancelar a ausência informada: ${descricao}`}
        className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-70"
      >
        Cancelar
      </button>
      {estado?.mensagem && <span className="w-full text-sm text-if-vermelho-700">{estado.mensagem}</span>}
    </form>
  );
}
