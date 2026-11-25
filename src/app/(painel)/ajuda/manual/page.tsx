import type { Metadata } from 'next';
import { BarraImpressao } from '@/components/barra-impressao';
import { exigirUsuario } from '@/lib/auth/dal';
import { topicoDoPerfil } from '@/lib/ajuda/acesso';
import { TOPICOS } from '@/lib/ajuda/topicos';
import { ConteudoTopico } from '../componentes';

export const metadata: Metadata = { title: 'Manual do usuário — SGC-Redes' };

/** Manual completo numa página, para imprimir ou salvar em PDF (?perfil=1 limita ao perfil de quem lê). */
export default async function PaginaManual({ searchParams }: { searchParams: Promise<{ perfil?: string }> }) {
  const { usuario } = await exigirUsuario();
  const soPerfil = (await searchParams).perfil === '1';
  const lista = TOPICOS.filter((t) => !soPerfil || topicoDoPerfil(t, usuario));
  return (
    <div className="bg-white p-4 text-slate-900 print:p-0">
      <BarraImpressao voltar="/ajuda" rotulo="Voltar à Ajuda" />
      <header className="text-center">
        <p className="font-semibold">INSTITUTO FEDERAL DO CEARÁ — CAMPUS BOA VIAGEM</p>
        <p>Curso Técnico Integrado em Redes de Computadores</p>
        <h1 className="mt-2 text-xl font-bold">SGC-Redes — Manual do usuário</h1>
      </header>
      <nav aria-label="Sumário" className="mt-6">
        <h2 className="font-semibold">Sumário</h2>
        <ol className="mt-1 list-decimal pl-6">
          {lista.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="text-if-verde-700 underline underline-offset-2">
                {t.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {lista.map((t, i) => (
        <section key={t.id} id={t.id} aria-labelledby={`titulo-${t.id}`} className="mt-10 print:break-before-page">
          <h2 id={`titulo-${t.id}`} className="text-xl font-bold">
            {i + 1}. {t.titulo}
          </h2>
          <p className="mt-1 text-slate-700">{t.resumo}</p>
          <ConteudoTopico t={t} nivel={3} />
        </section>
      ))}
    </div>
  );
}
