import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/campo';
import { CaixaMensagem } from '@/components/caixa-mensagem';
import { exigirPermissao } from '@/lib/auth/dal';
import { validarDataISO } from '@/lib/alimentacao-engine';
import { mensagensDoDia } from '@/lib/alimentacao/comunicar';
import { GATILHOS, lerGatilho } from '@/lib/alimentacao/mensagens';
import { formatarData, hojeEmFortaleza } from '@/lib/ausencias/regras';
import { carregarModelos } from '@/lib/comunicacao/servidor';
import { prisma } from '@/lib/db';
import { NOME_MODO } from '@/lib/comunicacao/mensagem';
import { FormularioEnvioDoDia } from './formulario';

export const metadata: Metadata = { title: 'Comunicar alimentação — SGC-Redes' };

const dataOuHoje = (v: string | undefined) => {
  try {
    validarDataISO(v ?? '');
    return v!;
  } catch {
    return hojeEmFortaleza();
  }
};

/** Depois de acrescentar, ajustar ou dar ciência: mensagens prontas para CAE, nutricionista, Gestão e turmas. */
export default async function PaginaComunicarAlimentacao({ searchParams }: { searchParams: Promise<{ data?: string; motivo?: string }> }) {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const { data: dataUrl, motivo } = await searchParams;
  const data = dataOuHoje(dataUrl);
  const gatilho = lerGatilho(motivo);
  const [{ mensagens }, modelos, enviados] = await Promise.all([
    mensagensDoDia(data, gatilho),
    carregarModelos(),
    prisma.logComunicacao.findMany({ where: { chave: { endsWith: `:${data}`, startsWith: 'alimentacao:' }, sucesso: true }, orderBy: { enviadoEm: 'desc' } }),
  ]);
  const ultimo = new Map<string, (typeof enviados)[number]>();
  for (const e of enviados) if (e.chave && !ultimo.has(e.chave)) ultimo.set(e.chave, e);
  const hora = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }).format(d);

  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/alimentacao?data=${data}`} className="text-if-verde-700 underline underline-offset-2">
          Alimentação
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Comunicar alterações</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Comunicar alterações de {formatarData(data)}</h1>
      {gatilho && (
        <div className="mt-4">
          <Alerta tipo="sucesso">{GATILHOS[gatilho]}. Agora avise quem precisa saber: as mensagens abaixo já estão prontas.</Alerta>
        </div>
      )}
      <p className="mt-3 text-slate-700">
        Resumo de todos os avisos ativos do dia para a Assistência Estudantil (CAE), a nutricionista, a Gestão (direções e coordenações) e as
        turmas. Envie por e-mail{usuario.usaWhatsapp ? ' ou WhatsApp' : ''} e registre. E-mails e saudações ficam em{' '}
        <Link href="/comunicacao" className="text-if-verde-700 underline underline-offset-2">
          Comunicação
        </Link>
        .
      </p>
      {mensagens.length === 0 ? (
        <p className="mt-6 text-slate-700">Nenhum aviso ativo nesta data: nada a comunicar.</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {mensagens.map((m) => {
            const e = ultimo.get(`${m.chave}:${data}`);
            return (
              <li key={m.chave}>
                <CaixaMensagem mensagem={m} mostrarWhatsapp={usuario.usaWhatsapp} modelos={modelos}>
                  {e && (
                    <p className="text-sm text-if-verde-800">
                      <span aria-hidden="true">✔ </span>Envio registrado ({NOME_MODO[e.modoEnvio] ?? e.modoEnvio}, {hora(e.enviadoEm)}). Se os avisos mudaram depois, envie de novo.
                    </p>
                  )}
                  <FormularioEnvioDoDia data={data} chave={m.chave} gatilho={gatilho ?? ''} mostrarWhatsapp={usuario.usaWhatsapp} />
                </CaixaMensagem>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
