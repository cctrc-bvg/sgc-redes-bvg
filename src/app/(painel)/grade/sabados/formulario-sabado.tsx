'use client';

import { useActionState, useState } from 'react';
import { Alerta, BotaoPrimario, Campo, Selecao } from '@/components/campo';
import { cadastrarSabado, type EstadoSabado } from '../actions';

const OPCOES_DIA = [
  { valor: '', rotulo: 'Selecione…' },
  { valor: '1', rotulo: 'Segunda-feira' },
  { valor: '2', rotulo: 'Terça-feira' },
  { valor: '3', rotulo: 'Quarta-feira' },
  { valor: '4', rotulo: 'Quinta-feira' },
  { valor: '5', rotulo: 'Sexta-feira' },
];

export function FormularioSabado() {
  const [estado, acao, enviando] = useActionState<EstadoSabado | undefined, FormData>(cadastrarSabado, undefined);
  const v = estado?.sucesso ? undefined : estado?.valores;
  const [escolhida, setEscolhida] = useState(v?.data ?? '');
  // Aviso na hora: só fim de semana vale (domingo, em situação extraordinária) (o servidor confere de novo).
  const naoESabado = /^\d{4}-\d{2}-\d{2}$/.test(escolhida) && ![0, 6].includes(new Date(`${escolhida}T12:00:00Z`).getUTCDay());
  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          id="data"
          rotulo="Data do sábado"
          type="date"
          required
          defaultValue={v?.data ?? ''}
          onChange={(e) => setEscolhida(e.target.value)}
          erros={naoESabado ? ['Essa data não cai num sábado ou domingo: escolha um fim de semana.'] : estado?.erros?.data}
        />
        <Selecao
          id="diaSemanaReferente"
          rotulo="Segue a grade de"
          opcoes={OPCOES_DIA}
          defaultValue={v?.diaSemanaReferente ?? ''}
          erros={estado?.erros?.diaSemanaReferente}
        />
      </div>
      <Campo
        id="observacao"
        rotulo="Observação (opcional)"
        maxLength={200}
        defaultValue={v?.observacao ?? ''}
        erros={estado?.erros?.observacao}
        dica="Ex.: reposição do feriado de 20/11, conforme calendário acadêmico."
      />
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando || naoESabado}>{enviando ? 'Salvando…' : 'Cadastrar sábado letivo'}</BotaoPrimario>
      </div>
    </form>
  );
}
