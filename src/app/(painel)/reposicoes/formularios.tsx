'use client';

import { useActionState } from 'react';
import { Alerta, AreaTexto, BotaoPrimario, Campo } from '@/components/campo';
import { anexarFormulario, registrarReposicao, type EstadoReposicao } from './actions';

/** Informa (docente) ou registra (Coordenação) a reposição; o formulário em anexo é opcional. */
export function FormularioReposicao({ ausenciaId, dataMinima, dataMaxima, rotulo }: { ausenciaId: string; dataMinima: string; dataMaxima: string; rotulo: string }) {
  const [estado, acao, enviando] = useActionState<EstadoReposicao | undefined, FormData>(registrarReposicao, undefined);
  const p = (s: string) => `${s}-${ausenciaId}`;
  return (
    <form action={acao} className="space-y-3" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="ausenciaId" value={ausenciaId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id={p('data')} name="data" type="date" min={dataMinima} max={dataMaxima} rotulo="Data em que a aula foi reposta" erros={estado?.erros?.data} />
        <Campo
          id={p('formulario')}
          name="formulario"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          rotulo="Formulário de reposição (opcional)"
          dica="PDF, JPG ou PNG, até 5 MB. Se preferir, envie pelo e-mail institucional."
          erros={estado?.erros?.formulario}
        />
      </div>
      <AreaTexto id={p('observacao')} name="observacao" rotulo="Observação (opcional)" rows={2} maxLength={300} erros={estado?.erros?.observacao} />
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : rotulo}</BotaoPrimario>
      </div>
    </form>
  );
}

/** Anexa o formulário a uma reposição já registrada. */
export function FormularioAnexo({ ausenciaId }: { ausenciaId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoReposicao | undefined, FormData>(anexarFormulario, undefined);
  const id = `anexo-${ausenciaId}`;
  return (
    <form action={acao} className="space-y-2" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="ausenciaId" value={ausenciaId} />
      <Campo id={id} name="formulario" type="file" accept="application/pdf,image/jpeg,image/png" rotulo="Anexar o formulário" erros={estado?.erros?.formulario} dica="PDF, JPG ou PNG, até 5 MB." />
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-70"
      >
        {enviando ? 'Enviando…' : 'Anexar'}
      </button>
    </form>
  );
}
