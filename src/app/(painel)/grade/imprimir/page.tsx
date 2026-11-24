import type { Metadata } from 'next';
import { BarraImpressao } from '@/components/barra-impressao';
import { QuadroGrade, type ConteudoCelula } from '@/components/quadro-grade';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { blocosOrdenados, celulasDaTurma } from '@/lib/grade/consultas';
import { chaveCelula, periodoDaUrl } from '@/lib/grade/regras';

export const metadata: Metadata = { title: 'Grades para impressão — SGC-Redes' };

/** Grade de uma turma (?turma=id) ou de todas, uma por página, para imprimir ou salvar em PDF. */
export default async function PaginaImprimirGrades({ searchParams }: { searchParams: Promise<{ ano?: string; sem?: string; turma?: string }> }) {
  await exigirPermissao('grade:ver');
  const sp = await searchParams;
  const { anoLetivo, semestreLetivo } = periodoDaUrl(sp);
  const turmas = await prisma.turma.findMany({
    where: sp.turma ? { id: sp.turma } : { ativa: true },
    orderBy: { codigo: 'asc' },
    select: { id: true, nome: true },
  });
  const blocos = await blocosOrdenados();
  const quadros = await Promise.all(
    turmas.map(async (t) => {
      const conteudo = new Map<string, ConteudoCelula[]>();
      for (const c of await celulasDaTurma(t.id, anoLetivo, semestreLetivo)) {
        if (c.oferta) conteudo.set(chaveCelula(c.diaSemana, c.blocoId), [{ titulo: c.oferta.disciplina.nome, detalhe: c.oferta.professor.nome }]);
      }
      return { turma: t, conteudo };
    }),
  );
  const voltar = sp.turma && turmas[0] ? `/grade/turma/${turmas[0].id}?ano=${anoLetivo}&sem=${semestreLetivo}` : `/grade?ano=${anoLetivo}&sem=${semestreLetivo}`;
  return (
    <div className="bg-white p-4 text-slate-900 print:p-0">
      <BarraImpressao voltar={voltar} rotulo="Voltar à grade" paisagem />
      {quadros.length === 0 && <p>Nenhuma turma encontrada.</p>}
      {quadros.map(({ turma, conteudo }, i) => (
        <section key={turma.id} className={i > 0 ? 'mt-8 break-before-page print:mt-0' : ''}>
          <header className="mb-3 text-center">
            <p className="text-sm font-semibold">INSTITUTO FEDERAL DO CEARÁ — CAMPUS BOA VIAGEM · Curso Técnico Integrado em Redes de Computadores</p>
            <h1 className="text-lg font-bold">
              Grade horária — {turma.nome} — {anoLetivo}.{semestreLetivo}
            </h1>
          </header>
          <QuadroGrade blocos={blocos} celulas={conteudo} legenda={`Grade da turma ${turma.nome} em ${anoLetivo}.${semestreLetivo}`} />
        </section>
      ))}
    </div>
  );
}
