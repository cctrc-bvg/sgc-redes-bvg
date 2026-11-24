'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { camposPendentes, linkEmail, linkWhatsapp, preencherCampos, textoParaEmail, type MensagemPronta } from '@/lib/comunicacao/mensagem';
import { MODELOS_TEXTO, modeloPorId, modelosDoTipo, NOME_TIPO_INTERACAO, TIPOS_INTERACAO } from '@/lib/comunicacao/modelos';

const botao =
  'inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100';
const botaoLink = 'inline-flex min-h-11 items-center rounded-md px-4 font-semibold text-white';

/** Copia com a API da área de transferência; em http (intranet) cai no método antigo. */
async function copiar(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // segue para o método antigo
  }
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/**
 * Mensagem pronta para encaminhar por e-mail ou WhatsApp (modo semiautomático). O texto é editável;
 * campos `{{...}}` (destinatários sem cadastro) podem ser preenchidos e substituídos de uma vez.
 * Sem JavaScript, os campos e os links continuam funcionando com o texto original.
 */
export function CaixaMensagem({ mensagem, mostrarWhatsapp, children }: { mensagem: MensagemPronta; mostrarWhatsapp: boolean; children?: ReactNode }) {
  const base = useId();
  const id = (s: string) => `${base}-${s}`;
  const [montado, setMontado] = useState(false);
  const [para, setPara] = useState(mensagem.para ?? '');
  const [assunto, setAssunto] = useState(mensagem.assunto);
  const [texto, setTexto] = useState(mensagem.texto);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState('');
  const [modelo, setModelo] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMontado(true), []);

  const campos = camposPendentes(texto, assunto);
  const opcoesModelo = mensagem.tipo ? modelosDoTipo(mensagem.tipo) : MODELOS_TEXTO;

  const aplicarModelo = (id: string) => {
    setModelo(id);
    const escolhido = modeloPorId(id);
    if (!escolhido) {
      setTexto(mensagem.texto);
      setAssunto(mensagem.assunto);
      setAviso('Texto gerado pelo sistema restaurado.');
      return;
    }
    const valores = mensagem.variaveis ?? {};
    setTexto(preencherCampos(escolhido.texto, valores));
    setAssunto(preencherCampos(escolhido.assunto, valores));
    setAviso(`Texto-padrão "${escolhido.rotulo}" aplicado. Confira os campos a preencher.`);
  };
  const restantes = campos;
  const whatsapp = mostrarWhatsapp && mensagem.aceitaWhatsapp;

  const acao = async (fazer: () => Promise<string> | string) => setAviso(await fazer());

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-900">{mensagem.titulo}</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={id('para')} className="block text-sm font-semibold text-slate-800">
            Para (e-mail)
          </label>
          <input
            id={id('para')}
            type="text"
            inputMode="email"
            autoComplete="off"
            value={para}
            onChange={(e) => setPara(e.target.value)}
            placeholder="nome@ifce.edu.br"
            className="mt-1 block w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
          />
          {!mensagem.para && <p className="mt-0.5 text-sm text-slate-600">Sem e-mail cadastrado: digite o endereço do destinatário.</p>}
        </div>
        <div>
          <label htmlFor={id('assunto')} className="block text-sm font-semibold text-slate-800">
            Assunto
          </label>
          <input
            id={id('assunto')}
            type="text"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900"
          />
        </div>
      </div>

      {montado && opcoesModelo.length > 0 && (
        <div>
          <label htmlFor={id('modelo')} className="block text-sm font-semibold text-slate-800">
            Texto-padrão
          </label>
          <select
            id={id('modelo')}
            value={modelo}
            onChange={(e) => aplicarModelo(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900 sm:max-w-md"
          >
            <option value="">Texto gerado pelo sistema</option>
            {mensagem.tipo
              ? opcoesModelo.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.rotulo}
                  </option>
                ))
              : TIPOS_INTERACAO.map((t) => (
                  <optgroup key={t} label={NOME_TIPO_INTERACAO[t]}>
                    {modelosDoTipo(t).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.rotulo}
                      </option>
                    ))}
                  </optgroup>
                ))}
          </select>
          <p className="mt-0.5 text-sm text-slate-600">Troca o assunto e o texto; o que o sistema não souber vira campo a preencher.</p>
        </div>
      )}

      <div>
        <label htmlFor={id('texto')} className="block text-sm font-semibold text-slate-800">
          Texto da mensagem
        </label>
        <textarea
          id={id('texto')}
          ref={areaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={Math.min(16, texto.split('\n').length + 1)}
          className="mt-1 block w-full rounded-md border border-slate-400 bg-slate-50 px-3 py-2 font-sans text-sm text-slate-900"
        />
      </div>

      {campos.length > 0 && (
        <fieldset className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <legend className="px-1 text-sm font-semibold text-slate-900">Campos a preencher</legend>
          {!montado ? (
            <p className="text-sm text-slate-800">Troque no texto os trechos entre {'{{ }}'} antes de enviar.</p>
          ) : (
            <div className="space-y-2">
              {campos.map((c, i) => (
                <div key={c}>
                  <label htmlFor={id(`campo-${i}`)} className="block text-sm text-slate-800">
                    {c}
                  </label>
                  <input
                    id={id(`campo-${i}`)}
                    type="text"
                    value={valores[c] ?? ''}
                    onChange={(e) => setValores({ ...valores, [c]: e.target.value })}
                    className="mt-0.5 block w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900 sm:max-w-sm"
                  />
                </div>
              ))}
              <button
                type="button"
                className={botao}
                onClick={() =>
                  acao(() => {
                    setTexto(preencherCampos(texto, valores));
                    setAssunto(preencherCampos(assunto, valores));
                    return 'Campos substituídos no texto.';
                  })
                }
              >
                Substituir no texto
              </button>
            </div>
          )}
        </fieldset>
      )}

      {montado && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botao} onClick={() => acao(async () => ((await copiar(texto)) ? 'Texto copiado.' : 'Não foi possível copiar: selecione o texto e use Ctrl+C.'))}>
            Copiar texto
          </button>
          <button
            type="button"
            className={botao}
            onClick={() => acao(async () => ((await copiar(textoParaEmail(texto))) ? 'Texto para e-mail copiado (sem a formatação do WhatsApp).' : 'Não foi possível copiar: selecione o texto e use Ctrl+C.'))}
          >
            Copiar para e-mail
          </button>
          <button type="button" className={botao} onClick={() => acao(async () => ((await copiar(assunto)) ? 'Assunto copiado.' : 'Não foi possível copiar o assunto.'))}>
            Copiar assunto
          </button>
          <button
            type="button"
            className={botao}
            onClick={() =>
              acao(async () => {
                try {
                  const colado = await navigator.clipboard.readText();
                  if (!colado.trim()) return 'A área de transferência está vazia.';
                  setTexto(colado);
                  return 'Texto colado na caixa.';
                } catch {
                  areaRef.current?.focus();
                  return 'O navegador não liberou a colagem: clique na caixa de texto e use Ctrl+V.';
                }
              })
            }
          >
            Colar na caixa
          </button>
          <button
            type="button"
            className={botao}
            onClick={() =>
              acao(() => {
                setTexto(mensagem.texto);
                setAssunto(mensagem.assunto);
                setPara(mensagem.para ?? '');
                setValores({});
                setModelo('');
                return 'Texto original restaurado.';
              })
            }
          >
            Restaurar original
          </button>
        </div>
      )}

      {restantes.length > 0 && montado && (
        <p className="text-sm font-semibold text-amber-800">
          <span aria-hidden="true">⚠ </span>Ainda há {restantes.length === 1 ? 'um campo' : `${restantes.length} campos`} a preencher: {restantes.join(', ')}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <a href={linkEmail({ para, assunto, texto })} className={`${botaoLink} bg-if-verde-700 hover:bg-if-verde-800`}>
          Abrir no e-mail
        </a>
        {whatsapp && (
          <a href={linkWhatsapp(texto, mensagem.whatsapp)} target="_blank" rel="noopener noreferrer" className={`${botaoLink} bg-slate-700 hover:bg-slate-800`}>
            Abrir no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
          </a>
        )}
        {mostrarWhatsapp && !mensagem.aceitaWhatsapp && <span className="text-sm text-slate-700">O destinatário prefere e-mail.</span>}
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-slate-700">
        {aviso}
      </p>

      {children}
    </div>
  );
}
