'use client';

import { useActionState } from 'react';
import { Alerta, BotaoPrimario, Selecao } from '@/components/campo';
import { PREFIXO_CAMPO } from '@/lib/ofertas/regras';
import { salvarDistribuicao, type EstadoDistribuicao } from '../actions';

export interface LinhaDistribuicao {
  disciplinaId: string;
  nome: string;
  detalhe: string; // ex.: "C.D · 80h"
  professorId: string; // "" = sem professor
  /** Professor atual desativado: entra como opção só nesta linha, para não ser trocado sem querer. */
  professorInativo?: { id: string; nome: string };
  bloqueioRemocao: boolean;
}

export interface GrupoDistribuicao {
  titulo: string;
  linhas: LinhaDistribuicao[];
}

export function FormularioDistribuicao(props: {
  turmaId: string;
  anoLetivo: number;
  grupos: GrupoDistribuicao[];
  professores: { id: string; nome: string }[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoDistribuicao | undefined, FormData>(salvarDistribuicao, undefined);
  const opcoesBase = [{ valor: '', rotulo: '— Sem professor definido —' }, ...props.professores.map((p) => ({ valor: p.id, rotulo: p.nome }))];

  return (
    <form action={acao} className="space-y-6" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="turmaId" value={props.turmaId} />
      <input type="hidden" name="anoLetivo" value={props.anoLetivo} />

      {props.grupos.map((g) => (
        <fieldset key={g.titulo} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <legend className="px-1 text-lg font-semibold text-slate-900">{g.titulo}</legend>
          <div className="mt-2 grid gap-5 sm:grid-cols-2">
            {g.linhas.map((l) => {
              const opcoes = l.professorInativo
                ? [...opcoesBase, { valor: l.professorInativo.id, rotulo: `${l.professorInativo.nome} (desativado)` }]
                : opcoesBase;
              return (
                <Selecao
                  key={l.disciplinaId}
                  id={PREFIXO_CAMPO + l.disciplinaId}
                  rotulo={l.nome}
                  dica={l.bloqueioRemocao ? `${l.detalhe} · já usada na grade` : l.detalhe}
                  opcoes={opcoes}
                  defaultValue={estado?.valores?.[l.disciplinaId] ?? l.professorId}
                  erros={estado?.erros?.[l.disciplinaId] ? [estado.erros[l.disciplinaId]] : undefined}
                />
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : 'Salvar distribuição'}</BotaoPrimario>
      </div>
    </form>
  );
}
