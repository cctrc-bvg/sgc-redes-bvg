'use client';

import { useActionState } from 'react';
import { Alerta, AreaTexto, BotaoPrimario, Campo, Selecao } from '@/components/campo';
import { atualizarProcesso, criarProcesso, excluirProcesso, moverProcesso, type EstadoMovimento, type EstadoProcesso } from './actions';

export type ValoresProcesso = { titulo: string; tipo: string; coluna: string; numeroSei: string; prazo: string; descricao: string; sigiloso: boolean };

export function FormularioProcesso(props: {
  processoId?: string;
  iniciais?: ValoresProcesso;
  tipos: { valor: string; rotulo: string }[];
  colunas: { valor: string; rotulo: string }[];
  podeSigilo: boolean;
}) {
  const [estado, acao, enviando] = useActionState<EstadoProcesso | undefined, FormData>(props.processoId ? atualizarProcesso : criarProcesso, undefined);
  const v = estado?.valores;
  const texto = (c: Exclude<keyof ValoresProcesso, 'sigiloso'>) => v?.[c] ?? props.iniciais?.[c] ?? '';
  const sigiloso = v ? v.sigiloso === 'on' : (props.iniciais?.sigiloso ?? false);
  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      {props.processoId && <input type="hidden" name="processoId" value={props.processoId} />}
      <Campo
        id="titulo"
        rotulo="Título"
        maxLength={120}
        autoComplete="off"
        defaultValue={texto('titulo')}
        erros={estado?.erros?.titulo}
        dica="Prefira a matrícula ao nome do estudante."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Selecao id="tipo" rotulo="Etiqueta" opcoes={[{ valor: '', rotulo: 'Selecione…' }, ...props.tipos]} defaultValue={texto('tipo')} erros={estado?.erros?.tipo} />
        <Selecao id="coluna" rotulo="Etapa" opcoes={props.colunas} defaultValue={texto('coluna') || 'NOVO'} erros={estado?.erros?.coluna} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="numeroSei" rotulo="Número SEI (opcional)" autoComplete="off" placeholder="23255.000123/2026-45" defaultValue={texto('numeroSei')} erros={estado?.erros?.numeroSei} />
        <Campo id="prazo" rotulo="Prazo (opcional)" type="date" defaultValue={texto('prazo')} erros={estado?.erros?.prazo} />
      </div>
      <AreaTexto id="descricao" rotulo="Anotações (opcional)" rows={5} maxLength={2000} defaultValue={texto('descricao')} erros={estado?.erros?.descricao} />
      {props.podeSigilo && (
        <div className="flex items-start gap-3">
          <input id="sigiloso" name="sigiloso" type="checkbox" defaultChecked={sigiloso} aria-describedby="sigiloso-dica" className="mt-1 size-5 accent-if-verde-700" />
          <div>
            <label htmlFor="sigiloso" className="font-semibold text-slate-800">
              Sigiloso
            </label>
            <p id="sigiloso-dica" className="text-sm text-slate-600">
              Visível só para a Coordenação (Art. 22, VIII). Use em orientações e mediações com dados pessoais.
            </p>
            {estado?.erros?.sigiloso && <p className="text-sm text-if-vermelho-700">{estado.erros.sigiloso.join(' ')}</p>}
          </div>
        </div>
      )}
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : props.processoId ? 'Salvar alterações' : 'Cadastrar'}</BotaoPrimario>
      </div>
    </form>
  );
}

/** Botão de mover entre etapas; o rótulo inclui o título para leitores de tela. */
export function BotaoMover({ processoId, coluna, rotulo, rotuloAcessivel }: { processoId: string; coluna: string; rotulo: string; rotuloAcessivel: string }) {
  const [estado, acao, enviando] = useActionState<EstadoMovimento | undefined, FormData>(moverProcesso, undefined);
  return (
    <form action={acao}>
      <input type="hidden" name="processoId" value={processoId} />
      <input type="hidden" name="coluna" value={coluna} />
      <button
        type="submit"
        disabled={enviando}
        aria-label={rotuloAcessivel}
        className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
      >
        {rotulo}
      </button>
      {estado?.mensagem && <span className="block text-sm text-if-vermelho-700">{estado.mensagem}</span>}
    </form>
  );
}

export function FormularioExclusaoProcesso({ processoId }: { processoId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoMovimento | undefined, FormData>(excluirProcesso, undefined);
  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <input type="hidden" name="processoId" value={processoId} />
      <div className="flex items-start gap-3">
        <input id="confirmo" name="confirmo" type="checkbox" className="mt-1 size-5 accent-if-vermelho-700" />
        <label htmlFor="confirmo" className="text-slate-800">
          Confirmo que este item foi cadastrado por engano. Para encerrar um processo, use a etapa &quot;Concluído&quot;.
        </label>
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md border border-if-vermelho-700 bg-white px-4 font-semibold text-if-vermelho-700 hover:bg-if-vermelho-50 disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? 'Excluindo…' : 'Excluir'}
      </button>
    </form>
  );
}
