'use client';

import { useActionState } from 'react';
import { Alerta } from '@/components/campo';
import { SeletorModo } from '@/components/seletor-modo';
import { registrarEnvioDoDia, type EstadoEnvioDia } from './actions';

export function FormularioEnvioDoDia({ data, chave, gatilho, mostrarWhatsapp }: { data: string; chave: string; gatilho: string; mostrarWhatsapp: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoEnvioDia | undefined, FormData>(registrarEnvioDoDia, undefined);
  return (
    <div className="space-y-2 border-t border-slate-200 pt-3">
      <form action={acao} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="data" value={data} />
        <input type="hidden" name="chave" value={chave} />
        <input type="hidden" name="gatilho" value={gatilho} />
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
