'use client';

import { useActionState } from 'react';
import { Alerta, BotaoPrimario } from '@/components/campo';
import type { EstadoImportacao, LinhaResultado } from '@/lib/importacao/estado';

type Acao = (estado: EstadoImportacao | undefined, formData: FormData) => Promise<EstadoImportacao>;

const SITUACAO: Record<LinhaResultado['situacao'], { icone: string; texto: string; classe: string }> = {
  criar: { icone: '＋', texto: 'Novo', classe: 'bg-if-verde-50 text-if-verde-800' },
  atualizar: { icone: '✎', texto: 'Alterar', classe: 'bg-sky-50 text-sky-900' },
  igual: { icone: '=', texto: 'Sem mudança', classe: 'bg-slate-100 text-slate-700' },
  ignorar: { icone: '↷', texto: 'Ignorado', classe: 'bg-slate-100 text-slate-700' },
  erro: { icone: '⚠', texto: 'Erro', classe: 'bg-if-vermelho-50 text-if-vermelho-700' },
};

const classeLinkModelo =
  'inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100';

/**
 * Fluxo de importação em 3 passos, sem depender de JavaScript: baixar o modelo, enviar a planilha
 * (o servidor analisa e mostra a prévia, sem gravar) e confirmar (o servidor valida de novo e grava).
 */
export function ImportadorPlanilha({
  acao,
  modeloBase,
  itens,
  ocultos = {},
}: {
  acao: Acao;
  modeloBase: string;
  itens: string;
  /** Contexto da importação (ex.: ano, semestre), enviado nos dois passos. Nunca use acao.bind: sem JS, re-renderiza sem fim. */
  ocultos?: Record<string, string>;
}) {
  const camposOcultos = Object.entries(ocultos).map(([nome, valor]) => <input key={nome} type="hidden" name={nome} value={valor} />);
  const [estado, enviar, enviando] = useActionState<EstadoImportacao | undefined, FormData>(acao, undefined);
  const linhas = estado?.linhas ?? [];
  const contagem = (s: LinhaResultado['situacao']) => linhas.filter((l) => l.situacao === s).length;
  const temErros = contagem('erro') > 0;

  return (
    <div className="space-y-6">
      <section aria-labelledby="passo1" className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="passo1" className="text-lg font-semibold text-slate-900">1. Baixe o modelo</h2>
        <p className="mt-1 text-sm text-slate-700">
          O modelo já vem preenchido. Edite no Excel ou no LibreOffice: a aba &quot;Instruções&quot; explica cada coluna.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a href={`${modeloBase}${modeloBase.includes('?') ? '&' : '?'}formato=xlsx`} className={classeLinkModelo} download>
            Baixar modelo (.xlsx)
          </a>
          <a href={`${modeloBase}${modeloBase.includes('?') ? '&' : '?'}formato=csv`} className={classeLinkModelo} download>
            Baixar modelo (.csv)
          </a>
        </div>
      </section>

      <section aria-labelledby="passo2" className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="passo2" className="text-lg font-semibold text-slate-900">2. Envie a planilha</h2>
        <p className="mt-1 text-sm text-slate-700">Nada é gravado agora: você verá uma prévia para conferir antes de confirmar.</p>
        <form action={enviar} className="mt-4 space-y-4">
          {camposOcultos}
          <div>
            <label htmlFor="arquivo" className="block text-sm font-semibold text-slate-800">
              Arquivo (.xlsx ou .csv, até 1 MB)
            </label>
            <input
              id="arquivo"
              name="arquivo"
              type="file"
              required
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="mt-1 block w-full rounded-md border border-slate-400 bg-white p-2 text-base text-slate-900 file:mr-3 file:min-h-11 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:font-semibold"
            />
          </div>
          <div className="sm:max-w-xs">
            <BotaoPrimario carregando={enviando}>{enviando ? 'Analisando…' : 'Analisar planilha'}</BotaoPrimario>
          </div>
        </form>
      </section>

      {estado?.mensagem && (
        <div aria-live="polite">
          <Alerta tipo={estado.sucesso ? 'sucesso' : temErros || !estado.linhas ? 'erro' : 'info'}>{estado.mensagem}</Alerta>
        </div>
      )}
      {estado?.avisos?.map((a) => (
        <Alerta key={a} tipo="info">
          {a}
        </Alerta>
      ))}

      {estado?.credenciais && estado.credenciais.length > 0 && (
        <section aria-labelledby="senhas" className="rounded-lg border-2 border-amber-400 bg-amber-50 p-6">
          <h2 id="senhas" className="text-lg font-semibold text-slate-900">Senhas provisórias</h2>
          <p className="mt-1 text-sm text-slate-800">
            <strong>Anote ou baixe agora: não serão exibidas novamente.</strong> Cada pessoa troca a senha no primeiro acesso.
          </p>
          {estado.credenciaisCsv && (
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(estado.credenciaisCsv)}`}
              download="senhas-provisorias.csv"
              className={`${classeLinkModelo} mt-3`}
            >
              Baixar lista de senhas (.csv)
            </a>
          )}
          <div className="mt-4 overflow-x-auto rounded-md border border-amber-300 bg-white">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">Usuários cadastrados e suas senhas provisórias</caption>
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Nome</th>
                  <th scope="col" className="px-3 py-2 font-semibold">E-mail</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Senha provisória</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estado.credenciais.map((c) => (
                  <tr key={c.email}>
                    <th scope="row" className="px-3 py-2 font-normal">{c.nome}</th>
                    <td className="px-3 py-2">{c.email}</td>
                    <td className="px-3 py-2">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-base">{c.senha}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {linhas.length > 0 && !estado?.concluido && (
        <section aria-labelledby="passo3" className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="passo3" className="text-lg font-semibold text-slate-900">3. Confira e confirme</h2>
          <p className="mt-1 text-sm text-slate-700">
            {linhas.length} linha(s): {contagem('criar')} novo(s), {contagem('atualizar')} a alterar, {contagem('igual') + contagem('ignorar')} sem
            mudança, {contagem('erro')} com erro.
          </p>
          <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Prévia da importação de {itens}, linha a linha</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <tr>
                  <th scope="col" className="w-16 px-3 py-2 font-semibold">Linha</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Item</th>
                  <th scope="col" className="w-36 px-3 py-2 font-semibold">Situação</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((l) => {
                  const s = SITUACAO[l.situacao];
                  return (
                    <tr key={l.numero} className={l.situacao === 'erro' ? 'bg-if-vermelho-50/40' : ''}>
                      <td className="px-3 py-2 tabular-nums">{l.numero}</td>
                      <th scope="row" className="px-3 py-2 font-normal">{l.descricao}</th>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.classe}`}>
                          <span aria-hidden="true">{s.icone}</span> {s.texto}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{l.detalhe ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {estado?.dados && !temErros && (
            <form action={enviar} className="mt-4 sm:max-w-xs">
              <input type="hidden" name="etapa" value="confirmar" />
              {camposOcultos}
              <input type="hidden" name="dados" value={estado.dados} />
              <BotaoPrimario carregando={enviando}>{enviando ? 'Gravando…' : 'Confirmar importação'}</BotaoPrimario>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
