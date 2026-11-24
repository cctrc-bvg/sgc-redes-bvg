import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { NOME_CANAL } from '@/lib/ausencias/mensagens';
import { configuracaoEvolution } from '@/lib/comunicacao/evolution';
import { FormularioCanal } from './formulario-envio';

export const metadata: Metadata = { title: 'Comunicação — SGC-Redes' };

const MODO: Record<string, string> = { WHATSAPP_WEB_MANUAL: 'WhatsApp Web (manual)', WEBHOOK_AUTO: 'Automático (API)' };

const dataHora = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }).format(d);

export default async function PaginaComunicacao() {
  await exigirPermissao('comunicacao:enviar');
  const [canais, historico] = await Promise.all([
    prisma.configuracaoCanal.findMany({ orderBy: { canal: 'asc' } }),
    prisma.logComunicacao.findMany({ orderBy: { enviadoEm: 'desc' }, take: 50 }),
  ]);
  const automatico = configuracaoEvolution() !== null;

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Comunicação</h1>
      <p className="mt-1 text-slate-700">
        Mensagens padronizadas para os grupos de WhatsApp (RF05). As mensagens de cada ausência ficam na página da ausência.
      </p>
      <p className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800">
        {automatico ? (
          <>
            <span aria-hidden="true">✔ </span>Envio automático <strong>ligado</strong> (Evolution API): canais com destino cadastrado mostram
            &quot;Enviar automaticamente&quot;.
          </>
        ) : (
          <>
            <span aria-hidden="true">ℹ </span>Modo <strong>semiautomático</strong> (G07): o texto abre no WhatsApp Web e o envio é registrado aqui.
            O envio automático liga quando o servidor tiver EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCIA.
          </>
        )}
      </p>

      <section aria-labelledby="historico" className="mt-8">
        <h2 id="historico" className="text-lg font-semibold text-slate-900">Histórico de envios (últimos 50)</h2>
        {historico.length === 0 ? (
          <p className="mt-2 text-slate-700">Nenhuma mensagem enviada ainda.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {historico.map((h) => (
              <li key={h.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-semibold text-slate-900">
                  {NOME_CANAL[h.canal]} · {dataHora(h.enviadoEm)} · {MODO[h.modoEnvio] ?? h.modoEnvio} ·{' '}
                  {h.sucesso ? (
                    <span className="text-if-verde-800">
                      <span aria-hidden="true">✔ </span>enviado
                    </span>
                  ) : (
                    <span className="text-if-vermelho-700">
                      <span aria-hidden="true">✖ </span>falhou
                    </span>
                  )}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-if-verde-700 underline underline-offset-2">Ver mensagem</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 font-sans text-sm text-slate-800">{h.mensagem}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="canais" className="mt-8">
        <h2 id="canais" className="text-lg font-semibold text-slate-900">Canais</h2>
        <ul className="mt-3 space-y-4">
          {canais.map((c) => (
            <li key={c.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-semibold text-slate-900">{NOME_CANAL[c.canal]}</h3>
              <FormularioCanal canalId={c.id} titulo={NOME_CANAL[c.canal]} nomeExibicao={c.nomeExibicao} destinoId={c.destinoId ?? ''} ativo={c.ativo} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
