import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alerta } from '@/components/campo';
import { rotuloBloco } from '@/components/quadro-grade';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { blocosOrdenados, celulasDaTurma, ofertasDoSemestre } from '@/lib/grade/consultas';
import { DIAS_SEMANA, NOME_DIA, PREFIXO_CELULA, chaveCelula, periodoDaUrl } from '@/lib/grade/regras';
import { FormularioCopiarAnuais, FormularioGrade, type LinhaEditavel } from './formularios';

export const metadata: Metadata = { title: 'Editar grade — SGC-Redes' };

export default async function PaginaEditarGrade({
  params,
  searchParams,
}: {
  params: Promise<{ turmaId: string }>;
  searchParams: Promise<{ ano?: string; sem?: string }>;
}) {
  await exigirPermissao('grade:editar');
  const { turmaId } = await params;
  const { anoLetivo, semestreLetivo } = periodoDaUrl(await searchParams);
  const turma = await prisma.turma.findUnique({ where: { id: turmaId }, select: { id: true, nome: true } });
  if (!turma) notFound();

  const [blocos, ofertas, celulas] = await Promise.all([
    blocosOrdenados(),
    ofertasDoSemestre(turma.id, anoLetivo, semestreLetivo),
    celulasDaTurma(turma.id, anoLetivo, semestreLetivo),
  ]);
  const atual = new Map(celulas.map((c) => [chaveCelula(c.diaSemana, c.blocoId), c.ofertaId ?? '']));
  const periodo = `?ano=${anoLetivo}&sem=${semestreLetivo}`;

  const linhas: LinhaEditavel[] = blocos.map((b, i) => ({
    rotuloBloco: rotuloBloco(b),
    horario: `${b.horaInicio}–${b.horaFim}`,
    separaTurno: i > 0 && blocos[i - 1].turno !== b.turno,
    celulas: DIAS_SEMANA.map((d) => {
      const chave = chaveCelula(d, b.id);
      return {
        chave,
        campo: PREFIXO_CELULA + chave,
        rotulo: `${NOME_DIA[d]}, ${rotuloBloco(b)} (${b.horaInicio}–${b.horaFim})`,
        valor: atual.get(chave) ?? '',
      };
    }),
  }));
  const opcoes = [
    { valor: '', rotulo: '— vago —' },
    ...ofertas.map((o) => ({ valor: o.id, rotulo: `${o.disciplina.nome} — ${o.professor.nome}` })),
  ];

  return (
    <div>
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/grade${periodo}`} className="text-if-verde-700 underline underline-offset-2">
          Grade
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <Link href={`/grade/turma/${turma.id}${periodo}`} className="text-if-verde-700 underline underline-offset-2">
          {turma.nome}
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Editar</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Editar grade — {turma.nome} — {anoLetivo}.{semestreLetivo}
      </h1>
      <p className="mt-1 text-slate-700">
        Escolha a disciplina de cada horário. Disciplinas anuais aparecem nos dois semestres; as técnicas, só no seu. Choques de
        horário do professor com outras turmas são recusados ao salvar.
      </p>

      {ofertas.length === 0 ? (
        <div className="mt-6">
          <Alerta tipo="info">
            Nenhuma disciplina distribuída para esta turma em {anoLetivo}.{' '}
            <Link href={`/ofertas/${turma.id}?ano=${anoLetivo}`} className="underline">
              Distribua as disciplinas
            </Link>{' '}
            antes de montar a grade.
          </Alerta>
        </div>
      ) : (
        <>
          {semestreLetivo === 2 && (
            <section aria-labelledby="copiar" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 id="copiar" className="font-semibold text-slate-900">
                Começar pelo 1º semestre
              </h2>
              <p className="mb-3 mt-1 text-sm text-slate-700">Copia as aulas das disciplinas anuais do 1º semestre para os horários ainda vagos.</p>
              <FormularioCopiarAnuais turmaId={turma.id} anoLetivo={anoLetivo} semestreLetivo={semestreLetivo} />
            </section>
          )}
          <div className="mt-6">
            <FormularioGrade
              turmaId={turma.id}
              anoLetivo={anoLetivo}
              semestreLetivo={semestreLetivo}
              dias={DIAS_SEMANA.map((d) => NOME_DIA[d])}
              linhas={linhas}
              opcoes={opcoes}
            />
          </div>
        </>
      )}
    </div>
  );
}
