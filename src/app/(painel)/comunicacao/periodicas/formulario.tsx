'use client';

import { useActionState } from 'react';
import { Alerta } from '@/components/campo';
import { SeletorModo } from '@/components/seletor-modo';
import { registrarAvisoDoPeriodo, registrarResumoSemanal, type EstadoResumo } from './actions';

export function FormularioResumo({ segunda, avisoId, docenteId, mostrarWhatsapp, enviado }: { segunda?: string; avisoId?: string; docenteId: string; mostrarWhatsapp: boolean; enviado: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoResumo | undefined, FormData>(avisoId ? registrarAvisoDoPeriodo : registrarResumoSemanal, undefined);
  // Depois do registro a página volta com "enviado"; o formulário some, mas a confirmação continua visível.
  if (enviado && !estado?.mensagem) return null;
  return (
    <div className="space-y-2 border-t border-slate-200 pt-3">
      {!enviado && (
      <form action={acao} className="flex flex-wrap items-end gap-3">
        {segunda && <input type="hidden" name="segunda" value={segunda} />}
        {avisoId && <input type="hidden" name="avisoId" value={avisoId} />}
        <input type="hidden" name="docenteId" value={docenteId} />
        <SeletorModo id={`modo-${avisoId ?? 'resumo'}-${docenteId}`.replace(/[^a-zA-Z0-9_-]/g, '-')} mostrarWhatsapp={mostrarWhatsapp} />
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
        >
          {enviando ? 'Registrando…' : 'Já enviei: registrar'}
        </button>
      </form>
      )}
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
    </div>
  );
}
