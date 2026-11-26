import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/campo';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { anoEmBranco } from '@/lib/calendario/editor';
import { MOTIVOS_SUSPENSAO } from '@/lib/calendario/regras';
import { carregarRevisao, garantirRevisaoInicial, instantaneoAtual, listarRevisoes, NOME_ORIGEM } from '@/lib/calendario/revisoes';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';
import { EditorCalendario } from './editor-calendario';
import { criarAnoAPartirDoAnterior, restaurarRevisaoDoCalendario } from './actions';

export const metadata: Metadata = { title: 'Editor do calendário — SGC-Redes' };

const AVISOS: Record<string, string> = {
  restaurado: 'Revisão restaurada. O calendário vigente voltou àquele estado (e isso ficou registrado como uma nova revisão).',
  confirme: 'Marque a confirmação para restaurar a revisão.',
  criado: 'Calendário criado a partir do ano anterior. Confira as datas, ajuste o que for preciso e salve.',
  ocupado: 'Este ano já tem calendário: nada foi copiado.',
  'sem-anterior': 'O ano anterior não tem calendário para servir de modelo.',
};

const quando = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' });

export default async function PaginaEditorCalendario({ searchParams }: { searchParams: Promise<{ ano?: string; revisao?: string; aviso?: string }> }) {
  const { usuario } = await exigirPermissao('calendario:ver');
  const podeEditar = temPermissao(usuario, 'calendario:gerenciar');
  const sp = await searchParams;
  const ano = lerAnoLetivo(sp.ano) ?? anoLetivoAtual();
  await garantirRevisaoInicial(ano);
  const [atual, revisoes, anteriorAno] = await Promise.all([instantaneoAtual(ano), listarRevisoes(ano), instantaneoAtual(ano - 1)]);
  const podeCriarDoAnterior = podeEditar && anoEmBranco(atual) && !anoEmBranco(anteriorAno);
  const ultimo = revisoes[0]?.numero ?? 0;
  const pedida = /^\d+$/.test(sp.revisao ?? '') ? Number(sp.revisao) : null;
  const antiga = pedida !== null && pedida !== ultimo ? await carregarRevisao(ano, pedida) : null;
  const instantaneo = antiga ? antiga.dados : atual;
  const numeros = revisoes.map((r) => r.numero).sort((a, b) => a - b);
  const mostrada = antiga ? antiga.numero : ultimo;
  const i = numeros.indexOf(mostrada);
  const anterior = i > 0 ? numeros[i - 1]! : null;
  const seguinte = i >= 0 && i < numeros.length - 1 ? numeros[i + 1]! : null;
  const href = (n: number | null) => (n === null ? '#' : `/calendario/editor?ano=${ano}${n === ultimo ? '' : `&revisao=${n}`}`);

  return (
    <>
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/calendario" className="text-if-verde-700 underline underline-offset-2">Calendário acadêmico</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Editor</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editor do calendário {ano}</h1>
          <p className="mt-1 max-w-3xl text-slate-700">
            Clique num dia, use <kbd className="rounded border border-slate-400 px-1">Shift</kbd>+clique para marcar um intervalo e <kbd className="rounded border border-slate-400 px-1">Ctrl</kbd>+clique para marcar ou desmarcar dias soltos. Depois escolha a categoria.
            Sábados e domingos já vêm sem aula; marque como letivo só quando for o caso.
          </p>
        </div>
        <nav aria-label="Ano" className="flex items-center gap-3 text-sm">
          <Link href={`/calendario/editor?ano=${ano - 1}`} className="text-if-verde-700 underline underline-offset-2">← {ano - 1}</Link>
          <Link href={`/calendario/editor?ano=${ano + 1}`} className="text-if-verde-700 underline underline-offset-2">{ano + 1} →</Link>
        </nav>
      </div>

      {sp.aviso && AVISOS[sp.aviso] && (
        <div className="mt-4">
          <Alerta tipo={sp.aviso === 'restaurado' || sp.aviso === 'criado' ? 'sucesso' : 'erro'}>{AVISOS[sp.aviso]}</Alerta>
        </div>
      )}

      {podeCriarDoAnterior && (
        <section aria-labelledby="novo-ano" className="mt-4 rounded-lg border border-if-verde-700 bg-if-verde-50 p-4">
          <h2 id="novo-ano" className="text-lg font-bold text-slate-900">Começar o calendário de {ano}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-800">
            Copia de {ano - 1} as etapas, os semestres, as férias e recessos, os encontros pedagógicos e as avaliações finais, nas mesmas semanas,
            e já marca os feriados nacionais de {ano}. Sábados e domingos letivos e suspensões não são copiados. Depois é só ajustar aqui no editor; tudo fica no histórico.
          </p>
          <form action={criarAnoAPartirDoAnterior} className="mt-3">
            <input type="hidden" name="ano" value={ano} />
            <button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
              Criar {ano} a partir de {ano - 1}
            </button>
          </form>
        </section>
      )}

      <section aria-labelledby="historico" className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 id="historico" className="text-lg font-bold text-slate-900">Histórico</h2>
        {numeros.length === 0 ? (
          <p className="mt-1 text-sm text-slate-700">O histórico começa na primeira alteração do calendário.</p>
        ) : (
          <>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm" role="status">
              <span className="font-semibold text-slate-900">{antiga ? `Revisão ${antiga.numero} de ${numeros.length} (somente leitura)` : `Calendário atual: revisão ${ultimo} de ${numeros.length}`}</span>
              {anterior !== null ? <Link href={href(anterior)} className="text-if-verde-700 underline underline-offset-2">◀ Revisão anterior ({anterior})</Link> : <span className="text-slate-500">◀ Revisão anterior</span>}
              {seguinte !== null ? <Link href={href(seguinte)} className="text-if-verde-700 underline underline-offset-2">Revisão seguinte ({seguinte}) ▶</Link> : <span className="text-slate-500">Revisão seguinte ▶</span>}
              {antiga && <Link href={`/calendario/editor?ano=${ano}`} className="font-semibold text-if-verde-700 underline underline-offset-2">Voltar ao calendário atual</Link>}
            </p>
            {antiga && (
              <div className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-slate-900">
                <p>
                  Você está vendo o calendário como ficou em {quando(antiga.createdAt)}
                  {antiga.autor ? `, por ${antiga.autor.nome}` : ''}. {antiga.resumo}
                  {antiga.motivo ? ` Motivo: ${antiga.motivo}.` : ''}
                </p>
                {podeEditar && (
                  <form action={restaurarRevisaoDoCalendario} className="mt-2 flex flex-wrap items-center gap-3">
                    <input type="hidden" name="ano" value={ano} />
                    <input type="hidden" name="numero" value={antiga.numero} />
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="confirmo" className="h-5 w-5" />
                      Quero restaurar esta revisão como o calendário vigente
                    </label>
                    <button type="submit" className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
                      Restaurar esta revisão
                    </button>
                  </form>
                )}
              </div>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">Lista de revisões ({numeros.length})</summary>
              <ol className="mt-2 space-y-1 text-sm">
                {revisoes.map((r) => (
                  <li key={r.numero}>
                    <Link href={href(r.numero)} aria-current={r.numero === mostrada ? 'true' : undefined} className={`underline underline-offset-2 ${r.numero === mostrada ? 'font-bold text-slate-900' : 'text-if-verde-700'}`}>
                      Revisão {r.numero}
                    </Link>{' '}
                    <span className="text-slate-700">
                      · {quando(r.createdAt)} · {NOME_ORIGEM[r.origem] ?? r.origem}
                      {r.autor ? ` · ${r.autor.nome}` : ''} · {r.resumo}
                      {r.motivo ? ` (${r.motivo})` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          </>
        )}
      </section>

      <EditorCalendario key={`${ano}-${mostrada}-${ultimo}`} ano={ano} instantaneo={instantaneo} baseNumero={ultimo} somenteLeitura={!podeEditar || antiga !== null} motivosSuspensao={[...MOTIVOS_SUSPENSAO]} />
    </>
  );
}
