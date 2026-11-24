'use client';

import { useActionState, useState } from 'react';
import type { TipoEventoCalendario } from '@prisma/client';
import { Alerta, BotaoPrimario } from '@/components/campo';
import { MOTIVOS_SUSPENSAO, NOME_TIPO_EVENTO, SUSPENDE_POR_PADRAO, TIPOS_EVENTO, nomeEtapa } from '@/lib/calendario/regras';
import { atualizarEvento, criarEvento, removerEvento, salvarEtapas, type EstadoEtapas, type EstadoEvento, type EstadoSimples } from './actions';

const entrada = 'mt-1 block w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900';
const Erro = ({ texto }: { texto?: string }) => (texto ? <p className="mt-1 text-sm text-if-vermelho-700">{texto}</p> : null);

export interface DadosEvento {
  id?: string;
  tipo: string;
  inicio: string;
  fim: string;
  descricao: string;
  suspendeAulas: boolean;
  imprevisto: boolean;
  motivo: string;
}

/** Evento do calendário. Trocar o tipo sugere se o dia fica sem aula (pode ser mudado). */
export function FormularioEvento({ inicial }: { inicial: DadosEvento }) {
  const editar = Boolean(inicial.id);
  const [estado, acao, enviando] = useActionState<EstadoEvento | undefined, FormData>(editar ? atualizarEvento : criarEvento, undefined);
  const v = estado?.valores;
  const [tipo, setTipo] = useState(v?.tipo ?? inicial.tipo);
  const [suspende, setSuspende] = useState(v ? v.suspendeAulas === 'on' : inicial.suspendeAulas);
  const [imprevisto, setImprevisto] = useState(v ? v.imprevisto === 'on' : inicial.imprevisto);

  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      {inicial.id && <input type="hidden" name="eventoId" value={inicial.id} />}
      <div>
        <label htmlFor="tipo" className="block text-sm font-semibold text-slate-800">
          Tipo
        </label>
        <select
          id="tipo"
          name="tipo"
          value={tipo}
          onChange={(e) => {
            const t = e.target.value as TipoEventoCalendario;
            setTipo(t);
            setSuspende(SUSPENDE_POR_PADRAO[t]);
            if (t === 'SUSPENSAO_AULAS') setImprevisto(true);
          }}
          className={entrada}
        >
          {TIPOS_EVENTO.map((t) => (
            <option key={t} value={t}>
              {NOME_TIPO_EVENTO[t]}
            </option>
          ))}
        </select>
        <Erro texto={estado?.erros?.tipo} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="inicio" className="block text-sm font-semibold text-slate-800">
            Início
          </label>
          <input id="inicio" name="inicio" type="date" defaultValue={v?.inicio ?? inicial.inicio} className={entrada} />
          <Erro texto={estado?.erros?.inicio} />
        </div>
        <div>
          <label htmlFor="fim" className="block text-sm font-semibold text-slate-800">
            Término <span className="font-normal text-slate-600">(vazio: um dia só)</span>
          </label>
          <input id="fim" name="fim" type="date" defaultValue={v?.fim ?? inicial.fim} className={entrada} />
          <Erro texto={estado?.erros?.fim} />
        </div>
      </div>
      <div>
        <label htmlFor="descricao" className="block text-sm font-semibold text-slate-800">
          Descrição <span className="font-normal text-slate-600">(ex.: Tiradentes, Reunião de pais da REDES-1)</span>
        </label>
        <input id="descricao" name="descricao" defaultValue={v?.descricao ?? inicial.descricao} maxLength={120} className={entrada} />
        <Erro texto={estado?.erros?.descricao} />
      </div>
      {tipo === 'SUSPENSAO_AULAS' && (
        <div>
          <label htmlFor="motivo" className="block text-sm font-semibold text-slate-800">
            Motivo
          </label>
          <select id="motivo" name="motivo" defaultValue={v?.motivo ?? inicial.motivo} className={entrada}>
            <option value="">Selecione…</option>
            {MOTIVOS_SUSPENSAO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Erro texto={estado?.erros?.motivo} />
        </div>
      )}
      <div className="space-y-3">
        <label className="flex items-start gap-3 text-slate-800">
          <input name="suspendeAulas" type="checkbox" checked={suspende} onChange={(e) => setSuspende(e.target.checked)} className="mt-1 size-5 accent-if-verde-700" />
          <span>
            Sem aula nestes dias
            <span className="block text-sm text-slate-600">Tira os dias da contagem de dias letivos e da grade (ausências e refeições).</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-slate-800">
          <input name="imprevisto" type="checkbox" checked={imprevisto} onChange={(e) => setImprevisto(e.target.checked)} className="mt-1 size-5 accent-if-verde-700" />
          <span>
            Alteração não prevista no calendário aprovado
            <span className="block text-sm text-slate-600">Ex.: ponto facultativo decretado pela prefeitura, falta de energia. Os dias entram como &quot;a repor&quot;.</span>
          </span>
        </label>
      </div>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : editar ? 'Salvar evento' : 'Cadastrar evento'}</BotaoPrimario>
      </div>
    </form>
  );
}

export function FormularioRemocaoEvento({ id }: { id: string }) {
  const [estado, acao, enviando] = useActionState<EstadoSimples | undefined, FormData>(removerEvento, undefined);
  return (
    <form action={acao} className="space-y-3" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <input type="hidden" name="eventoId" value={id} />
      <label className="flex items-start gap-3 text-slate-800">
        <input name="confirmo" type="checkbox" className="mt-1 size-5 accent-if-vermelho-700" />
        Confirmo a remoção deste evento.
      </label>
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md border border-if-vermelho-700 bg-white px-4 font-semibold text-if-vermelho-700 hover:bg-if-vermelho-50 disabled:opacity-70"
      >
        {enviando ? 'Removendo…' : 'Remover evento'}
      </button>
    </form>
  );
}

/** Etapas N1–N4 e semestres de um ano (linha vazia apaga o período). */
export function FormularioEtapas({ ano, inicial }: { ano: number; inicial: Record<string, string> }) {
  const [estado, acao, enviando] = useActionState<EstadoEtapas | undefined, FormData>(salvarEtapas, undefined);
  const v = estado?.valores ?? inicial;
  const linha = (prefixo: string, rotulo: string) => (
    <fieldset key={prefixo} className="grid gap-3 sm:grid-cols-[8rem_1fr_1fr] sm:items-end">
      <legend className="sr-only">{rotulo}</legend>
      <p className="font-semibold text-slate-900" aria-hidden="true">
        {rotulo}
      </p>
      <div>
        <label htmlFor={`${prefixo}:inicio`} className="block text-sm text-slate-800">
          Início <span className="sr-only">de {rotulo}</span>
        </label>
        <input id={`${prefixo}:inicio`} name={`${prefixo}:inicio`} type="date" defaultValue={v[`${prefixo}:inicio`] ?? ''} className={entrada} />
      </div>
      <div>
        <label htmlFor={`${prefixo}:fim`} className="block text-sm text-slate-800">
          Término <span className="sr-only">de {rotulo}</span>
        </label>
        <input id={`${prefixo}:fim`} name={`${prefixo}:fim`} type="date" defaultValue={v[`${prefixo}:fim`] ?? ''} className={entrada} />
      </div>
      {estado?.erros?.[prefixo] && <p className="text-sm text-if-vermelho-700 sm:col-span-3">{estado.erros[prefixo]}</p>}
    </fieldset>
  );
  return (
    <form action={acao} className="space-y-6" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      {estado?.erros && <Alerta tipo="erro">Corrija os períodos marcados.</Alerta>}
      <input type="hidden" name="anoLetivo" value={ano} />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Etapas</h2>
        {[1, 2, 3, 4].map((n) => linha(`etapa${n}`, `Etapa ${nomeEtapa(n)}`))}
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Semestres</h2>
        <p className="text-sm text-slate-700">Usados também pelos diários (aulas esperadas até hoje).</p>
        {[1, 2].map((n) => linha(`semestre${n}`, `${n}º semestre`))}
      </section>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : 'Salvar etapas e semestres'}</BotaoPrimario>
      </div>
    </form>
  );
}
