import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataDoBanco, formatarData, hojeEmFortaleza } from '@/lib/ausencias/regras';
import { formatarHoras, NOME_GRUPO_ROMANO } from '@/lib/ppi/regras';

export const metadata: Metadata = { title: 'Ficha de PPI — SGC-Redes' };

/** Ficha "SOLICITAÇÃO DE PRÁTICA PROFISSIONAL INTEGRADA (PPI)" para imprimir e assinar (RF07). */
export default async function PaginaFichaPpi({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao('ppi:ver');
  const { id } = await params;
  const s = await prisma.ppiSolicitacao.findUnique({
    where: { id },
    include: { atividades: { where: { aprovada: true }, include: { regra: true }, orderBy: [{ regra: { grupo: 'asc' } }, { dataRealizacao: 'asc' }] } },
  });
  if (!s) notFound();

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-slate-900 print:p-0">
      <p className="mb-4 text-sm print:hidden">
        <Link href={`/ppi/${s.id}`} className="text-if-verde-700 underline underline-offset-2">
          ← Voltar à solicitação
        </Link>{' '}
        · Use a impressão do navegador (Ctrl+P) para gerar o PDF ou o papel.
      </p>
      <header className="text-center">
        <p className="text-sm font-semibold">INSTITUTO FEDERAL DO CEARÁ — CAMPUS BOA VIAGEM</p>
        <p className="text-sm">Curso Técnico Integrado em Redes de Computadores</p>
        <h1 className="mt-3 text-lg font-bold">SOLICITAÇÃO DE PRÁTICA PROFISSIONAL INTEGRADA (PPI)</h1>
      </header>
      <dl className="mt-6 grid grid-cols-2 gap-2 text-sm">
        <div className="col-span-2">
          <dt className="inline font-semibold">Estudante: </dt>
          <dd className="inline">{s.nomeEstudante}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Matrícula: </dt>
          <dd className="inline">{s.matricula}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Turma: </dt>
          <dd className="inline">{s.turmaAtual}</dd>
        </div>
      </dl>
      <table className="mt-6 w-full border-collapse text-left text-xs">
        <caption className="sr-only">Atividades validadas</caption>
        <thead>
          <tr>
            <th scope="col" className="border border-slate-400 px-2 py-1">Grupo</th>
            <th scope="col" className="border border-slate-400 px-2 py-1">Atividade / comprovante</th>
            <th scope="col" className="border border-slate-400 px-2 py-1">Certificado</th>
            <th scope="col" className="border border-slate-400 px-2 py-1">Data</th>
            <th scope="col" className="border border-slate-400 px-2 py-1 text-right">Horas</th>
          </tr>
        </thead>
        <tbody>
          {s.atividades.map((a) => (
            <tr key={a.id}>
              <td className="border border-slate-400 px-2 py-1">{NOME_GRUPO_ROMANO[a.regra.grupo]}</td>
              <td className="border border-slate-400 px-2 py-1">
                {a.regra.descricao}
                <span className="block text-slate-700">{a.descricaoComprovante}</span>
              </td>
              <td className="border border-slate-400 px-2 py-1">{a.codigoCertificado}</td>
              <td className="border border-slate-400 px-2 py-1">{formatarData(dataDoBanco(a.dataRealizacao))}</td>
              <td className="border border-slate-400 px-2 py-1 text-right tabular-nums">{formatarHoras(a.horasCalculadas)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={4} className="border border-slate-400 px-2 py-1 text-right">
              Total validado (meta {s.metaHoras}h)
            </th>
            <td className="border border-slate-400 px-2 py-1 text-right font-bold tabular-nums">{formatarHoras(s.totalValidado)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-6 text-sm">Boa Viagem (CE), {formatarData(hojeEmFortaleza())}.</p>
      <div className="mt-12 grid grid-cols-3 gap-6 text-center text-xs">
        {['Estudante', 'Coordenação do Curso', 'Direção de Ensino'].map((papel) => (
          <div key={papel}>
            <div className="border-t border-slate-700 pt-1">{papel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
