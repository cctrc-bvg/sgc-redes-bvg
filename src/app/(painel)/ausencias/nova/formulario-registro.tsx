'use client';

import { useActionState } from 'react';
import { Alerta, BotaoPrimario, Selecao } from '@/components/campo';
import type { DiaOpcao } from '@/lib/ausencias/opcoes';
import { informarAusencia, registrarAusencia, type EstadoRegistro } from '../actions';

export type { AulaOpcao, DiaOpcao } from '@/lib/ausencias/opcoes';

/** Segunda etapa: aulas afetadas (todas marcadas por padrão) e motivo operacional; no período, agrupadas por dia. */
export function FormularioRegistro(props: {
  professorId: string;
  data: string;
  ate?: string;
  dias: DiaOpcao[];
  motivos: readonly string[];
  /** "informar": o próprio docente informa (RF02-A); "registrar": a Coordenação registra. */
  modo?: 'registrar' | 'informar';
}) {
  const informar = props.modo === 'informar';
  const [estado, acao, enviando] = useActionState<EstadoRegistro | undefined, FormData>(informar ? informarAusencia : registrarAusencia, undefined);
  const marcadas = estado?.valores ? new Set(estado.valores.aulas) : null;
  const erroAulas = estado?.erros?.aulas;

  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      {(estado?.erros?.data || estado?.erros?.professorId) && (
        <Alerta tipo="erro">{[...(estado.erros.data ?? []), ...(estado.erros.professorId ?? [])].join(' ')}</Alerta>
      )}
      <input type="hidden" name="professorId" value={props.professorId} />
      <input type="hidden" name="data" value={props.data} />
      {props.ate && <input type="hidden" name="ate" value={props.ate} />}

      <fieldset aria-describedby={erroAulas ? 'aulas-erro' : undefined}>
        <legend className="font-semibold text-slate-900">Aulas afetadas</legend>
        <p className="text-sm text-slate-600">Cada turma e disciplina vira um registro, com a decisão de cobertura por horário.</p>
        {props.dias.map((dia) => (
          <div key={dia.dataISO} className={dia.titulo ? 'mt-4' : ''}>
            {dia.titulo && <p className="font-semibold text-slate-800">{dia.titulo}</p>}
            <ul className="mt-3 space-y-2">
              {dia.aulas.map((a) => (
                <li key={a.chave} className="flex items-start gap-3">
                  <input
                    id={`aula-${a.chave}`}
                    name="aula"
                    type="checkbox"
                    value={a.chave}
                    disabled={a.jaRegistrada}
                    defaultChecked={!a.jaRegistrada && (marcadas ? marcadas.has(a.chave) : true)}
                    className="mt-1 size-5 accent-if-verde-700"
                  />
                  <label htmlFor={`aula-${a.chave}`} className="text-slate-800">
                    <span className="font-semibold">{a.rotulo}</span> — {a.detalhe}
                    {a.jaRegistrada && <span className="block text-sm text-slate-600">Ausência já registrada nesta aula.</span>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {erroAulas && (
          <p id="aulas-erro" className="mt-1 text-sm text-if-vermelho-700">
            {erroAulas.join(' ')}
          </p>
        )}
      </fieldset>

      <Selecao
        id="motivoOperacional"
        rotulo="Motivo operacional"
        opcoes={[{ valor: '', rotulo: 'Selecione…' }, ...props.motivos.map((m) => ({ valor: m, rotulo: m }))]}
        defaultValue={estado?.valores?.motivoOperacional ?? ''}
        erros={estado?.erros?.motivoOperacional}
        dica="Aparece nas mensagens de WhatsApp. Nunca registre motivo médico ou pessoal (LGPD)."
      />

      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>
          {enviando ? (informar ? 'Enviando…' : 'Registrando…') : informar ? 'Informar ausência à Coordenação' : 'Registrar ausência'}
        </BotaoPrimario>
      </div>
    </form>
  );
}
