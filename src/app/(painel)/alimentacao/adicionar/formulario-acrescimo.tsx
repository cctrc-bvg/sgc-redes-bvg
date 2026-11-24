'use client';

import { useActionState } from 'react';
import { Alerta, BotaoPrimario, Campo, Selecao } from '@/components/campo';
import { criarAcrescimo, type EstadoAcrescimo } from '../actions';

const REFEICOES = [
  { valor: 'LANCHE_MANHA', rotulo: 'Lanche da manhã (09:30)' },
  { valor: 'ALMOCO', rotulo: 'Almoço (12:00)' },
  { valor: 'LANCHE_TARDE', rotulo: 'Lanche da tarde (15:00)' },
];

export function FormularioAcrescimo({ turmas, hoje }: { turmas: { id: string; nome: string }[]; hoje: string }) {
  const [estado, acao, enviando] = useActionState<EstadoAcrescimo | undefined, FormData>(criarAcrescimo, undefined);
  const v = estado?.valores;
  const erroRefeicoes = estado?.erros?.refeicoes;
  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Selecao
          id="turmaId"
          rotulo="Turma"
          opcoes={[{ valor: '', rotulo: 'Selecione…' }, ...turmas.map((t) => ({ valor: t.id, rotulo: t.nome }))]}
          defaultValue={v?.turmaId ?? ''}
          erros={estado?.erros?.turmaId}
        />
        <Campo id="data" rotulo="Data do encontro" type="date" min={hoje} defaultValue={v?.data ?? ''} erros={estado?.erros?.data} />
      </div>
      <fieldset aria-describedby={erroRefeicoes ? 'refeicoes-erro' : undefined}>
        <legend className="text-sm font-semibold text-slate-800">Refeições a acrescentar</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {REFEICOES.map((r) => (
            <div key={r.valor} className="flex items-center gap-2">
              <input
                id={`ref-${r.valor}`}
                name="refeicoes"
                type="checkbox"
                value={r.valor}
                defaultChecked={v?.refeicoes.includes(r.valor) ?? false}
                className="size-5 accent-if-verde-700"
              />
              <label htmlFor={`ref-${r.valor}`} className="text-slate-800">
                {r.rotulo}
              </label>
            </div>
          ))}
        </div>
        {erroRefeicoes && (
          <p id="refeicoes-erro" className="mt-1 text-sm text-if-vermelho-700">
            {erroRefeicoes.join(' ')}
          </p>
        )}
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
        <Campo id="quantidade" rotulo="Estudantes" inputMode="numeric" maxLength={2} defaultValue={v?.quantidade ?? ''} erros={estado?.erros?.quantidade} />
        <Campo
          id="descricao"
          rotulo="Atividade"
          maxLength={120}
          defaultValue={v?.descricao ?? ''}
          erros={estado?.erros?.descricao}
          dica="Ex.: Encontro de PEI de Matemática. Não escreva nomes de estudantes (a AE vê este texto)."
        />
      </div>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Enviando…' : 'Avisar a Assistência Estudantil'}</BotaoPrimario>
      </div>
    </form>
  );
}
