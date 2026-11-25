'use client';

import { useActionState } from 'react';
import { Alerta, AreaTexto, BotaoPrimario, Campo, Selecao } from '@/components/campo';
import { SeletorModo } from '@/components/seletor-modo';
import { enviarAutomatico, registrarEnvio, salvarCanal, type EstadoCanal, type EstadoEnvio } from './actions';

const botaoSecundario =
  'inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70';

/**
 * Registro do envio de uma mensagem da ausência (modo semiautomático, G07). Com a Evolution API
 * configurada e destino no canal, oferece também o envio automático.
 */
export function FormularioEnvio({ ausenciaId, chave, automatico, mostrarWhatsapp }: { ausenciaId: string; chave: string; automatico: boolean; mostrarWhatsapp: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoEnvio | undefined, FormData>(registrarEnvio, undefined);
  const [estadoAuto, acaoAuto, enviandoAuto] = useActionState<EstadoEnvio | undefined, FormData>(enviarAutomatico, undefined);
  const resultado = estadoAuto ?? estado;
  const id = `modo-${chave.replace(/[^a-zA-Z0-9]/g, '-')}`;
  return (
    <div className="space-y-2 border-t border-slate-200 pt-3">
      <form action={acao} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="ausenciaId" value={ausenciaId} />
        <input type="hidden" name="chave" value={chave} />
        <SeletorModo id={id} mostrarWhatsapp={mostrarWhatsapp} />
        <button type="submit" disabled={enviando} className={botaoSecundario}>
          {enviando ? 'Registrando…' : 'Já enviei: registrar'}
        </button>
      </form>
      {automatico && mostrarWhatsapp && (
        <form action={acaoAuto}>
          <input type="hidden" name="ausenciaId" value={ausenciaId} />
          <input type="hidden" name="chave" value={chave} />
          <button type="submit" disabled={enviandoAuto} className={botaoSecundario}>
            {enviandoAuto ? 'Enviando…' : 'Enviar automaticamente pelo WhatsApp'}
          </button>
        </form>
      )}
      {resultado?.mensagem && <Alerta tipo={resultado.sucesso ? 'sucesso' : 'erro'}>{resultado.mensagem}</Alerta>}
    </div>
  );
}

export function FormularioCanal(props: { canalId: string; titulo: string; nomeExibicao: string; email: string; saudacao: string; destinoId: string; ativo: boolean; comApi: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoCanal | undefined, FormData>(salvarCanal, undefined);
  const p = (s: string) => `${s}-${props.canalId}`;
  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="canalId" value={props.canalId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id={p('nomeExibicao')} name="nomeExibicao" rotulo="Nome de exibição" defaultValue={props.nomeExibicao} erros={estado?.erros?.nomeExibicao ? [estado.erros.nomeExibicao] : undefined} />
        <Campo
          id={p('email')}
          name="email"
          rotulo="E-mail institucional"
          defaultValue={props.email}
          autoComplete="off"
          inputMode="email"
          placeholder="setor@ifce.edu.br"
          erros={estado?.erros?.email ? [estado.erros.email] : undefined}
          dica="Preenche o &quot;Para&quot; das mensagens. Vários: separe por vírgula."
        />
        <Campo
          id={p('saudacao')}
          name="saudacao"
          rotulo="Como chamar os destinatários"
          defaultValue={props.saudacao}
          placeholder="prezados(as) colegas da CTP"
          erros={estado?.erros?.saudacao ? [estado.erros.saudacao] : undefined}
          dica="Usado em &quot;Olá, …!&quot;. Vazio: a mensagem traz um campo para preencher."
        />
        {props.comApi || props.destinoId ? (
          <Campo
            id={p('destinoId')}
            name="destinoId"
            rotulo="Destino na API do WhatsApp (opcional)"
            defaultValue={props.destinoId}
            autoComplete="off"
            placeholder="120363…@g.us"
            erros={estado?.erros?.destinoId ? [estado.erros.destinoId] : undefined}
            dica="Só para o envio automático."
          />
        ) : (
          <input type="hidden" name="destinoId" value="" />
        )}
      </div>
      <div className="flex items-center gap-3">
        <input id={p('ativo')} name="ativo" type="checkbox" defaultChecked={props.ativo} className="size-5 accent-if-verde-700" />
        <label htmlFor={p('ativo')} className="text-slate-800">
          Canal ativo (inativo: as mensagens dele não aparecem)
        </label>
      </div>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : `Salvar ${props.titulo}`}</BotaoPrimario>
      </div>
    </form>
  );
}
