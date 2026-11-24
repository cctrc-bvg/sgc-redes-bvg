import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataDoBanco, formatarData, hojeEmFortaleza } from '@/lib/ausencias/regras';
import { acessoAoPpe } from '@/lib/ppe/servidor';

export const metadata: Metadata = { title: 'PEI para impressão — SGC-Redes' };

/** PEI no modelo do Campus Boa Viagem (RF06): campos obrigatórios, cronograma e assinaturas. */
export default async function PaginaImprimirPei({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await exigirPermissao('ppe:ver');
  const { id } = await params;
  const ppe = await prisma.registroPPE.findUnique({
    where: { id },
    include: { disciplina: true, pei: { include: { encontros: { orderBy: { data: 'asc' } }, docente: { select: { nome: true } } } } },
  });
  if (!ppe?.pei || !(await acessoAoPpe(usuario, ppe)).ver) notFound();
  const pei = ppe.pei;
  const linha = (rotulo: string, valor: string) => (
    <div className="border border-slate-400 px-2 py-1">
      <dt className="text-xs font-semibold uppercase">{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-sm text-slate-900 print:p-0">
      <p className="mb-4 print:hidden">
        <Link href={`/ppe/${ppe.id}`} className="text-if-verde-700 underline underline-offset-2">
          ← Voltar à PPE
        </Link>{' '}
        · Use a impressão do navegador (Ctrl+P) para gerar o PDF ou o papel.
      </p>
      <header className="text-center">
        <p className="font-semibold">INSTITUTO FEDERAL DO CEARÁ — CAMPUS BOA VIAGEM</p>
        <p>Curso Técnico Integrado em Redes de Computadores</p>
        <h1 className="mt-3 text-lg font-bold">PLANO DE ESTUDO INDIVIDUAL (PEI)</h1>
        <p className="text-xs">Progressão Parcial de Estudos — ROD, Arts. 115 a 128</p>
      </header>
      <dl className="mt-6 grid grid-cols-2 gap-0">
        {linha('Semestre', ppe.semestre)}
        {linha('Matrícula', ppe.matricula)}
        <div className="col-span-2">{linha('Estudante', ppe.nomeEstudante)}</div>
        <div className="col-span-2">{linha('Componente curricular', `${ppe.disciplina.nome}${ppe.disciplina.codigo ? ` (${ppe.disciplina.codigo})` : ''} — ${ppe.disciplina.cargaHoraria}h`)}</div>
        <div className="col-span-2">{linha('Docente', pei.docente.nome)}</div>
        {linha('Carga horária do PEI', `${pei.cargaHorariaPei}h (máx. 30% — Art. 117 §1º)`)}
        {linha('Horas presenciais / práticas', `${pei.horasPresenciais}h / ${pei.horasPraticas}h`)}
      </dl>
      <section className="mt-4">
        <h2 className="font-bold">1. Objetivos de aprendizagem</h2>
        <p className="mt-1 whitespace-pre-line border border-slate-400 p-2">{pei.objetivos}</p>
      </section>
      <section className="mt-4">
        <h2 className="font-bold">2. Conteúdos a recuperar</h2>
        <p className="mt-1 whitespace-pre-line border border-slate-400 p-2">{pei.conteudos}</p>
      </section>
      {pei.criteriosAval && (
        <section className="mt-4">
          <h2 className="font-bold">3. Critérios de avaliação</h2>
          <p className="mt-1 whitespace-pre-line border border-slate-400 p-2">{pei.criteriosAval}</p>
        </section>
      )}
      <section className="mt-4">
        <h2 className="font-bold">Cronograma de encontros</h2>
        <table className="mt-1 w-full border-collapse text-left text-xs">
          <caption className="sr-only">Encontros do PEI</caption>
          <thead>
            <tr>
              <th scope="col" className="border border-slate-400 px-2 py-1">Data</th>
              <th scope="col" className="border border-slate-400 px-2 py-1">Conteúdo</th>
              <th scope="col" className="border border-slate-400 px-2 py-1">Metodologia / avaliação</th>
            </tr>
          </thead>
          <tbody>
            {pei.encontros.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap border border-slate-400 px-2 py-1">{formatarData(dataDoBanco(e.data))}</td>
                <td className="border border-slate-400 px-2 py-1">{e.conteudo}</td>
                <td className="border border-slate-400 px-2 py-1">{e.metodologiaAvaliacao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {pei.prorrogadoAte && (
        <p className="mt-3">
          <strong>Prorrogação (Art. 124):</strong> até {formatarData(dataDoBanco(pei.prorrogadoAte))}. {pei.justificativaProrrogacao}
        </p>
      )}
      <p className="mt-6">Boa Viagem (CE), {formatarData(hojeEmFortaleza())}.</p>
      <div className="mt-12 grid grid-cols-3 gap-6 text-center text-xs">
        {['Docente', 'Estudante / responsável', 'Coordenação do Curso'].map((papel) => (
          <div key={papel} className="border-t border-slate-700 pt-1">
            {papel}
          </div>
        ))}
      </div>
    </div>
  );
}
