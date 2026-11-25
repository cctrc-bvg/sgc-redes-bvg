'use client';

import { useActionState } from 'react';
import { Alerta } from '@/components/campo';
import { SeletorModo } from '@/components/seletor-modo';

type EstadoEnvio = { mensagem?: string; sucesso?: boolean };

/**
 * "Já enviei: registrar" de uma mensagem pronta. O contexto vai em campos ocultos (nunca acao.bind:
 * sem JavaScript, re-renderiza sem fim).
 */
export function FormularioRegistroEnvio({
  acao,
  ocultos,
  mostrarWhatsapp,
}: {
  acao: (estado: EstadoEnvio | undefined, formData: FormData) => Promise<EstadoEnvio>;
  ocultos: Record<string, string>;
  mostrarWhatsapp: boolean;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoEnvio | undefined, FormData>(acao, undefined);
  const id = `modo-${Object.values(ocultos).join('-').replace(/[^a-zA-Z0-9]/g, '-')}`;
  return (
    <div className="space-y-2 border-t border-slate-200 pt-3">
      <form action={enviar} className="flex flex-wrap items-end gap-3">
        {Object.entries(ocultos).map(([nome, valor]) => (
          <input key={nome} type="hidden" name={nome} value={valor} />
        ))}
        <SeletorModo id={id} mostrarWhatsapp={mostrarWhatsapp} />
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-70"
        >
          {enviando ? 'Registrando…' : 'Já enviei: registrar'}
        </button>
      </form>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
    </div>
  );
}
