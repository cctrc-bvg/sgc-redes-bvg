import type { Metadata } from 'next';
import { LinkExportar } from '@/components/barra-impressao';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { NOME_CANAL } from '@/lib/ausencias/mensagens';
import { configuracaoEvolution } from '@/lib/comunicacao/evolution';
import { NOME_MODO } from '@/lib/comunicacao/mensagem';
import { carregarModelos, opcoesDeDestino, opcoesDosCampos } from '@/lib/comunicacao/servidor';
import { FormularioAvulsa } from './formulario-avulsa';
import { FormularioCanal } from './formulario-envio';

export const metadata: Metadata = { title: 'Comunicação — SGC-Redes' };

const dataHora = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }).format(d);

export default async function PaginaComunicacao() {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const [canais, historico, destinos] = await Promise.all([
    prisma.configuracaoCanal.findMany({ orderBy: { canal: 'asc' } }),
    prisma.logComunicacao.findMany({ orderBy: { enviadoEm: 'desc' }, take: 50 }),
    opcoesDeDestino(),
  ]);
  const [modelos, opcoesCampos] = await Promise.all([carregarModelos(), opcoesDosCampos()]);
  const automatico = configuracaoEvolution() !== null;
  const mostrarWhatsapp = usuario.usaWhatsapp;

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Comunicação</h1>
      <p className="mt-1 text-slate-700">
        O sistema gera as mensagens e você encaminha pelo <strong>e-mail institucional</strong>
        {mostrarWhatsapp ? ' ou pelo WhatsApp' : ''} (modo semiautomático, RF05/G07). As mensagens de cada ausência ficam na página da
        ausência; aqui ficam a mensagem avulsa, o histórico e os contatos dos grupos e setores.
      </p>
      <p className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800">
        {!mostrarWhatsapp ? (
          <>
            <span aria-hidden="true">ℹ </span>Você escolheu <strong>não usar o WhatsApp</strong> no sistema: só aparecem as opções de e-mail e
            de copiar o texto. Mude em Minha conta → Contato.
          </>
        ) : automatico ? (
          <>
            <span aria-hidden="true">✔ </span>Envio automático pelo WhatsApp <strong>ligado</strong> (Evolution API) para canais com destino
            cadastrado. O e-mail e a cópia do texto continuam disponíveis.
          </>
        ) : (
          <>
            <span aria-hidden="true">ℹ </span>Modo <strong>semiautomático</strong>: abra o texto no e-mail ou no WhatsApp Web (ou copie e cole)
            e registre o envio. Nenhuma integração com o WhatsApp é necessária.
          </>
        )}
      </p>

      <section aria-labelledby="avulsa" className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="avulsa" className="text-lg font-semibold text-slate-900">Mensagem avulsa</h2>
        <p className="mb-4 mt-1 text-sm text-slate-700">
          Para grupos, setores, grupos de docentes (todos, por turma ou por ano) ou pessoas. Gera uma mensagem por destinatário, com o
          e-mail e a saudação do cadastro. <a href="/comunicacao/modelos" className="text-if-verde-700 underline underline-offset-2">Editar textos-padrão</a>.
        </p>
        <FormularioAvulsa
          modelos={modelos}
          canais={destinos.canais}
          docentes={destinos.docentes}
          usuarios={destinos.usuarios}
          opcoes={opcoesCampos}
          mostrarWhatsapp={mostrarWhatsapp}
        />
      </section>

      <section aria-labelledby="historico" className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="historico" className="text-lg font-semibold text-slate-900">Histórico de envios (últimos 50)</h2>
          <LinkExportar href="/exportar/comunicacao">Exportar histórico do ano</LinkExportar>
        </div>
        {historico.length === 0 ? (
          <p className="mt-2 text-slate-700">Nenhuma mensagem enviada ainda.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {historico.map((h) => (
              <li key={h.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-semibold text-slate-900">
                  {h.canal ? NOME_CANAL[h.canal] : (h.destino ?? 'Mensagem individual')} · {dataHora(h.enviadoEm)} · {NOME_MODO[h.modoEnvio] ?? h.modoEnvio} ·{' '}
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
                {h.assunto && <p className="mt-1 text-sm text-slate-700">Assunto: {h.assunto}</p>}
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
        <h2 id="canais" className="text-lg font-semibold text-slate-900">Grupos e setores</h2>
        <p className="mt-1 text-sm text-slate-700">
          E-mail institucional e saudação usados nas mensagens prontas. Os grupos de docentes (todos, por turma e por ano) são montados
          sozinhos pelas ofertas do ano e aparecem na mensagem avulsa.
        </p>
        <ul className="mt-3 space-y-4">
          {canais.map((c) => (
            <li key={c.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-semibold text-slate-900">{NOME_CANAL[c.canal]}</h3>
              <FormularioCanal
                canalId={c.id}
                titulo={NOME_CANAL[c.canal]}
                nomeExibicao={c.nomeExibicao}
                email={c.email ?? ''}
                saudacao={c.saudacao ?? ''}
                destinoId={c.destinoId ?? ''}
                ativo={c.ativo}
                comApi={automatico}
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
