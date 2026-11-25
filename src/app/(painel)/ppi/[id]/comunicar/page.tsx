import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alerta } from '@/components/campo';
import { CaixaMensagem } from '@/components/caixa-mensagem';
import { FormularioRegistroEnvio } from '@/components/formulario-registro-envio';
import { exigirPermissao } from '@/lib/auth/dal';
import { NOME_MODO } from '@/lib/comunicacao/mensagem';
import { carregarModelos } from '@/lib/comunicacao/servidor';
import { prisma } from '@/lib/db';
import { chaveEnvioPpi, mensagensDaPpi } from '@/lib/ppi/comunicar';
import { NOME_STATUS_PPI } from '@/lib/ppi/regras';
import { registrarEnvioPpi } from '../../actions';

export const metadata: Metadata = { title: 'Comunicar decisão da PPI — SGC-Redes' };

/** Mensagens prontas da decisão sobre a PPI, para o estudante e a CTP. */
export default async function PaginaComunicarPpi({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const dados = await mensagensDaPpi(id);
  if (!dados) notFound();
  const { solicitacao: s, mensagens } = dados;
  const [modelos, enviados] = await Promise.all([
    carregarModelos(),
    prisma.logComunicacao.findMany({ where: { chave: { startsWith: `ppi:${s.status}:`, endsWith: `:${id}` }, sucesso: true }, orderBy: { enviadoEm: 'desc' } }),
  ]);
  const ultimo = new Map<string, (typeof enviados)[number]>();
  for (const e of enviados) if (e.chave && !ultimo.has(e.chave)) ultimo.set(e.chave, e);
  const hora = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }).format(d);

  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/ppi" className="text-if-verde-700 underline underline-offset-2">PPI</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <Link href={`/ppi/${id}`} className="text-if-verde-700 underline underline-offset-2">{s.nomeEstudante}</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Comunicar</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Comunicar a decisão da PPI</h1>
      <p className="mt-1 text-slate-700">
        {s.nomeEstudante} · {s.turmaAtual} · <strong>{NOME_STATUS_PPI[s.status]}</strong>
      </p>
      {aviso === 'decidida' && (
        <div className="mt-4">
          <Alerta tipo="sucesso">Decisão registrada. Agora avise o estudante e a CTP: as mensagens abaixo já estão prontas.</Alerta>
        </div>
      )}
      {mensagens.length === 0 ? (
        <p className="mt-6 text-slate-700">
          {s.status === 'DEFERIDA' || s.status === 'INDEFERIDA' ? 'Nenhum destinatário ativo: cadastre a CTP em Comunicação.' : 'A solicitação ainda não foi decidida: não há o que comunicar.'}
        </p>
      ) : (
        <>
          <p className="mt-3 text-slate-700">
            O estudante não tem cadastro no sistema: digite o e-mail dele na caixa ou escolha o contato no WhatsApp. Registre cada envio.
          </p>
          <ul className="mt-6 space-y-6">
            {mensagens.map((m) => {
              const e = ultimo.get(chaveEnvioPpi(s.status, m.chave, id));
              return (
                <li key={m.chave}>
                  <CaixaMensagem mensagem={m} mostrarWhatsapp={usuario.usaWhatsapp} modelos={modelos}>
                    {e && (
                      <p className="text-sm text-if-verde-800">
                        <span aria-hidden="true">✔ </span>Envio registrado ({NOME_MODO[e.modoEnvio] ?? e.modoEnvio}, {hora(e.enviadoEm)}).
                      </p>
                    )}
                    <FormularioRegistroEnvio acao={registrarEnvioPpi} ocultos={{ id, situacao: s.status, chave: m.chave }} mostrarWhatsapp={usuario.usaWhatsapp} />
                  </CaixaMensagem>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
