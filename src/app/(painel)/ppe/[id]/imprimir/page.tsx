import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataDoBanco, formatarData, hojeEmFortaleza } from '@/lib/ausencias/regras';
import { acessoAoPpe } from '@/lib/ppe/servidor';

export const metadata: Metadata = { title: 'PEI para impressão — SGC-Redes' };

const CURSO = 'Técnico Integrado em Redes de Computadores';

// Página A4 com margens do modelo; o cinza dos rótulos sai na impressão.
const ESTILO_IMPRESSAO = `
@page { size: A4; margin: 1cm 2cm 1.5cm; }
@media print {
  .pei { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pei tr, .pei .bloco { break-inside: avoid; }
}
`;

/**
 * PEI no modelo do Campus Boa Viagem (RF06), conforme o formulário em papel: cabeçalho com a marca do IFCE em
 * todas as páginas, quadro de identificação com rótulos em cinza, seções 1 a 3 e assinatura do(a) professor(a).
 * Acréscimos ao modelo: horas práticas (Art. 121), critérios de avaliação, prorrogação (Art. 124) e ciência do
 * estudante e da Coordenação.
 */
export default async function PaginaImprimirPei({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await exigirPermissao('ppe:ver');
  const { id } = await params;
  const ppe = await prisma.registroPPE.findUnique({
    where: { id },
    include: { disciplina: true, pei: { include: { encontros: { orderBy: { data: 'asc' } }, docente: { select: { nome: true } } } } },
  });
  if (!ppe?.pei || !(await acessoAoPpe(usuario, ppe)).ver) notFound();
  const pei = ppe.pei;
  const d = ppe.disciplina;
  const componente = `${d.nome}${d.codigo ? ` (${d.codigo})` : ''} — ${d.cargaHoraria}h`;
  const cargaPei = `${pei.cargaHorariaPei}h (de ${d.cargaHoraria}h do componente; limite de 30% — Art. 117, § 1º)`;
  const comPratica = d.exigePratica || pei.horasPraticas > 0;

  const borda = 'border border-black';
  const rotulo = `${borda} bg-[#d9d9d9] px-2 py-1.5 font-normal`;
  const valor = `${borda} px-2 py-1.5 align-top`;

  return (
    <div className="pei mx-auto max-w-[17cm] bg-white p-6 text-[11pt] leading-snug text-black print:max-w-none print:p-0">
      <style>{ESTILO_IMPRESSAO}</style>
      <p className="mb-4 text-sm print:hidden">
        <Link href={`/ppe/${ppe.id}`} className="text-if-verde-700 underline underline-offset-2">
          ← Voltar à PPE
        </Link>{' '}
        · Use a impressão do navegador (Ctrl+P) para gerar o PDF ou o papel, em A4.
      </p>

      {/* O cabeçalho fica no <thead> da tabela externa: o navegador o repete no topo de cada página impressa. */}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <td className="pb-3">
              <div className="flex items-start justify-between">
                {/* Arquivo extraído do modelo do campus; trocar pelo SVG oficial da Comunicação (docs/IDENTIDADE_VISUAL_UX.md). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marca/ifce-vertical.png" alt="Instituto Federal do Ceará" style={{ height: '1.9cm', width: 'auto' }} />
                <p className="mt-6 font-bold">Plano de Estudo Individual</p>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <header className="text-center font-bold">
                <h1 className="text-[11pt] font-bold">PLANO DE ESTUDO INDIVIDUAL – PEI</h1>
                <p>Campus Boa Viagem</p>
              </header>

              <table className="mt-6 w-full table-fixed border-collapse text-left">
                <caption className="sr-only">Identificação do PEI</caption>
                <tbody>
                  <tr>
                    <td colSpan={2} className={valor}>
                      Semestre Letivo: <strong>{ppe.semestre}</strong>
                    </td>
                  </tr>
                  <tr>
                    <th scope="col" className={rotulo}>Nome do Estudante:</th>
                    <th scope="col" className={rotulo}>Matrícula:</th>
                  </tr>
                  <tr>
                    <td className={valor}>{ppe.nomeEstudante}</td>
                    <td className={valor}>{ppe.matricula}</td>
                  </tr>
                  <tr>
                    <th scope="col" className={rotulo}>Docente Responsável:</th>
                    <th scope="col" className={rotulo}>Curso:</th>
                  </tr>
                  <tr>
                    <td className={valor}>{pei.docente.nome}</td>
                    <td className={valor}>{CURSO}</td>
                  </tr>
                  <tr>
                    <th scope="col" className={rotulo}>Componente curricular:</th>
                    <th scope="col" className={rotulo}>Carga horária do PEI:</th>
                  </tr>
                  <tr>
                    <td className={valor}>{componente}</td>
                    <td className={valor}>{cargaPei}</td>
                  </tr>
                  <tr>
                    <th scope="row" className={`${valor} font-normal`}>Horas destinadas a estudos presenciais:</th>
                    <td className={valor}>{pei.horasPresenciais}h</td>
                  </tr>
                  {comPratica && (
                    <tr>
                      <th scope="row" className={`${valor} font-normal`}>Horas destinadas a atividades práticas (Art. 121):</th>
                      <td className={valor}>{pei.horasPraticas}h</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <section className="bloco mt-6">
                <h2>1. Objetivos de aprendizagem que precisam ser alcançados pelo aluno:</h2>
                <p className="mt-1 whitespace-pre-line pl-4">{pei.objetivos}</p>
              </section>
              <section className="bloco mt-5">
                <h2>2. Conteúdos que precisam ser recuperados:</h2>
                <p className="mt-1 whitespace-pre-line pl-4">{pei.conteudos}</p>
              </section>
              <section className="mt-5">
                <h2 className="bloco">3. Cronograma do Plano de Estudo Individual:</h2>
                <table className="mt-3 w-full border-collapse text-left">
                  <caption className="sr-only">Encontros do PEI</caption>
                  <colgroup>
                    <col className="w-[25%]" />
                    <col className="w-[41%]" />
                    <col className="w-[34%]" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col" className={`${borda} px-2 py-1.5 font-normal`}>Data do encontro</th>
                      <th scope="col" className={`${borda} px-2 py-1.5 font-normal`}>Conteúdo</th>
                      <th scope="col" className={`${borda} px-2 py-1.5 font-normal`}>Metodologia/ Avaliação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pei.encontros.map((e) => (
                      <tr key={e.id}>
                        <td className={`${valor} whitespace-nowrap`}>{formatarData(dataDoBanco(e.data))}</td>
                        <td className={valor}>{e.conteudo}</td>
                        <td className={valor}>{e.metodologiaAvaliacao}</td>
                      </tr>
                    ))}
                    {pei.encontros.length === 0 && (
                      <tr>
                        <td colSpan={3} className={valor}>Cronograma ainda não preenchido.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              {pei.criteriosAval && (
                <section className="bloco mt-5">
                  <h2>4. Critérios de avaliação:</h2>
                  <p className="mt-1 whitespace-pre-line pl-4">{pei.criteriosAval}</p>
                </section>
              )}
              {pei.prorrogadoAte && (
                <section className="bloco mt-5">
                  <h2>{pei.criteriosAval ? '5' : '4'}. Prorrogação (Art. 124):</h2>
                  <p className="mt-1 pl-4">
                    Prazo prorrogado até <strong>{formatarData(dataDoBanco(pei.prorrogadoAte))}</strong>.
                    {pei.justificativaProrrogacao ? ` Justificativa: ${pei.justificativaProrrogacao}` : ''}
                  </p>
                </section>
              )}

              <div className="bloco mt-6 space-y-6">
                <p>Boa Viagem (CE), {formatarData(hojeEmFortaleza())}.</p>
                <p>Assinatura do (a) professor (a) : ___________________________________________</p>
                <div className="grid grid-cols-2 gap-10 pt-5 text-center text-[10pt]">
                  <p className="border-t border-black pt-1">Ciência do(a) estudante ou responsável</p>
                  <p className="border-t border-black pt-1">Coordenação do Curso</p>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
