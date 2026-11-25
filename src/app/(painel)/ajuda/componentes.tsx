import Link from 'next/link';
import { TOPICOS, type EtapaFluxo, type TopicoAjuda } from '@/lib/ajuda/topicos';
import { tipoDeAtor, type TipoAtor } from '@/lib/ajuda/atores';

/** Cor da caixa por quem faz a etapa (com o nome escrito: a cor só ajuda a bater o olho). */
const COR_ATOR: Record<TipoAtor, { caixa: string; titulo: string; numero: string }> = {
  gestao: { caixa: 'border-if-verde-700 bg-if-verde-50', titulo: 'text-if-verde-800', numero: 'bg-if-verde-700' },
  docencia: { caixa: 'border-docencia-700 bg-docencia-50', titulo: 'text-docencia-800', numero: 'bg-docencia-700' },
  sistema: { caixa: 'border-slate-400 bg-slate-50', titulo: 'text-slate-800', numero: 'bg-slate-600' },
  setor: { caixa: 'border-amber-600 bg-amber-50', titulo: 'text-amber-900', numero: 'bg-amber-700' },
  todos: { caixa: 'border-slate-400 bg-white', titulo: 'text-slate-800', numero: 'bg-slate-600' },
};

/** Fluxograma acessível: lista ordenada desenhada como caixas ligadas por setas (funciona impresso e sem JS). */
export function Fluxograma({ titulo, etapas }: { titulo: string; etapas: readonly EtapaFluxo[] }) {
  return (
    <figure className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:shadow-none">
      <figcaption className="font-semibold text-slate-900">Fluxo: {titulo}</figcaption>
      <p className="mt-1 text-xs text-slate-600">Cor de cada etapa: verde, Coordenação e gestão; azul, docência; âmbar, setores; cinza, o próprio sistema.</p>
      <ol className="mt-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-stretch">
        {etapas.map((e, i) => {
          const cor = COR_ATOR[tipoDeAtor(e.ator)];
          return (
            <li key={e.rotulo} className="flex flex-col md:flex-row md:items-center">
              <div className={`flex-1 rounded-md border-2 px-3 py-2 md:w-44 ${cor.caixa}`}>
                <p className={`text-sm font-semibold ${cor.titulo}`}>
                  <span
                    className={`mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${cor.numero}`}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  {e.rotulo}
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{e.ator}</p>
                {e.detalhe && <p className="text-xs text-slate-700">{e.detalhe}</p>}
                {e.onde && (
                  <p className="mt-1 text-xs text-slate-700">
                    <span className="font-semibold">Onde:</span>{' '}
                    {e.onde.rota ? (
                      <Link href={e.onde.rota} className="text-if-verde-700 underline underline-offset-2 print:no-underline">
                        {e.onde.tela}
                      </Link>
                    ) : (
                      e.onde.tela
                    )}
                  </p>
                )}
              </div>
              {i < etapas.length - 1 && (
                <span aria-hidden="true" className="self-center px-2 text-xl text-if-verde-700">
                  <span className="md:hidden">↓</span>
                  <span className="hidden md:inline">→</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/** Conteúdo completo de um tópico (página do tópico e manual para impressão). */
export function ConteudoTopico({ t, nivel = 2 }: { t: TopicoAjuda; nivel?: 2 | 3 }) {
  const H = nivel === 2 ? 'h2' : 'h3';
  const Sub = nivel === 2 ? 'h3' : 'h4';
  const classeH = 'mt-8 text-lg font-semibold text-slate-900';
  return (
    <>
      <H className={classeH}>O que você pode fazer</H>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-slate-800">
        {t.capacidades.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      {t.diagrama && (
        <div className="mt-6">
          <Fluxograma titulo={t.diagrama.titulo} etapas={t.diagrama.etapas} />
        </div>
      )}

      <H className={classeH}>Passo a passo</H>
      <div className="mt-2 space-y-4">
        {t.fluxos.map((f) => (
          <section key={f.titulo} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:shadow-none">
            <Sub className="font-semibold text-slate-900">
              {f.titulo} <span className="text-sm font-normal text-slate-600">· {f.quem}</span>
            </Sub>
            <ol className="mt-2 list-decimal space-y-1 pl-6 text-slate-800">
              {f.passos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {t.imagens.length > 0 && (
        <>
          <H className={classeH}>Telas</H>
          <div className="mt-2 space-y-6">
            {t.imagens.map((img) => (
              <figure key={img.arquivo} className="print:break-inside-avoid">
                {/* Capturas geradas com dados fictícios (npm run capturas). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/manual/${img.arquivo}`}
                  alt={img.alt}
                  width={1280}
                  height={800}
                  loading="lazy"
                  className="h-auto w-full rounded-lg border border-slate-300 shadow-sm"
                />
                <figcaption className="mt-1 text-sm text-slate-700">{img.legenda}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {t.duvidas.length > 0 && (
        <>
          <H className={classeH}>Dúvidas frequentes</H>
          <dl className="mt-2 space-y-3">
            {t.duvidas.map((d) => (
              <div key={d.pergunta}>
                <dt className="font-semibold text-slate-900">{d.pergunta}</dt>
                <dd className="text-slate-800">{d.resposta}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </>
  );
}

export function LinksRelacionados({ ids, visiveis }: { ids: readonly string[]; visiveis: ReadonlySet<string> }) {
  const lista = ids.map((id) => TOPICOS.find((t) => t.id === id)).filter((t): t is TopicoAjuda => !!t && visiveis.has(t.id));
  if (lista.length === 0) return null;
  return (
    <nav aria-label="Tópicos relacionados" className="mt-8 border-t border-slate-200 pt-4 print:hidden">
      <h2 className="font-semibold text-slate-900">Veja também</h2>
      <ul className="mt-2 flex flex-wrap gap-3">
        {lista.map((t) => (
          <li key={t.id}>
            <Link href={`/ajuda/${t.id}`} className="text-if-verde-700 underline underline-offset-2">
              {t.titulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
