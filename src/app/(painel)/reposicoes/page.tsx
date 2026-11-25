import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/campo';
import { exigirUsuario } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { redirect } from 'next/navigation';
import { formatarData, hojeEmFortaleza } from '@/lib/ausencias/regras';
import { textoPrazoReposicao } from '@/lib/calendario/regras';
import { NOME_SITUACAO_REPOSICAO, ORIENTACAO_FORMULARIO } from '@/lib/reposicao/regras';
import { listarReposicoes } from '@/lib/reposicao/servidor';
import { darCienciaReposicao, desfazerReposicao } from './actions';
import { FormularioAnexo, FormularioReposicao } from './formularios';

export const metadata: Metadata = { title: 'Reposição de aulas — SGC-Redes' };

const tamanho = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const botao = 'inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100';

export default async function PaginaReposicoes() {
  const { usuario } = await exigirUsuario();
  const coordenacao = temPermissao(usuario, 'ausencias:registrar');
  if (!coordenacao && !temPermissao(usuario, 'ausencias:informar')) redirect('/painel?aviso=sem-permissao');
  const hoje = hojeEmFortaleza();
  const linhas = await listarReposicoes(hoje, coordenacao ? undefined : usuario.id);

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{coordenacao ? 'Reposição de aulas' : 'Minhas reposições'}</h1>
      <p className="mt-1 max-w-3xl text-slate-700">
        Aulas dispensadas devem ser repostas em até 15 dias letivos ou até o fim da etapa (ROD, Art. 37).{' '}
        {coordenacao
          ? 'O docente pode informar a reposição aqui; você dá ciência. Você também pode registrar direto, sem o docente.'
          : 'Informe aqui as aulas que você repôs; a Coordenação dá ciência.'}
      </p>
      <p className="mt-3 max-w-3xl rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800">
        <span aria-hidden="true">ℹ </span>
        {ORIENTACAO_FORMULARIO}
      </p>

      {linhas.length === 0 ? (
        <div className="mt-6">
          <Alerta tipo="info">Nenhuma reposição nos últimos 120 dias.</Alerta>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {linhas.map((l) => {
            const s = NOME_SITUACAO_REPOSICAO[l.situacao];
            return (
              <li key={l.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {l.disciplina} · {l.turma}
                    </p>
                    <p className="text-sm text-slate-700">
                      Aula de {formatarData(l.dataAula)}
                      {coordenacao && <> · {l.docente}</>}
                      {coordenacao && (
                        <>
                          {' · '}
                          <Link href={`/ausencias/${l.id}`} className="text-if-verde-700 underline underline-offset-2">ver ausência</Link>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">
                    <span aria-hidden="true">{s.icone}</span> {s.texto}
                  </span>
                </div>
                {!l.reposicaoEm && l.prazo && (
                  <p className={`mt-2 text-sm ${l.vencida ? 'font-semibold text-if-vermelho-700' : 'text-slate-700'}`}>
                    Prazo: {textoPrazoReposicao(l.prazo)}.{l.vencida && ' Prazo vencido.'}
                  </p>
                )}
                {l.reposicaoEm && (
                  <p className="mt-2 text-sm text-slate-700">
                    Reposta em {formatarData(l.reposicaoEm)}, {l.origem === 'DOCENTE' ? 'informada pelo docente' : 'registrada pela Coordenação'}.
                    {l.observacao && <> Observação: {l.observacao}</>}
                  </p>
                )}
                {l.anexos.length > 0 && (
                  <ul className="mt-2 text-sm">
                    {l.anexos.map((a) => (
                      <li key={a.id}>
                        <span aria-hidden="true">📎 </span>
                        <a href={`/reposicoes/anexo/${a.id}`} className="text-if-verde-700 underline underline-offset-2">{a.nome}</a> ({tamanho(a.tamanho)})
                      </li>
                    ))}
                  </ul>
                )}

                {!l.reposicaoEm && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-if-verde-700">{coordenacao ? 'Registrar reposição' : 'Informar que repus'}</summary>
                    <div className="mt-3">
                      <FormularioReposicao ausenciaId={l.id} dataMinima={l.dataAula} dataMaxima={hoje} rotulo={coordenacao ? 'Registrar reposição' : 'Informar reposição'} />
                    </div>
                  </details>
                )}
                {l.reposicaoEm && l.anexos.length < 3 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-if-verde-700">Anexar formulário</summary>
                    <div className="mt-3 max-w-md">
                      <FormularioAnexo ausenciaId={l.id} />
                    </div>
                  </details>
                )}
                {coordenacao && l.reposicaoEm && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {l.situacao === 'aguarda-ciencia' && (
                      <form action={darCienciaReposicao}>
                        <input type="hidden" name="ausenciaId" value={l.id} />
                        <button type="submit" className={botao}>Dar ciência</button>
                      </form>
                    )}
                    <form action={desfazerReposicao}>
                      <input type="hidden" name="ausenciaId" value={l.id} />
                      <button type="submit" className={botao}>Desfazer registro</button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
