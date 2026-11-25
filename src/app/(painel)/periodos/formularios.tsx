'use client';

import { useActionState } from 'react';
import { Alerta, AreaTexto, BotaoPrimario, Campo, Selecao } from '@/components/campo';
import { SeletorModo } from '@/components/seletor-modo';
import { NOME_TIPO_PERIODO, TIPOS_PERIODO } from '@/lib/periodos/regras';
import { criarPeriodo, registrarResumoAlimentar, salvarGradeEspecial, salvarPresencas, type EstadoEnvioPeriodo, type EstadoGrade, type EstadoPeriodo } from './actions';

export function FormularioPeriodo() {
  const [estado, acao, enviando] = useActionState<EstadoPeriodo | undefined, FormData>(criarPeriodo, undefined);
  const v = estado?.valores;
  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="nome" rotulo="Nome do período" defaultValue={v?.nome} placeholder="Ex.: Jogos internos 2027" erros={estado?.erros?.nome} />
        <Selecao
          id="tipo"
          rotulo="Tipo"
          defaultValue={v?.tipo ?? 'JOGOS_INTERNOS'}
          opcoes={TIPOS_PERIODO.map((t) => ({ valor: t, rotulo: NOME_TIPO_PERIODO[t] }))}
          erros={estado?.erros?.tipo}
        />
        <Campo id="inicio" type="date" rotulo="Início" defaultValue={v?.inicio} erros={estado?.erros?.inicio} />
        <Campo id="fim" type="date" rotulo="Fim" defaultValue={v?.fim} erros={estado?.erros?.fim} dica="No máximo 15 dias." />
      </div>
      <AreaTexto id="observacao" rotulo="Observação (opcional)" rows={2} maxLength={300} defaultValue={v?.observacao} erros={estado?.erros?.observacao} />
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Criando…' : 'Criar período'}</BotaoPrimario>
      </div>
    </form>
  );
}

export interface OpcaoOferta {
  id: string;
  rotulo: string;
}

export function FormularioGradeEspecial(props: {
  periodoId: string;
  turmaId: string;
  blocos: { id: string; rotulo: string; turno: string }[];
  ofertas: OpcaoOferta[];
  valores: Record<string, string>;
  dias: { numero: number; nome: string }[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoGrade | undefined, FormData>(salvarGradeEspecial, undefined);
  return (
    <form action={acao} className="space-y-3">
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="periodoId" value={props.periodoId} />
      <input type="hidden" name="turmaId" value={props.turmaId} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Grade especial da turma: disciplina em cada horário</caption>
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th scope="col" className="px-2 py-2 font-semibold">Horário</th>
              {props.dias.map((d) => (
                <th key={d.numero} scope="col" className="px-2 py-2 font-semibold">{d.nome}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.blocos.map((b) => (
              <tr key={b.id}>
                <th scope="row" className="px-2 py-2 font-normal text-slate-700">{b.rotulo}</th>
                {props.dias.map((d) => {
                  const nome = `celula:${d.numero}:${b.id}`;
                  return (
                    <td key={d.numero} className="px-1 py-1">
                      <label className="sr-only" htmlFor={`${props.turmaId}-${nome}`}>{`${d.nome}, ${b.rotulo}`}</label>
                      <select id={`${props.turmaId}-${nome}`} name={nome} defaultValue={props.valores[nome] ?? ''} className="w-full rounded border border-slate-400 bg-white px-1 py-1.5 text-sm">
                        <option value="">— livre —</option>
                        {props.ofertas.map((o) => (
                          <option key={o.id} value={o.id}>{o.rotulo}</option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : 'Salvar grade especial'}</BotaoPrimario>
      </div>
    </form>
  );
}

export function FormularioPresencas(props: { periodoId: string; turmas: { id: string; codigo: string; ativos: number }[]; dias: string[]; valores: Record<string, number> }) {
  const [estado, acao, enviando] = useActionState<EstadoGrade | undefined, FormData>(salvarPresencas, undefined);
  return (
    <form action={acao} className="space-y-3">
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      <input type="hidden" name="periodoId" value={props.periodoId} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="sr-only">Estudantes presentes por turma e dia</caption>
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th scope="col" className="px-2 py-2 font-semibold">Dia</th>
              {props.turmas.map((t) => (
                <th key={t.id} scope="col" className="px-2 py-2 font-semibold">{t.codigo} <span className="font-normal text-slate-600">({t.ativos})</span></th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.dias.map((d) => (
              <tr key={d}>
                <th scope="row" className="px-2 py-2 font-normal">{d.split('-').reverse().join('/')}</th>
                {props.turmas.map((t) => {
                  const nome = `presenca:${t.id}:${d}`;
                  const atual = props.valores[nome];
                  return (
                    <td key={t.id} className="px-1 py-1">
                      <label className="sr-only" htmlFor={nome}>{`Presentes, ${t.codigo}, ${d.split('-').reverse().join('/')}`}</label>
                      <input id={nome} name={nome} inputMode="numeric" maxLength={3} defaultValue={atual === undefined ? '' : String(atual)} placeholder={String(t.ativos)} className="w-20 rounded border border-slate-400 px-2 py-1.5 tabular-nums" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-600">Deixe em branco para contar todos os estudantes ativos da turma. Informe só a quantidade, nunca nomes.</p>
      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : 'Salvar presentes'}</BotaoPrimario>
      </div>
    </form>
  );
}

export function FormularioEnvioPeriodo({ periodoId, canal, mostrarWhatsapp }: { periodoId: string; canal: string; mostrarWhatsapp: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoEnvioPeriodo | undefined, FormData>(registrarResumoAlimentar, undefined);
  return (
    <div className="space-y-2 border-t border-slate-200 pt-3">
      <form action={acao} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="periodoId" value={periodoId} />
        <input type="hidden" name="canal" value={canal} />
        <SeletorModo id={`modo-${canal}`} mostrarWhatsapp={mostrarWhatsapp} />
        <button type="submit" disabled={enviando} className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-70">
          {enviando ? 'Registrando…' : 'Já enviei: registrar'}
        </button>
      </form>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
    </div>
  );
}
