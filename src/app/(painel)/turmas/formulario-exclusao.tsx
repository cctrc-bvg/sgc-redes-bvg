'use client';

import { useActionState } from 'react';
import { Alerta } from '@/components/campo';
import { excluirTurma, type EstadoTurma } from './actions';

/** Exclusão definitiva, só para turmas nunca usadas (cadastro por engano). */
export function FormularioExclusaoTurma({ turmaId }: { turmaId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoTurma | undefined, FormData>(excluirTurma, undefined);

  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <input type="hidden" name="turmaId" value={turmaId} />
      <div className="flex items-start gap-3">
        <input id="confirmo" name="confirmo" type="checkbox" className="mt-1 size-5 accent-if-vermelho-700" />
        <label htmlFor="confirmo" className="text-slate-800">
          Confirmo que esta turma foi cadastrada por engano e quero excluí-la definitivamente.
        </label>
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md border border-if-vermelho-700 bg-white px-4 font-semibold text-if-vermelho-700 hover:bg-if-vermelho-50 disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? 'Excluindo…' : 'Excluir turma'}
      </button>
    </form>
  );
}
