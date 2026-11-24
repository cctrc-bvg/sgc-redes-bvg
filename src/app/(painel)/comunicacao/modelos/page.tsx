import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/campo';
import { NOME_CANAL } from '@/lib/ausencias/mensagens';
import { exigirPermissao } from '@/lib/auth/dal';
import { camposPendentes } from '@/lib/comunicacao/mensagem';
import { modelosDoTipo, NOME_TIPO_INTERACAO, TIPOS_INTERACAO } from '@/lib/comunicacao/modelos';
import { carregarModelos } from '@/lib/comunicacao/servidor';
import { restaurarModelos } from './actions';

export const metadata: Metadata = { title: 'Textos-padrão — SGC-Redes' };

const AVISOS: Record<string, string> = { criado: 'Texto-padrão criado.', removido: 'Texto-padrão removido.' };

export default async function PaginaModelos({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirPermissao('comunicacao:enviar');
  const { aviso } = await searchParams;
  const modelos = await carregarModelos();
  const restaurados = aviso?.startsWith('restaurados-') ? Number(aviso.slice(12)) : null;

  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/comunicacao" className="text-if-verde-700 underline underline-offset-2">
          Comunicação
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Textos-padrão</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Textos-padrão</h1>
      <p className="mt-1 text-slate-700">
        Modelos que aparecem no campo &quot;Texto-padrão&quot; das mensagens, por tipo de interação. Campos entre {'{{ }}'} são substituídos pelo
        sistema ou preenchidos na tela.
      </p>
      {aviso && AVISOS[aviso] && (
        <div className="mt-4">
          <Alerta tipo="sucesso">{AVISOS[aviso]}</Alerta>
        </div>
      )}
      {restaurados !== null && (
        <div className="mt-4">
          <Alerta tipo={restaurados > 0 ? 'sucesso' : 'info'}>
            {restaurados > 0 ? `${restaurados} texto(s)-padrão original(is) restaurado(s).` : 'Todos os textos-padrão originais já existem.'}
          </Alerta>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/comunicacao/modelos/novo" className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800">
          Novo texto-padrão
        </Link>
        <form action={restaurarModelos}>
          <button type="submit" className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
            Restaurar originais removidos
          </button>
        </form>
      </div>

      {TIPOS_INTERACAO.map((t) => {
        const lista = modelosDoTipo(t, modelos);
        return (
          <section key={t} className="mt-6" aria-labelledby={`tipo-${t}`}>
            <h2 id={`tipo-${t}`} className="text-lg font-semibold text-slate-900">
              {NOME_TIPO_INTERACAO[t]}
            </h2>
            {lista.length === 0 ? (
              <p className="mt-1 text-sm text-slate-700">Nenhum texto-padrão: as mensagens usam só o texto gerado pelo sistema.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {lista.map((m) => (
                  <li key={m.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="font-semibold text-slate-900">
                      <Link href={`/comunicacao/modelos/${m.id}`} className="text-if-verde-700 underline underline-offset-2">
                        {m.rotulo}
                      </Link>
                    </p>
                    <p className="mt-1 text-sm text-slate-700">Assunto: {m.assunto}</p>
                    <p className="mt-1 text-sm text-slate-700">
                      Campos: {camposPendentes(m.assunto, m.texto).map((c) => `{{${c}}}`).join(', ') || 'nenhum'}
                      {m.destinos.length > 0 ? ` · Sugere: ${m.destinos.map((d) => NOME_CANAL[d]).join(', ')}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
