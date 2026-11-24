'use client';

import { useActionState, useRef, useState } from 'react';
import type { CanalWhatsapp } from '@prisma/client';
import { Alerta, BotaoPrimario } from '@/components/campo';
import { NOME_CANAL } from '@/lib/ausencias/mensagens';
import { camposPendentes } from '@/lib/comunicacao/mensagem';
import { CAMPOS_AUTOMATICOS, NOME_TIPO_INTERACAO, TIPOS_INTERACAO, tipoDoCampo, VARIAVEIS } from '@/lib/comunicacao/modelos';
import { atualizarModelo, criarModelo, removerModelo, type EstadoModelo, type EstadoRemocao } from './actions';

const entrada = 'mt-1 block w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900';
const CANAIS = Object.keys(NOME_CANAL) as CanalWhatsapp[];

const COMO_PREENCHE: Record<ReturnType<typeof tipoDoCampo>, string> = {
  turma: 'lista de turmas cadastradas',
  disciplina: 'lista de disciplinas cadastradas',
  data: 'seletor de data',
  hora: 'seletor de hora',
  horarios: 'lista de horários cadastrados',
  texto: 'texto livre',
};

export interface DadosModelo {
  id?: string;
  tipo: string;
  rotulo: string;
  assunto: string;
  texto: string;
  destinos: string[];
}

/** Criar ou editar texto-padrão, com os campos de substituição visíveis e botões para inseri-los. */
export function FormularioModelo({ inicial }: { inicial: DadosModelo }) {
  const editar = Boolean(inicial.id);
  const [estado, acao, enviando] = useActionState<EstadoModelo | undefined, FormData>(editar ? atualizarModelo : criarModelo, undefined);
  const v = estado?.valores;
  const [texto, setTexto] = useState(String(v?.texto ?? inicial.texto));
  const [assunto, setAssunto] = useState(String(v?.assunto ?? inicial.assunto));
  const destinos = new Set((v?.destinos as string[] | undefined) ?? inicial.destinos);
  const area = useRef<HTMLTextAreaElement>(null);
  const campos = camposPendentes(assunto, texto);

  const inserir = (nome: string) => {
    const el = area.current;
    const marca = `{{${nome}}}`;
    if (!el) return setTexto(texto + marca);
    const ini = el.selectionStart ?? texto.length;
    const fim = el.selectionEnd ?? texto.length;
    setTexto(texto.slice(0, ini) + marca + texto.slice(fim));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  };

  return (
    <form action={acao} className="space-y-5" noValidate>
      {estado?.mensagem && <Alerta tipo={estado.sucesso ? 'sucesso' : 'erro'}>{estado.mensagem}</Alerta>}
      {inicial.id && <input type="hidden" name="modeloId" value={inicial.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tipo" className="block text-sm font-semibold text-slate-800">
            Tipo de interação
          </label>
          <select key={String(v?.tipo ?? inicial.tipo)} id="tipo" name="tipo" defaultValue={String(v?.tipo ?? inicial.tipo)} className={entrada}>
            {TIPOS_INTERACAO.map((t) => (
              <option key={t} value={t}>
                {NOME_TIPO_INTERACAO[t]}
              </option>
            ))}
          </select>
          {estado?.erros?.tipo && <p className="mt-1 text-sm text-if-vermelho-700">{estado.erros.tipo}</p>}
        </div>
        <div>
          <label htmlFor="rotulo" className="block text-sm font-semibold text-slate-800">
            Nome do texto-padrão
          </label>
          <input id="rotulo" name="rotulo" defaultValue={String(v?.rotulo ?? inicial.rotulo)} maxLength={60} placeholder="Ex.: Formal (e-mail)" className={entrada} />
          {estado?.erros?.rotulo && <p className="mt-1 text-sm text-if-vermelho-700">{estado.erros.rotulo}</p>}
        </div>
      </div>

      <fieldset className="rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Destinatários sugeridos (mensagem avulsa)</legend>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {CANAIS.map((c) => (
            <label key={c} className="flex min-h-9 items-center gap-2 text-slate-800">
              <input type="checkbox" name="destinos" value={c} defaultChecked={destinos.has(c)} className="size-5 accent-if-verde-700" />
              {NOME_CANAL[c]}
            </label>
          ))}
        </div>
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
          Campos de substituição entre chaves duplas, ex.: {'{{data}}'}. Use *negrito* e _itálico_ do WhatsApp; no e-mail a marcação sai sozinha.
        </p>
        <textarea id="texto" name="texto" ref={area} value={texto} onChange={(e) => setTexto(e.target.value)} rows={12} maxLength={4000} className={entrada} />
        {estado?.erros?.texto && <p className="mt-1 text-sm text-if-vermelho-700">{estado.erros.texto}</p>}
      </div>

      <section aria-labelledby="variaveis" className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <h2 id="variaveis" className="text-sm font-semibold text-slate-900">
          Inserir campo no texto
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          Estes o sistema preenche nas mensagens geradas (ausência, diário). Qualquer outro nome entre {'{{ }}'} vira campo a preencher na tela.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {Object.entries(VARIAVEIS).map(([nome, descricao]) => (
            <li key={nome}>
              <button
                type="button"
                onClick={() => inserir(nome)}
                title={descricao}
                className="inline-flex min-h-9 items-center rounded-md border border-slate-400 bg-white px-2 font-mono text-sm text-slate-800 hover:bg-slate-100"
              >
                {`{{${nome}}}`}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="campos-detectados" aria-live="polite">
        <h2 id="campos-detectados" className="text-sm font-semibold text-slate-900">
          Campos de substituição deste texto ({campos.length})
        </h2>
        {campos.length === 0 ? (
          <p className="mt-1 text-sm text-slate-700">Nenhum campo: o texto vai como está.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-slate-800">
            {campos.map((c) => (
              <li key={c}>
                <code className="rounded bg-slate-100 px-1">{`{{${c}}}`}</code> —{' '}
                {(CAMPOS_AUTOMATICOS as readonly string[]).includes(c)
                  ? `preenchido pelo sistema (${VARIAVEIS[c as keyof typeof VARIAVEIS]})`
                  : c in VARIAVEIS
                    ? `preenchido pelo sistema nas mensagens geradas (${VARIAVEIS[c as keyof typeof VARIAVEIS]}); na mensagem avulsa, a preencher: ${COMO_PREENCHE[tipoDoCampo(c)]}`
                    : `a preencher: ${COMO_PREENCHE[tipoDoCampo(c)]}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sm:max-w-xs">
        <BotaoPrimario carregando={enviando}>{enviando ? 'Salvando…' : editar ? 'Salvar alterações' : 'Criar texto-padrão'}</BotaoPrimario>
      </div>
    </form>
  );
}

export function FormularioRemocao({ id }: { id: string }) {
  const [estado, acao, enviando] = useActionState<EstadoRemocao | undefined, FormData>(removerModelo, undefined);
  return (
    <form action={acao} className="space-y-3" noValidate>
      {estado?.mensagem && <Alerta tipo="erro">{estado.mensagem}</Alerta>}
      <input type="hidden" name="modeloId" value={id} />
      <label className="flex items-start gap-3 text-slate-800">
        <input name="confirmo" type="checkbox" className="mt-1 size-5 accent-if-vermelho-700" />
        Confirmo a remoção deste texto-padrão (o histórico de envios não muda).
      </label>
      <button
        type="submit"
        disabled={enviando}
        className="inline-flex min-h-11 items-center rounded-md border border-if-vermelho-700 bg-white px-4 font-semibold text-if-vermelho-700 hover:bg-if-vermelho-50 disabled:opacity-70"
      >
        {enviando ? 'Removendo…' : 'Remover texto-padrão'}
      </button>
    </form>
  );
}
