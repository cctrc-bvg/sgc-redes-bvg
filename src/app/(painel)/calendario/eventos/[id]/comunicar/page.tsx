import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alerta } from '@/components/campo';
import { CaixaMensagem } from '@/components/caixa-mensagem';
import { exigirPermissao } from '@/lib/auth/dal';
import { mensagensDoEvento } from '@/lib/calendario/comunicar';
import { periodoDoEvento } from '@/lib/calendario/mensagens';
import { NOME_TIPO_EVENTO } from '@/lib/calendario/regras';
import { NOME_MODO } from '@/lib/comunicacao/mensagem';
import { carregarModelos } from '@/lib/comunicacao/servidor';
import { prisma } from '@/lib/db';
import { FormularioEnvioEvento } from './formulario';

export const metadata: Metadata = { title: 'Comunicar alteração do calendário — SGC-Redes' };

const AVISOS: Record<string, string> = {
  criado: 'Evento cadastrado no calendário.',
  editado: 'Evento atualizado no calendário.',
};

/** Mensagens prontas de uma alteração do calendário para docentes, CAE, nutricionista, Gestão, CTP e turmas. */
export default async function PaginaComunicarEvento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const [dados, modelos, enviados] = await Promise.all([
    mensagensDoEvento(id),
    carregarModelos(),
    prisma.logComunicacao.findMany({ where: { chave: { startsWith: 'calendario:', endsWith: `:${id}` }, sucesso: true }, orderBy: { enviadoEm: 'desc' } }),
  ]);
  if (!dados) notFound();
  const { evento, mensagens } = dados;
  const ultimo = new Map<string, (typeof enviados)[number]>();
  for (const e of enviados) if (e.chave && !ultimo.has(e.chave)) ultimo.set(e.chave, e);
  const hora = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }).format(d);
  const ano = evento.inicio.slice(0, 4);

  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/calendario?ano=${ano}&mes=${Number(evento.inicio.slice(5, 7))}`} className="text-if-verde-700 underline underline-offset-2">
          Calendário {ano}
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Comunicar alteração</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Comunicar: {NOME_TIPO_EVENTO[evento.tipo]}
        {evento.descricao ? ` — ${evento.descricao}` : ''}
      </h1>
      <p className="mt-1 text-slate-700">
        {periodoDoEvento(evento)} · {evento.suspendeAulas ? 'sem aulas' : 'aulas mantidas'}
        {evento.imprevisto ? ' · alteração não prevista (dias a repor)' : ''}
        {evento.motivo ? ` · ${evento.motivo}` : ''}
      </p>
      {aviso && AVISOS[aviso] && (
        <div className="mt-4">
          <Alerta tipo="sucesso">{AVISOS[aviso]} Agora avise quem precisa saber: as mensagens abaixo já estão prontas.</Alerta>
        </div>
      )}
      <p className="mt-3 text-slate-700">
        Envie por e-mail{usuario.usaWhatsapp ? ' ou WhatsApp' : ''} e registre cada envio. E-mails e saudações dos grupos ficam em{' '}
        <Link href="/comunicacao" className="text-if-verde-700 underline underline-offset-2">
          Comunicação
        </Link>
        ; os docentes vêm do cadastro de usuários.{' '}
        {usuario.role === 'COORDENADOR' && (
          <Link href={`/calendario/eventos/${id}`} className="text-if-verde-700 underline underline-offset-2">
            Editar o evento
          </Link>
        )}
      </p>
      {mensagens.length === 0 ? (
        <p className="mt-6 text-slate-700">Nenhum destinatário ativo: cadastre os grupos em Comunicação.</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {mensagens.map((m) => {
            const e = ultimo.get(`${m.chave}:${id}`);
            return (
              <li key={m.chave}>
                <CaixaMensagem mensagem={m} mostrarWhatsapp={usuario.usaWhatsapp} modelos={modelos}>
                  {e && (
                    <p className="text-sm text-if-verde-800">
                      <span aria-hidden="true">✔ </span>Envio registrado ({NOME_MODO[e.modoEnvio] ?? e.modoEnvio}, {hora(e.enviadoEm)}).
                    </p>
                  )}
                  <FormularioEnvioEvento eventoId={id} chave={m.chave} mostrarWhatsapp={usuario.usaWhatsapp} />
                </CaixaMensagem>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
