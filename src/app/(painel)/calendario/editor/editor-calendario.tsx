'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Alerta } from '@/components/campo';
import {
  aplicarCategoria,
  clicarNoDia,
  contarInstantaneo,
  contagemDoInstantaneo,
  edicoesEntre,
  estadoDoInstantaneo,
  inserirFeriadosNacionais,
  instantaneoDoEstado,
  NOME_CATEGORIA,
  SELECAO_VAZIA,
  selecionarIntervalo,
  situacaoDoDia,
  voltarAoPadrao,
  type Categoria,
  type EstadoDosDias,
  type Instantaneo,
  type Selecao,
  type SituacaoDoDia,
} from '@/lib/calendario/editor';
import { DIAS_LETIVOS_ANO, DIAS_POR_ETAPA, diaDaSemanaISO, MESES, semanasDoMes, somarDiasISO } from '@/lib/calendario/regras';
import { NOME_DIA_EXTENSO } from '@/lib/grade/regras';
import { previaDoImpactoDoCalendario, salvarEdicaoDoCalendario, type ResultadoEdicao } from './actions';

const COR: Record<SituacaoDoDia, string> = {
  LETIVO: 'bg-white border-slate-300',
  FIM_DE_SEMANA: 'bg-slate-100 border-slate-200 text-slate-600',
  FIM_DE_SEMANA_LETIVO: 'bg-if-verde-100 border-if-verde-700',
  FERIADO: 'bg-red-100 border-red-400',
  PONTO_FACULTATIVO: 'bg-rose-100 border-rose-400',
  FERIAS_DOCENTES: 'bg-sky-100 border-sky-400',
  ENCONTRO_PEDAGOGICO: 'bg-amber-100 border-amber-400',
  AVALIACOES_FINAIS: 'bg-orange-100 border-orange-400',
  SUSPENSAO_AULAS: 'bg-red-200 border-red-600',
};

/** Texto curto no dia (a cor nunca é a única pista). */
const SIGLA: Record<SituacaoDoDia, string> = {
  LETIVO: '',
  FIM_DE_SEMANA: '',
  FIM_DE_SEMANA_LETIVO: 'Letivo',
  FERIADO: 'Feriado',
  PONTO_FACULTATIVO: 'P. fac.',
  FERIAS_DOCENTES: 'Recesso',
  ENCONTRO_PEDAGOGICO: 'Enc. ped.',
  AVALIACOES_FINAIS: 'Aval.',
  SUSPENSAO_AULAS: 'Suspenso',
};

const NOME_SITUACAO: Record<SituacaoDoDia, string> = { ...NOME_CATEGORIA, LETIVO: 'Dia letivo', FIM_DE_SEMANA: 'Fim de semana (sem aula)' };

const CATEGORIAS: Categoria[] = ['LETIVO', 'FERIADO', 'PONTO_FACULTATIVO', 'FERIAS_DOCENTES', 'ENCONTRO_PEDAGOGICO', 'AVALIACOES_FINAIS', 'SUSPENSAO_AULAS'];

const DIA_SEMANA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const NOME_DIA_LONGO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const rotuloData = (iso: string) => `${Number(iso.slice(8))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}, ${NOME_DIA_LONGO[diaDaSemanaISO(iso)]}`;

type ModoToque = 'normal' | 'varios' | 'intervalo';

export function EditorCalendario({ ano, instantaneo, baseNumero, somenteLeitura, motivosSuspensao }: { ano: number; instantaneo: Instantaneo; baseNumero: number; somenteLeitura: boolean; motivosSuspensao: string[] }) {
  const base = useMemo(() => estadoDoInstantaneo(instantaneo), [instantaneo]);
  const [estado, setEstado] = useState<EstadoDosDias>(base);
  const [desfazer, setDesfazer] = useState<EstadoDosDias[]>([]);
  const [refazer, setRefazer] = useState<EstadoDosDias[]>([]);
  const [selecao, setSelecao] = useState<Selecao>(SELECAO_VAZIA);
  const [foco, setFoco] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoToque>('normal');
  const [descricao, setDescricao] = useState('');
  const [motivoSuspensao, setMotivoSuspensao] = useState('');
  const [diaReferente, setDiaReferente] = useState(1);
  const [mesDe, setMesDe] = useState(1);
  const [mesAte, setMesAte] = useState(12);
  const [motivo, setMotivo] = useState('');
  const [resultado, setResultado] = useState<ResultadoEdicao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const router = useRouter();
  const botoes = useRef(new Map<string, HTMLButtonElement>());

  const edicoes = useMemo(() => edicoesEntre(base, estado), [base, estado]);
  const sujo = edicoes.length > 0;
  const instAtual = useMemo(() => instantaneoDoEstado(estado, instantaneo.etapas, instantaneo.semestres), [estado, instantaneo]);
  const contadores = useMemo(() => contarInstantaneo(instAtual, ano), [instAtual, ano]);
  const contadoresBase = useMemo(() => contarInstantaneo(instantaneo, ano), [instantaneo, ano]);
  const contagem = useMemo(() => contagemDoInstantaneo(instAtual, ano), [instAtual, ano]);
  const letivos = useMemo(() => new Set(contagem.letivos), [contagem]);
  const alteradas = useMemo(() => new Set(edicoes.map((e) => e.data)), [edicoes]);
  const comOutros = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of estado.outros) for (let d = e.inicio; d <= e.fim; d = somarDiasISO(d, 1)) m.set(d, [...(m.get(d) ?? []), `${e.descricao || e.tipo}`]);
    return m;
  }, [estado.outros]);
  const periodos = useMemo(() => (instantaneo.etapas.some(Boolean) ? instantaneo.etapas : instantaneo.semestres).filter((x): x is { inicio: string; fim: string } => x !== null), [instantaneo]);

  // Aviso do navegador ao sair com marcações não salvas.
  useEffect(() => {
    if (!sujo) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [sujo]);

  const mudar = (novo: EstadoDosDias) => {
    setDesfazer((p) => [...p.slice(-49), estado]);
    setRefazer([]);
    setEstado(novo);
    setResultado(null);
  };

  const aplicar = (c: Categoria) => {
    if (selecao.dias.size === 0) return setAviso('Selecione ao menos um dia antes de escolher a categoria.');
    if (c === 'SUSPENSAO_AULAS' && !motivoSuspensao) return setAviso('Escolha o motivo da suspensão ao lado antes de aplicar.');
    setAviso(null);
    mudar(aplicarCategoria(estado, selecao.dias, c, { descricao, motivo: motivoSuspensao, diaReferente }));
  };

  const clicar = (data: string, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
    setFoco(data);
    setAviso(null);
    setSelecao((s) => clicarNoDia(s, data, { shift: e.shiftKey || modo === 'intervalo', ctrl: e.ctrlKey || e.metaKey || modo === 'varios' }));
  };

  const mover = (data: string, dias: number, estender: boolean) => {
    const alvo = somarDiasISO(data, dias);
    if (!alvo.startsWith(`${ano}-`)) return;
    setFoco(alvo);
    if (estender) setSelecao((s) => clicarNoDia(s.ancora ? s : { dias: new Set([data]), ancora: data }, alvo, { shift: true }));
    requestAnimationFrame(() => botoes.current.get(alvo)?.focus());
  };

  const teclas = (data: string, e: React.KeyboardEvent) => {
    const passo: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in passo) {
      e.preventDefault();
      mover(data, passo[e.key]!, e.shiftKey);
    } else if (e.key === 'Escape') setSelecao(SELECAO_VAZIA);
  };

  const meses = Array.from({ length: Math.max(0, mesAte - mesDe + 1) }, (_, i) => mesDe + i);
  const selecionarMes = (m: number) => {
    const inicio = `${ano}-${String(m).padStart(2, '0')}-01`;
    const fim = `${ano}-${String(m).padStart(2, '0')}-${String(new Date(Date.UTC(ano, m, 0)).getUTCDate()).padStart(2, '0')}`;
    setSelecao(selecionarIntervalo(inicio, fim));
  };

  const [impacto, setImpacto] = useState<string[] | null>(null);
  /** Primeiro mostra o impacto fora do calendário (se houver); a gravação só ocorre ao confirmar. */
  const pedirSalvar = () => {
    iniciar(async () => {
      const p = await previaDoImpactoDoCalendario({ ano, edicoes });
      if (p.mensagem) return setResultado({ mensagem: p.mensagem });
      if (p.itens?.length) return setImpacto(p.itens);
      await gravar();
    });
  };
  const gravar = async () => {
    setImpacto(null);
    const r = await salvarEdicaoDoCalendario({ ano, baseNumero, motivo, edicoes });
    setResultado(r);
    // Com a revisão nova, a página volta com outra chave e a tela recomeça do que ficou salvo.
    if (r.sucesso) router.refresh();
  };

  const delta = (a: number, b: number) => (a === b ? null : <span className="ml-1 text-xs font-semibold text-if-verde-800">{a > b ? '+' : '−'}{Math.abs(a - b)}</span>);
  const linha = (rotulo: string, valor: number, antes: number, extra?: string) => (
    <div key={rotulo} className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1 text-sm">
      <dt className="text-slate-700">{rotulo}</dt>
      <dd className="font-semibold text-slate-900">
        {valor}
        {extra && <span className="font-normal text-slate-600"> {extra}</span>}
        {delta(valor, antes)}
      </dd>
    </div>
  );

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {!somenteLeitura && (
          <section aria-label="Marcar a seleção" className="sticky top-0 z-10 rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
            <p className="text-sm text-slate-800" role="status" aria-live="polite">
              <strong>{selecao.dias.size}</strong> {selecao.dias.size === 1 ? 'dia selecionado' : 'dias selecionados'}.
              {selecao.dias.size > 0 && (
                <button type="button" onClick={() => setSelecao(SELECAO_VAZIA)} className="ml-3 underline underline-offset-2">Limpar seleção</button>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Categoria a aplicar nos dias selecionados">
              {CATEGORIAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => aplicar(c)}
                  className={`min-h-11 rounded-md border px-3 text-sm font-semibold text-slate-900 hover:brightness-95 ${COR[c === 'LETIVO' ? 'FIM_DE_SEMANA_LETIVO' : c]}`}
                >
                  {NOME_CATEGORIA[c]}
                </button>
              ))}
              <button type="button" onClick={() => selecao.dias.size > 0 && mudar(voltarAoPadrao(estado, selecao.dias))} className="min-h-11 rounded-md border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100">
                Voltar ao padrão
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-3 text-sm">
              <label className="flex flex-col">
                <span className="text-slate-700">Rótulo (opcional)</span>
                <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={120} placeholder="Ex.: Natal" className="min-h-11 rounded-md border border-slate-400 px-2" />
              </label>
              <label className="flex flex-col">
                <span className="text-slate-700">Motivo (suspensão)</span>
                <select value={motivoSuspensao} onChange={(e) => setMotivoSuspensao(e.target.value)} className="min-h-11 rounded-md border border-slate-400 px-2">
                  <option value="">Escolha…</option>
                  {motivosSuspensao.map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
              <label className="flex flex-col">
                <span className="text-slate-700">Sábado/domingo letivo: grade de</span>
                <select value={diaReferente} onChange={(e) => setDiaReferente(Number(e.target.value))} className="min-h-11 rounded-md border border-slate-400 px-2">
                  {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{NOME_DIA_EXTENSO[d]}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <button type="button" disabled={desfazer.length === 0} onClick={() => { const p = desfazer.at(-1)!; setRefazer((r) => [...r, estado]); setDesfazer((d) => d.slice(0, -1)); setEstado(p); }} className="min-h-11 rounded-md border border-slate-400 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50">Desfazer</button>
              <button type="button" disabled={refazer.length === 0} onClick={() => { const p = refazer.at(-1)!; setDesfazer((d) => [...d, estado]); setRefazer((r) => r.slice(0, -1)); setEstado(p); }} className="min-h-11 rounded-md border border-slate-400 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50">Refazer</button>
              <button
                type="button"
                onClick={() => {
                  const r = inserirFeriadosNacionais(estado, ano);
                  if (r.inseridos === 0) return setAviso('Os feriados nacionais já estão marcados.');
                  mudar(r.estado);
                  setAviso(`${r.inseridos} feriados e pontos facultativos nacionais inseridos (só em dias úteis, sem trocar o que já estava marcado).`);
                }}
                className="min-h-11 rounded-md border border-slate-400 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-100"
              >
                Inserir feriados nacionais
              </button>
              <fieldset className="flex items-center gap-2">
                <legend className="sr-only">Modo de seleção por toque</legend>
                <span className="text-slate-700">Toque:</span>
                {(['normal', 'varios', 'intervalo'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1">
                    <input type="radio" name="modo-toque" checked={modo === m} onChange={() => setModo(m)} />
                    {m === 'normal' ? 'um dia' : m === 'varios' ? 'vários (Ctrl)' : 'intervalo (Shift)'}
                  </label>
                ))}
              </fieldset>
            </div>
            {aviso && <p className="mt-2 text-sm font-semibold text-slate-900" role="alert">{aviso}</p>}
          </section>
        )}

        <section aria-label="Meses" className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col"><span className="text-slate-700">De</span>
              <select value={mesDe} onChange={(e) => { const v = Number(e.target.value); setMesDe(v); if (mesAte < v) setMesAte(v); }} className="min-h-11 rounded-md border border-slate-400 px-2">
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label className="flex flex-col"><span className="text-slate-700">Até</span>
              <select value={mesAte} onChange={(e) => { const v = Number(e.target.value); setMesAte(v); if (mesDe > v) setMesDe(v); }} className="min-h-11 rounded-md border border-slate-400 px-2">
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => { setMesDe(1); setMesAte(12); }} className="min-h-11 underline underline-offset-2">Ano inteiro</button>
            <button type="button" onClick={() => { setMesDe(1); setMesAte(6); }} className="min-h-11 underline underline-offset-2">1º semestre</button>
            <button type="button" onClick={() => { setMesDe(7); setMesAte(12); }} className="min-h-11 underline underline-offset-2">2º semestre</button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700" aria-label="Legenda">
            {(['LETIVO', 'FIM_DE_SEMANA', 'FIM_DE_SEMANA_LETIVO', 'FERIADO', 'PONTO_FACULTATIVO', 'FERIAS_DOCENTES', 'ENCONTRO_PEDAGOGICO', 'AVALIACOES_FINAIS', 'SUSPENSAO_AULAS'] as const).map((s) => (
              <li key={s} className="flex items-center gap-1"><span aria-hidden="true" className={`inline-block h-3 w-3 rounded-sm border ${COR[s]}`} />{NOME_SITUACAO[s]}</li>
            ))}
            <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm border-2 border-dashed border-slate-900 bg-white" />Alterado e não salvo</li>
          </ul>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {meses.map((m) => (
            <section key={m} aria-labelledby={`mes-${m}`} className="rounded-lg border border-slate-200 bg-white p-2">
              <h2 id={`mes-${m}`} className="flex items-center justify-between px-1 text-base font-bold capitalize text-slate-900">
                {MESES[m - 1]}
                {!somenteLeitura && <button type="button" onClick={() => selecionarMes(m)} className="text-xs font-normal normal-case text-if-verde-700 underline underline-offset-2">selecionar o mês</button>}
              </h2>
              <table aria-labelledby={`mes-${m}`} className="mt-1 w-full table-fixed border-separate border-spacing-0.5">
                <thead>
                  <tr>{DIA_SEMANA_CURTO.map((d) => <th key={d} scope="col" className="text-xs font-semibold uppercase text-slate-600">{d}</th>)}</tr>
                </thead>
                <tbody>
                  {semanasDoMes(ano, m).map((semana, i) => (
                    <tr key={i}>
                      {semana.map((data, j) =>
                        data === null ? (
                          <td key={j} />
                        ) : (
                          <td key={data} className="p-0">
                            {(() => {
                              const sit = situacaoDoDia(estado, data);
                              const marca = estado.marcas.get(data);
                              const extra = estado.extras.get(data);
                              const escolhido = selecao.dias.has(data);
                              const foraDoPeriodo = periodos.length > 0 && !periodos.some((p) => p.inicio <= data && data <= p.fim);
                              const outros = comOutros.get(data);
                              const rotulo = [
                                rotuloData(data),
                                NOME_SITUACAO[sit] + (marca?.descricao ? ` (${marca.descricao})` : '') + (extra ? `, grade de ${NOME_DIA_EXTENSO[extra.diaReferente]}` : ''),
                                letivos.has(data) ? 'conta como dia letivo' : 'não conta como dia letivo',
                                outros ? `também: ${outros.join(', ')}` : '',
                                alteradas.has(data) ? 'alterado e não salvo' : '',
                                foraDoPeriodo ? 'fora das etapas cadastradas' : '',
                                escolhido ? 'selecionado' : '',
                              ].filter(Boolean).join('; ');
                              return (
                                <button
                                  type="button"
                                  ref={(el) => { if (el) botoes.current.set(data, el); else botoes.current.delete(data); }}
                                  tabIndex={foco === data || (foco === null && data === `${ano}-${String(mesDe).padStart(2, '0')}-01`) ? 0 : -1}
                                  aria-pressed={escolhido}
                                  title={rotulo}
                                  disabled={somenteLeitura}
                                  data-data={data}
                                  data-situacao={sit}
                                  onClick={(e) => clicar(data, e)}
                                  onKeyDown={(e) => teclas(data, e)}
                                  onFocus={() => setFoco(data)}
                                  className={`flex h-14 w-full select-none flex-col items-center justify-start rounded border px-0.5 pt-0.5 text-sm leading-tight ${COR[sit]} ${escolhido ? 'ring-2 ring-slate-900 ring-offset-1' : ''} ${alteradas.has(data) ? 'border-2 border-dashed border-slate-900' : ''} ${somenteLeitura ? 'cursor-default' : 'cursor-pointer'}`}
                                >
                                  <span className="font-semibold text-slate-900">{Number(data.slice(8))}</span>
                                  <span className="max-w-full truncate text-[10px] text-slate-900">{SIGLA[sit]}{outros ? ' •' : ''}</span>
                                  <span className="sr-only">{`, ${rotulo}`}</span>
                                </button>
                              );
                            })()}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>

      <aside aria-label="Contadores" className="space-y-4 lg:sticky lg:top-2 lg:self-start">
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h2 className="text-base font-bold text-slate-900">Contagem do ano</h2>
          <dl>
            {linha('Dias letivos', contadores.letivos, contadoresBase.letivos, `de ${DIAS_LETIVOS_ANO}`)}
            {contadores.porEtapa.map((n, i) => n !== null && linha(`Etapa N${i + 1}`, n, contadoresBase.porEtapa[i] ?? 0, `de ${DIAS_POR_ETAPA}`))}
            {contadores.porSemestre.map((n, i) => n !== null && linha(`${i + 1}º semestre`, n, contadoresBase.porSemestre[i] ?? 0))}
            {linha('Sábados letivos', contadores.sabadosLetivos, contadoresBase.sabadosLetivos)}
            {linha('Domingos letivos', contadores.domingosLetivos, contadoresBase.domingosLetivos)}
            {linha('Feriados (dias úteis)', contadores.feriados, contadoresBase.feriados)}
            {linha('Pontos facultativos', contadores.pontosFacultativos, contadoresBase.pontosFacultativos)}
            {linha('Férias / recesso', contadores.feriasDocentes, contadoresBase.feriasDocentes)}
            {linha('Encontros pedagógicos', contadores.encontrosPedagogicos, contadoresBase.encontrosPedagogicos)}
            {linha('Avaliações finais', contadores.avaliacoesFinais, contadoresBase.avaliacoesFinais)}
            {linha('Suspensões (força maior)', contadores.suspensoes, contadoresBase.suspensoes)}
            {contadores.perdidosImprevistos > 0 && linha('Dias a repor (imprevistos)', contadores.perdidosImprevistos, contadoresBase.perdidosImprevistos)}
          </dl>
          <p className="mt-2 text-xs text-slate-600">Os números acompanham as marcações na tela; o sinal ao lado mostra a diferença para o que está salvo.</p>
        </section>

        {!somenteLeitura && (
          <section className="rounded-lg border border-slate-300 bg-white p-3" aria-label="Salvar">
            <p className="text-sm font-semibold text-slate-900" role="status">
              {sujo ? `${edicoes.length} ${edicoes.length === 1 ? 'dia alterado' : 'dias alterados'}, ainda não salvos.` : 'Nenhuma alteração pendente.'}
            </p>
            <label className="mt-2 flex flex-col text-sm">
              <span className="text-slate-700">Motivo da mudança (opcional, vai para o histórico)</span>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className="min-h-11 rounded-md border border-slate-400 px-2" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={!sujo || salvando} onClick={pedirSalvar} className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800 disabled:cursor-not-allowed disabled:opacity-60">
                {salvando ? 'Salvando…' : 'Salvar calendário'}
              </button>
              <button type="button" disabled={!sujo || salvando} onClick={() => { setEstado(base); setDesfazer([]); setRefazer([]); setResultado(null); }} className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60">
                Descartar
              </button>
            </div>
            {impacto && (
              <div className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-slate-900" role="alert">
                <p className="font-semibold">Antes de gravar, confira o que isto afeta:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {impacto.map((t) => <li key={t}>{t}</li>)}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={salvando} onClick={() => iniciar(gravar)} className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800 disabled:opacity-60">
                    Gravar mesmo assim
                  </button>
                  <button type="button" onClick={() => setImpacto(null)} className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
                    Voltar e ajustar
                  </button>
                </div>
              </div>
            )}
            {resultado?.mensagem && (
              <div className="mt-3">
                <Alerta tipo={resultado.sucesso ? 'sucesso' : 'erro'}>{resultado.mensagem}</Alerta>
                {resultado.avisarEventoId && (
                  <p className="mt-2 text-sm">
                    <Link href={`/calendario/eventos/${resultado.avisarEventoId}/comunicar`} className="font-semibold text-if-verde-700 underline underline-offset-2">Preparar os avisos da suspensão</Link>
                  </p>
                )}
              </div>
            )}
          </section>
        )}
        <p className="text-xs text-slate-600">
          Etapas e semestres continuam em <Link href={`/calendario/etapas?ano=${ano}`} className="underline underline-offset-2">Etapas e semestres</Link>; eventos de um dia só, como reuniões, em <Link href="/calendario/eventos/novo" className="underline underline-offset-2">Novo evento</Link>.
        </p>
      </aside>
    </div>
  );
}
