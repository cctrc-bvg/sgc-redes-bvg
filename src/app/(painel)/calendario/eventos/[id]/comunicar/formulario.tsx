'use client';

import { useActionState } from 'react';
import { Alerta } from '@/components/campo';
import { SeletorModo } from '@/components/seletor-modo';
import { registrarEnvioEvento, type EstadoEnvioEvento } from '../../../actions';

export function FormularioEnvioEvento({ eventoId, chave, mostrarWhatsapp }: { eventoId: string; chave: string; mostrarWhatsapp: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoEnvioEvento | undefined, FormData>(registrarEnvioEvento, undefined);
  return (
    <div className="space-y-2 border-t border-slate-200 pt-3">
      <form action={acao} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="eventoId" value={eventoId} />
        <input type="hidden" name="chave" value={chave} />
        <SeletorModo id={`modo-${chave.replace(/[^a-zA-Z0-9]/g, '-')}`} mostrarWhatsapp={mostrarWhatsapp} />
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
