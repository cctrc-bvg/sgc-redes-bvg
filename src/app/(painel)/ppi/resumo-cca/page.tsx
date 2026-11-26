import type { Metadata } from 'next';
import Link from 'next/link';
import { CaixaMensagem } from '@/components/caixa-mensagem';
import { FormularioRegistroEnvio } from '@/components/formulario-registro-envio';
import { exigirPermissao } from '@/lib/auth/dal';
import { NOME_MODO } from '@/lib/comunicacao/mensagem';
import { carregarModelos } from '@/lib/comunicacao/servidor';
import { prisma } from '@/lib/db';
import { mensagemResumoPpiCca } from '@/lib/ppi/comunicar';
import { registrarEnvioResumoCca } from '../actions';

export const metadata: Metadata = { title: 'Resumo da PPI para a CCA — SGC-Redes' };

/** Apanhado geral da PPI por turma para a CCA (secretaria escolar): só totais, sem nomes de estudantes. */
export default async function PaginaResumoCca() {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  await exigirPermissao('ppi:gerenciar');
  const [{ linhas, mensagem }, modelos, enviados] = await Promise.all([
    mensagemResumoPpiCca(),
    carregarModelos(),
    prisma.logComunicacao.findMany({ where: { chave: { startsWith: 'ppi-resumo:cca:' }, sucesso: true }, orderBy: { enviadoEm: 'desc' }, take: 1 }),
  ]);
  const ultimo = enviados[0];
  const hora = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }).format(d);

  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/ppi" className="text-if-verde-700 underline underline-offset-2">PPI</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Resumo para a CCA</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Resumo da PPI para a CCA</h1>
      <p className="mt-1 text-slate-700">
        A CCA (Coordenação de Controle Acadêmico, a secretaria escolar do curso) recebe o apanhado geral de cada turma: quantas solicitações foram deferidas,
        indeferidas ou estão em análise. Nomes e matrículas ficam só com a Coordenação e a CTP (minimização de dados).
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <caption className="sr-only">Solicitações de PPI por turma e situação</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Turma</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Deferidas</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Indeferidas</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Em análise</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-3 text-slate-700">Nenhuma solicitação de PPI registrada ainda.</td></tr>
            ) : (
              linhas.map((l) => (
                <tr key={l.turma}>
                  <th scope="row" className="px-4 py-3 font-normal">{l.turma}</th>
                  <td className="px-4 py-3 text-right tabular-nums">{l.deferidas}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.indeferidas}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.emAnalise}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-6">
        {mensagem ? (
          <CaixaMensagem mensagem={mensagem} mostrarWhatsapp={usuario.usaWhatsapp} modelos={modelos}>
            {ultimo && (
              <p className="text-sm text-if-verde-800">
                <span aria-hidden="true">✔ </span>Último envio registrado ({NOME_MODO[ultimo.modoEnvio] ?? ultimo.modoEnvio}, {hora(ultimo.enviadoEm)}). Os totais mudam com as decisões: envie de novo quando houver novidade.
              </p>
            )}
            <FormularioRegistroEnvio acao={registrarEnvioResumoCca} ocultos={{ origem: 'resumo-cca' }} mostrarWhatsapp={usuario.usaWhatsapp} />
          </CaixaMensagem>
        ) : (
          <p className="text-slate-700">O contato da CCA não está ativo: cadastre o e-mail em Comunicação para gerar a mensagem.</p>
        )}
      </div>
    </div>
  );
}

