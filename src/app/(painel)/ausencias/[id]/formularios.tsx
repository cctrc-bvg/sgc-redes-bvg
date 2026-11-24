'use client';

import { useActionState } from 'react';
import { Alerta, AreaTexto, BotaoPrimario, Selecao } from '@/components/campo';
import { cancelarAusencia, convidarSubstituto, decidirAusencia, type EstadoCancelamento, type EstadoConvite, type EstadoDecisao } from '../actions';

export interface HorarioDecisao {
  /** Nome do campo (`decisao:<blocoId>`) e chave das escolhas. */
  campo: string;
  blocoId: string;
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  atual: string;
}

/** Uma escolha por horário perdido; "Decidir depois" mantém o horário pendente. */
export function FormularioDecisao(props: { ausenciaId: string; horarios: HorarioDecisao[]; justificativa: string; reposicao: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoDecisao | undefined, FormData>(decidirAusencia, undefined);
  const v = estado?.valores;

  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="ausenciaId" value={props.ausenciaId} />
      {props.horarios.map((h) => (
        <Selecao
          key={h.campo}
          id={h.campo}
          rotulo={h.rotulo}
          opcoes={h.opcoes}
          defaultValue={v?.[h.blocoId] ?? h.atual}
          erros={estado?.erros?.[h.blocoId] ? [estado.erros[h.blocoId]] : undefined}
        />
      ))}
      <AreaTexto
        id="justificativa"
        rotulo="Justificativa (obrigatória em emergência)"
        rows={3}
        maxLength={300}
        defaultValue={v?.justificativa ?? props.justificativa}
        erros={estado?.erros?.justificativa ? [estado.erros.justificativa] : undefined}
        dica="RF04: se a dispensa gerar aviso com menos de 4h, registre por que a turma não pôde ficar no campus. Sem dados pessoais."
      />
      <div className="flex items-start gap-3">
        <input
          id="reposicao"
          name="reposicao"
          type="checkbox"
          defaultChecked={v ? v.reposicao === 'on' : props.reposicao}
          className="mt-1 size-5 accent-if-verde-700"
        />
        <label htmlFor="reposicao" className="text-slate-800">
          Reposição das aulas dispensadas já agendada
        </label>
      </div>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : 'Salvar decisão'}</BotaoPrimario>
      </div>
    </form>
  );
}

export function FormularioCancelamento({ ausenciaId }: { ausenciaId: string }) {
  const [estado, acao, enviando] = useActionState<EstadoCancelamento | undefined, FormData>(cancelarAusencia, undefined);
  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <input type="hidden" name="ausenciaId" value={ausenciaId} />
      <div className="flex items-start gap-3">
        <input id="confirmo" name="confirmo" type="checkbox" className="mt-1 size-5 accent-if-vermelho-700" />
        <label htmlFor="confirmo" className="text-slate-800">
          Confirmo que o docente não vai faltar (ou o registro foi feito por engano). Os avisos de refeição ligados a ele serão cancelados.
        </label>
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md border border-if-vermelho-700 bg-white px-4 font-semibold text-if-vermelho-700 hover:bg-if-vermelho-50 disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? 'Cancelando…' : 'Cancelar registro'}
      </button>
    </form>
  );
}

export function FormularioConvite({ ausenciaId, blocoId, rotulo, opcoes }: { ausenciaId: string; blocoId: string; rotulo: string; opcoes: { valor: string; rotulo: string }[] }) {
  const [estado, acao, enviando] = useActionState<EstadoConvite | undefined, FormData>(convidarSubstituto, undefined);
  const id = `convite-${blocoId}`;
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3" noValidate>
      <input type="hidden" name="ausenciaId" value={ausenciaId} />
      <input type="hidden" name="blocoId" value={blocoId} />
      <Selecao id={id} name="professorId" rotulo={`Convidar para ${rotulo}`} opcoes={[{ valor: '', rotulo: 'Selecione…' }, ...opcoes]} defaultValue="" />
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-70"
      >
        {enviando ? 'Convidando…' : 'Convidar'}
      </button>
      {estado?.mensagem && (
        <div className="w-full">
          <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>
        </div>
      )}
    </form>
  );
}
