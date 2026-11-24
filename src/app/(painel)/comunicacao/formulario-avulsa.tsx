'use client';

import { useActionState, useState } from 'react';
import { Alerta, BotaoPrimario } from '@/components/campo';
import { CaixaMensagem } from '@/components/caixa-mensagem';
import { SeletorModo } from '@/components/seletor-modo';
import { camposPendentes } from '@/lib/comunicacao/mensagem';
import {
  CAMPOS_AUTOMATICOS,
  modeloPorId,
  modelosDoTipo,
  NOME_TIPO_INTERACAO,
  TIPOS_INTERACAO,
  tipoDoCampo,
  type ModeloTexto,
} from '@/lib/comunicacao/modelos';
import { prepararAvulsa, type EstadoAvulsa, type ValoresAvulsa } from './actions';

type Opcao = { valor: string; rotulo: string };

export interface PropsAvulsa {
  modelos: ModeloTexto[];
  canais: Opcao[];
  docentes: Opcao[];
  usuarios: Opcao[];
  /** Dados cadastrados para os campos (listas de escolha). */
  opcoes: { turmas: Opcao[]; disciplinas: string[]; horarios: string[] };
  mostrarWhatsapp: boolean;
}

const entrada = 'mt-1 block w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900';
const VAZIO: ValoresAvulsa = { destinos: [], assunto: '', texto: '', modelo: '', campos: {} };

/** Mensagem avulsa: texto-padrão, vários destinatários e campos com listas de dados cadastrados, data e hora. */
export function FormularioAvulsa(props: PropsAvulsa) {
  const [estado, acao, enviando] = useActionState<EstadoAvulsa | undefined, FormData>(prepararAvulsa, undefined);
  const v = estado?.valores ?? VAZIO;
  return (
    <div className="space-y-6">
      {/* A cada resposta do servidor o editor recomeça com o que foi enviado. */}
      <Editor key={JSON.stringify(v)} {...props} inicial={v} estado={estado} acao={acao} enviando={enviando} />
      {estado?.vazios && estado.vazios.length > 0 && (
        <Alerta tipo="info">Sem ninguém para receber em: {estado.vazios.map((d) => rotuloDoDestino(props, d)).join(', ')} (sem ofertas no ano ou cadastro inativo).</Alerta>
      )}
      {estado?.prontas?.map((p) => (
        <CaixaMensagem key={p.chave} mensagem={p} mostrarWhatsapp={props.mostrarWhatsapp}>
          <form action={acao} className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
            {v.destinos.map((d) => (
              <input key={d} type="hidden" name="destino" value={d} />
            ))}
            <input type="hidden" name="assunto" value={v.assunto} />
            <input type="hidden" name="texto" value={v.texto} />
            <input type="hidden" name="modelo" value={v.modelo} />
            {Object.entries(v.campos).map(([nome, valor]) => (
              <input key={nome} type="hidden" name={`campo:${nome}`} value={valor} />
            ))}
            <input type="hidden" name="registrar" value={p.chave} />
            <SeletorModo id={`modo-${p.chave.replace(/[^a-zA-Z0-9]/g, '-')}`} mostrarWhatsapp={props.mostrarWhatsapp} />
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-70"
            >
              Já enviei: registrar
            </button>
          </form>
        </CaixaMensagem>
      ))}
    </div>
  );
}

function rotuloDoDestino(p: PropsAvulsa, valor: string) {
  return [...p.canais, ...p.docentes, ...p.usuarios].find((o) => o.valor === valor)?.rotulo ?? valor;
}

function Editor(
  props: PropsAvulsa & { inicial: ValoresAvulsa; estado: EstadoAvulsa | undefined; acao: (f: FormData) => void; enviando: boolean },
) {
  const { inicial, estado, modelos } = props;
  const [modelo, setModelo] = useState(inicial.modelo);
  const [destinos, setDestinos] = useState<Set<string>>(new Set(inicial.destinos));
  const [assunto, setAssunto] = useState(inicial.assunto);
  const [texto, setTexto] = useState(inicial.texto);
  const [campos, setCampos] = useState<Record<string, string>>(inicial.campos);

  const pendentes = camposPendentes(assunto, texto).filter((c) => !(CAMPOS_AUTOMATICOS as readonly string[]).includes(c));
  const pessoasMarcadas = props.usuarios.filter((u) => destinos.has(u.valor)).length;

  const escolherModelo = (id: string) => {
    setModelo(id);
    const m = modeloPorId(id, modelos);
    if (!m) return;
    setAssunto(m.assunto);
    setTexto(m.texto);
    // Encadeia os destinatários sugeridos do modelo (grupos/setores); grupos de docentes e pessoas ficam como estavam.
    setDestinos((atual) => new Set([...[...atual].filter((d) => !d.startsWith('canal:')), ...m.destinos.map((c) => `canal:${c}`)]));
  };
  const alternar = (valor: string, marcado: boolean) =>
    setDestinos((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(valor);
      else novo.delete(valor);
      return novo;
    });

  const caixas = (titulo: string, opcoes: Opcao[]) => (
    <div>
      <p className="text-sm font-semibold text-slate-800">{titulo}</p>
      <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
        {opcoes.map((o) => (
          <label key={o.valor} className="flex min-h-9 items-center gap-2 text-slate-800">
            <input
              type="checkbox"
              name="destino"
              value={o.valor}
              checked={destinos.has(o.valor)}
              onChange={(e) => alternar(o.valor, e.target.checked)}
              className="size-5 accent-if-verde-700"
            />
            {o.rotulo}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <form action={props.acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}

      <div>
        <label htmlFor="modelo" className="block text-sm font-semibold text-slate-800">
          Texto-padrão (opcional)
        </label>
        <select id="modelo" name="modelo" value={modelo} onChange={(e) => escolherModelo(e.target.value)} className={`${entrada} sm:max-w-xl`}>
          <option value="">Escrever do zero</option>
          {TIPOS_INTERACAO.filter((t) => modelosDoTipo(t, modelos).length > 0).map((t) => (
            <optgroup key={t} label={NOME_TIPO_INTERACAO[t]}>
              {modelosDoTipo(t, modelos).map((o) => (
                <option key={o.id} value={o.id}>
                  {NOME_TIPO_INTERACAO[t]} — {o.rotulo}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-0.5 text-sm text-slate-600">
          Preenche assunto e texto e já marca os destinatários sugeridos (pode trocar). Sem JavaScript, deixe o texto vazio e clique em Gerar.
        </p>
      </div>

      <fieldset className="space-y-3 rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Destinatários</legend>
        {estado?.erros?.destino && <p className="text-sm font-semibold text-if-vermelho-700">{estado.erros.destino}</p>}
        {caixas('Grupos e setores', props.canais)}
        {caixas('Grupos de docentes (pelas ofertas do ano)', props.docentes)}
        <details open={pessoasMarcadas > 0}>
          <summary className="cursor-pointer text-sm font-semibold text-if-verde-700 underline underline-offset-2">
            Pessoas{pessoasMarcadas > 0 ? ` (${pessoasMarcadas} marcada(s))` : ''}
          </summary>
          <div className="mt-2">{caixas('Usuários do sistema', props.usuarios)}</div>
        </details>
      </fieldset>

      <div>
        <label htmlFor="assunto" className="block text-sm font-semibold text-slate-800">
          Assunto
        </label>
        <input id="assunto" name="assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={150} className={entrada} />
        {estado?.erros?.assunto && <p className="mt-1 text-sm text-if-vermelho-700">{estado.erros.assunto}</p>}
      </div>
      <div>
        <label htmlFor="texto" className="block text-sm font-semibold text-slate-800">
          Texto
        </label>
        <p className="text-sm text-slate-600">
          Sem saudação no início, o sistema põe &quot;Olá, nome!&quot;. Trechos entre {'{{ }}'} são campos. Sem dados sensíveis.
        </p>
        <textarea id="texto" name="texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={9} maxLength={4000} className={entrada} />
        {estado?.erros?.texto && <p className="mt-1 text-sm text-if-vermelho-700">{estado.erros.texto}</p>}
      </div>

      {pendentes.length > 0 && (
        <fieldset className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Campos do texto</legend>
          <p className="text-sm text-slate-700">
            {'{{nome}}'} e {'{{destinatarios}}'} são preenchidos para cada destinatário; {'{{dia}}'} sai da data. Campo vazio continua para preencher na caixa.
          </p>
          <datalist id="lista-turmas">
            {props.opcoes.turmas.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </datalist>
          <datalist id="lista-disciplinas">
            {props.opcoes.disciplinas.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <datalist id="lista-horarios">
            {props.opcoes.horarios.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
          <div className="grid gap-3 sm:grid-cols-2">
            {pendentes.map((nome, i) => {
              const tipo = tipoDoCampo(nome);
              const id = `campo-${i}`;
              const comum = {
                id,
                name: `campo:${nome}`,
                value: campos[nome] ?? '',
                onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCampos({ ...campos, [nome]: e.target.value }),
                className: entrada,
              };
              return (
                <div key={nome} className={tipo === 'horarios' ? 'sm:col-span-2' : undefined}>
                  <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
                    {nome}
                    <span className="font-normal text-slate-600">
                      {tipo === 'turma' ? ' (turmas cadastradas)' : tipo === 'disciplina' ? ' (disciplinas cadastradas)' : tipo === 'horarios' ? ' (um por linha)' : ''}
                    </span>
                  </label>
                  {tipo === 'data' ? (
                    <input type="date" {...comum} />
                  ) : tipo === 'hora' ? (
                    <input type="time" {...comum} />
                  ) : tipo === 'horarios' ? (
                    <HorariosLista {...comum} horarios={props.opcoes.horarios} aoMudar={(valor) => setCampos({ ...campos, [nome]: valor })} />
                  ) : (
                    <input
                      type="text"
                      list={tipo === 'turma' ? 'lista-turmas' : tipo === 'disciplina' ? 'lista-disciplinas' : undefined}
                      autoComplete="off"
                      {...comum}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={props.enviando}>{props.enviando ? 'Gerando…' : 'Gerar mensagens'}</BotaoPrimario>
      </div>
    </form>
  );
}

/** Lista de horários: escolhe um horário cadastrado para acrescentar (ou digita livremente, um por linha). */
function HorariosLista(p: {
  id: string;
  name: string;
  value: string;
  className: string;
  horarios: string[];
  aoMudar: (v: string) => void;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <select
        aria-label="Acrescentar horário cadastrado"
        value=""
        onChange={(e) => e.target.value && p.aoMudar(`${p.value ? `${p.value}\n` : ''}- ${e.target.value}`)}
        className={p.className}
      >
        <option value="">Acrescentar horário cadastrado…</option>
        {p.horarios.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <textarea id={p.id} name={p.name} value={p.value} onChange={p.onChange} rows={3} className={p.className} />
    </div>
  );
}
