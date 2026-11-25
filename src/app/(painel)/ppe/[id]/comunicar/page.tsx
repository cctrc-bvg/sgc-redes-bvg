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
import { chaveEnvioPpe, mensagensDaPpe } from '@/lib/ppe/comunicar';
import { NOME_SITUACAO_PPE } from '@/lib/ppe/mensagens';
import { NOME_MODALIDADE, NOME_STATUS_PPE } from '@/lib/ppe/regras';
import { registrarEnvioPpe } from '../../actions';

export const metadata: Metadata = { title: 'Comunicar PPE — SGC-Redes' };

const DESTINATARIOS: Record<string, string> = {
  definir: 'o docente da disciplina, para definir a modalidade',
  modalidade: 'o estudante e a CTP',
  pei: 'o estudante e a CTP, com o cronograma de encontros',
  prorrogacao: 'o estudante e a CTP, com o novo prazo (Art. 124)',
  resultado: 'o estudante e a CTP',
};

/** Mensagens prontas do momento atual da PPE: pedir a modalidade, modalidade definida, PEI pronto ou resultado. */
export default async function PaginaComunicarPpe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const dados = await mensagensDaPpe(id);
  if (!dados) notFound();
  const { ppe, situacao, mensagens } = dados;
  const [modelos, enviados] = await Promise.all([
    carregarModelos(),
    prisma.logComunicacao.findMany({ where: { chave: { startsWith: `ppe:${situacao}:`, endsWith: `:${id}` }, sucesso: true }, orderBy: { enviadoEm: 'desc' } }),
  ]);
  const ultimo = new Map<string, (typeof enviados)[number]>();
  for (const e of enviados) if (e.chave && !ultimo.has(e.chave)) ultimo.set(e.chave, e);
  const hora = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }).format(d);

  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/ppe?semestre=${ppe.semestre}`} className="text-if-verde-700 underline underline-offset-2">
          PPE / PEI
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <Link href={`/ppe/${id}`} className="text-if-verde-700 underline underline-offset-2">
          {ppe.disciplina}
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Comunicar</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Comunicar: {NOME_SITUACAO_PPE[situacao]}</h1>
      <p className="mt-1 text-slate-700">
        {ppe.disciplina} — {ppe.nomeEstudante} · {ppe.semestre} · {NOME_MODALIDADE[ppe.modalidade]} · {NOME_STATUS_PPE[ppe.status]}
      </p>
      <p className="mt-3 text-slate-700">
        Mensagens para {DESTINATARIOS[situacao]}. O estudante não tem cadastro no sistema: digite o e-mail dele na caixa ou escolha o
        contato no WhatsApp. Envie e registre cada envio.
      </p>
      {aviso === 'prorrogado' && (
        <div className="mt-4">
          <Alerta tipo="sucesso">Prazo prorrogado. Agora avise o estudante e a CTP: as mensagens abaixo já estão prontas.</Alerta>
        </div>
      )}
      {mensagens.length === 0 ? (
        <p className="mt-6 text-slate-700">
          Nenhum destinatário ativo: confira o docente nas{' '}
          <Link href="/ofertas" className="text-if-verde-700 underline underline-offset-2">
            ofertas
          </Link>{' '}
          e o grupo da CTP em{' '}
          <Link href="/comunicacao" className="text-if-verde-700 underline underline-offset-2">
            Comunicação
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 space-y-6">
          {mensagens.map((m) => {
            const e = ultimo.get(chaveEnvioPpe(situacao, m.chave, id));
            return (
              <li key={m.chave}>
                <CaixaMensagem mensagem={m} mostrarWhatsapp={usuario.usaWhatsapp} modelos={modelos}>
                  {e && (
                    <p className="text-sm text-if-verde-800">
                      <span aria-hidden="true">✔ </span>Envio registrado ({NOME_MODO[e.modoEnvio] ?? e.modoEnvio}, {hora(e.enviadoEm)}).
                    </p>
                  )}
                  <FormularioRegistroEnvio acao={registrarEnvioPpe} ocultos={{ id, situacao, chave: m.chave }} mostrarWhatsapp={usuario.usaWhatsapp} />
                </CaixaMensagem>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
