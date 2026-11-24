'use client';

import { useActionState } from 'react';
import { Alerta, AreaTexto, BotaoPrimario, BotaoSecundario, Campo } from '@/components/campo';
import { atualizarDiario, registrarLembrete, salvarPeriodo, type EstadoDiario, type EstadoLembrete, type EstadoPeriodo } from './actions';

export function FormularioDiario(props: { ofertaId: string; ministradas: number; emDia: boolean; observacao: string; previstas: number }) {
  const [estado, acao, enviando] = useActionState<EstadoDiario | undefined, FormData>(atualizarDiario, undefined);
  const v = estado?.valores;
  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="ofertaId" value={props.ofertaId} />
      <Campo
        id="aulasMinistradas"
        rotulo={`Aulas ministradas (de ${props.previstas} previstas)`}
        inputMode="numeric"
        maxLength={3}
        className="sm:max-w-xs"
        defaultValue={v?.aulasMinistradas ?? String(props.ministradas)}
        erros={estado?.erros?.aulasMinistradas}
        dica="Conforme o diário no sistema acadêmico."
      />
      <div className="flex items-start gap-3">
        <input id="diarioEmDia" name="diarioEmDia" type="checkbox" defaultChecked={v ? v.diarioEmDia === 'on' : props.emDia} className="mt-1 size-5 accent-if-verde-700" />
        <label htmlFor="diarioEmDia" className="font-semibold text-slate-800">
          Diário em dia (frequências e conteúdos lançados)
        </label>
      </div>
      <AreaTexto
        id="observacaoDiario"
        rotulo="Observação (opcional)"
        rows={3}
        maxLength={300}
        defaultValue={v?.observacaoDiario ?? props.observacao}
        erros={estado?.erros?.observacaoDiario}
      />
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</BotaoPrimario>
      </div>
    </form>
  );
}

export function FormularioLembrete({ ofertaId, link }: { ofertaId: string; link: string | null }) {
  const [estado, acao, enviando] = useActionState<EstadoLembrete | undefined, FormData>(registrarLembrete, undefined);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
            Abrir conversa no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : (
          <p className="text-sm text-slate-700">O docente não tem WhatsApp cadastrado. Copie o texto e envie por outro meio.</p>
        )}
        <form action={acao}>
          <input type="hidden" name="ofertaId" value={ofertaId} />
          <BotaoSecundario type="submit" disabled={enviando}>
            {enviando ? 'Registrando…' : 'Já enviei: registrar lembrete'}
          </BotaoSecundario>
        </form>
      </div>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
    </div>
  );
}

export function FormularioPeriodo(props: { anoLetivo: number; semestreLetivo: number; inicio: string; fim: string }) {
  const [estado, acao, enviando] = useActionState<EstadoPeriodo | undefined, FormData>(salvarPeriodo, undefined);
  return (
    <form action={acao} className="flex flex-wrap items-end gap-4" noValidate>
      <input type="hidden" name="anoLetivo" value={props.anoLetivo} />
      <input type="hidden" name="semestreLetivo" value={props.semestreLetivo} />
      <Campo id="inicio" rotulo="Início do semestre" type="date" defaultValue={props.inicio} erros={estado?.erros?.inicio ? [estado.erros.inicio] : undefined} />
      <Campo id="fim" rotulo="Fim do semestre" type="date" defaultValue={props.fim} erros={estado?.erros?.fim ? [estado.erros.fim] : undefined} />
      <BotaoSecundario type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Salvar período'}
      </BotaoSecundario>
      {estado?.mensagem && (
        <div className="w-full">
          <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>
        </div>
      )}
    </form>
  );
}
