'use client';

import { useActionState } from 'react';
import { Alerta, BotaoPrimario, Campo } from '@/components/campo';
import { enviarAutomatico, registrarEnvio, salvarCanal, type EstadoCanal, type EstadoEnvio } from './actions';

/**
 * Modo semiautomático (G07): abre o WhatsApp com o texto pronto e confirma o envio.
 * Com a Evolution API configurada e destino no canal, oferece também o envio automático.
 */
export function FormularioEnvio({ ausenciaId, canal, link, automatico }: { ausenciaId: string; canal: string; link: string; automatico: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoEnvio | undefined, FormData>(registrarEnvio, undefined);
  const [estadoAuto, acaoAuto, enviandoAuto] = useActionState<EstadoEnvio | undefined, FormData>(enviarAutomatico, undefined);
  const resultado = estadoAuto ?? estado;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800"
        >
          Abrir no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
        </a>
        <form action={acao}>
          <input type="hidden" name="ausenciaId" value={ausenciaId} />
          <input type="hidden" name="canal" value={canal} />
          <button
            type="submit"
            disabled={enviando}
            className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
          >
            {enviando ? 'Registrando…' : 'Já enviei: registrar'}
          </button>
        </form>
        {automatico && (
          <form action={acaoAuto}>
            <input type="hidden" name="ausenciaId" value={ausenciaId} />
            <input type="hidden" name="canal" value={canal} />
            <input type="hidden" name="automatico" value="1" />
            <button
              type="submit"
              disabled={enviandoAuto}
              className="inline-flex min-h-11 items-center rounded-md border border-if-verde-700 bg-white px-4 font-semibold text-if-verde-700 hover:bg-if-verde-50 disabled:cursor-wait disabled:opacity-70"
            >
              {enviandoAuto ? 'Enviando…' : 'Enviar automaticamente'}
            </button>
          </form>
        )}
      </div>
      {resultado?.mensagem && <Alerta tipo={resultado.sucesso ? 'sucesso' : 'erro'}>{resultado.mensagem}</Alerta>}
    </div>
  );
}

export function FormularioCanal(props: { canalId: string; titulo: string; nomeExibicao: string; destinoId: string; ativo: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoCanal | undefined, FormData>(salvarCanal, undefined);
  const p = (s: string) => `${s}-${props.canalId}`;
  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="canalId" value={props.canalId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id={p('nomeExibicao')} name="nomeExibicao" rotulo="Nome de exibição" defaultValue={props.nomeExibicao} erros={estado?.erros?.nomeExibicao ? [estado.erros.nomeExibicao] : undefined} />
        <Campo
          id={p('destinoId')}
          name="destinoId"
          rotulo="Destino na API (opcional)"
          defaultValue={props.destinoId}
          autoComplete="off"
          placeholder="120363…@g.us"
          erros={estado?.erros?.destinoId ? [estado.erros.destinoId] : undefined}
          dica="Só para o envio automático."
        />
      </div>
      <div className="flex items-center gap-3">
        <input id={p('ativo')} name="ativo" type="checkbox" defaultChecked={props.ativo} className="size-5 accent-if-verde-700" />
        <label htmlFor={p('ativo')} className="text-slate-800">
          Canal ativo
        </label>
      </div>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : `Salvar ${props.titulo}`}</BotaoPrimario>
      </div>
    </form>
  );
}
