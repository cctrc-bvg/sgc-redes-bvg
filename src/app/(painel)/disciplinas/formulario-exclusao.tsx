'use client';

import { useActionState } from 'react';
import { Alerta } from '@/components/campo';
import { excluirDisciplina, type EstadoDisciplina } from './actions';

/** Exclusão definitiva, só para disciplinas nunca usadas (cadastro por engano). */
export function FormularioExclusao({ disciplinaId }: { disciplinaId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoDisciplina | undefined, FormData>(excluirDisciplina, undefined);

  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <input type="hidden" name="disciplinaId" value={disciplinaId} />
      <div className="flex items-start gap-3">
        <input id="confirmo" name="confirmo" type="checkbox" className="mt-1 size-5 accent-if-vermelho-700" />
        <label htmlFor="confirmo" className="text-slate-800">
          Confirmo que esta disciplina foi cadastrada por engano e quero excluí-la definitivamente.
        </label>
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md border border-if-vermelho-700 bg-white px-4 font-semibold text-if-vermelho-700 hover:bg-if-vermelho-50 disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? 'Excluindo…' : 'Excluir disciplina'}
      </button>
    </form>
  );
}
