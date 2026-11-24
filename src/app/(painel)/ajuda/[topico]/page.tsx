import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth/dal';
import { topicoDoPerfil, topicosDoPerfil } from '@/lib/ajuda/acesso';
import { TOPICOS, topicoPorId } from '@/lib/ajuda/topicos';
import { ConteudoTopico, LinksRelacionados } from '../componentes';

export function generateStaticParams() {
  return TOPICOS.map((t) => ({ topico: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ topico: string }> }): Promise<Metadata> {
  const t = topicoPorId((await params).topico);
  return { title: `${t?.titulo ?? 'Ajuda'} — Ajuda — SGC-Redes` };
}

export default async function PaginaTopico({ params }: { params: Promise<{ topico: string }> }) {
  const { usuario } = await exigirUsuario();
  const t = topicoPorId((await params).topico);
  if (!t) notFound();
  const disponivel = topicoDoPerfil(t, usuario.role);
  // "Veja também" mostra todos os tópicos relacionados; os de outros perfis são lidos como referência.
  const visiveis = new Set(TOPICOS.map((x) => x.id));
  return (
    <article className="max-w-4xl">
      <nav aria-label="Trilha" className="text-sm print:hidden">
        <Link href="/ajuda" className="text-if-verde-700 underline underline-offset-2">
          Ajuda
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">
          {t.titulo}
        </span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{t.titulo}</h1>
      <p className="mt-1 text-slate-700">{t.resumo}</p>
      <div className="mt-3 flex flex-wrap gap-3 print:hidden">
        {t.rota && disponivel && (
          <Link href={t.rota} className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
            Abrir {t.titulo.split(':')[0].toLowerCase()}
          </Link>
        )}
        {!disponivel && <p className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800">Este recurso não está disponível para o seu perfil; o texto fica como referência.</p>}
      </div>
      <ConteudoTopico t={t} />
      <LinksRelacionados ids={t.relacionados} visiveis={visiveis} />
      {topicosDoPerfil(usuario.role).length > 1 && (
        <p className="mt-6 text-sm print:hidden">
          <Link href="/ajuda" className="text-if-verde-700 underline underline-offset-2">
            ← Todos os tópicos da Ajuda
          </Link>
        </p>
      )}
    </article>
  );
}
