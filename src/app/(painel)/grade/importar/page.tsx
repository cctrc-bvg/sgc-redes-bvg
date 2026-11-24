import type { Metadata } from 'next';
import Link from 'next/link';
import { ImportadorPlanilha } from '@/components/importador-planilha';
import { exigirPermissao } from '@/lib/auth/dal';
import { periodoDaUrl } from '@/lib/grade/regras';
import { importarGrade } from './actions';

export const metadata: Metadata = { title: 'Importar grade horária — SGC-Redes' };

const MODOS = {
  completar: 'Completar: só os horários da planilha mudam',
  substituir: 'Substituir: as turmas da planilha ficam exatamente como nela',
} as const;

export default async function PaginaImportarGrade({ searchParams }: { searchParams: Promise<{ ano?: string; sem?: string; modo?: string }> }) {
  await exigirPermissao('grade:editar');
  const sp = await searchParams;
  const { anoLetivo, semestreLetivo } = periodoDaUrl(sp);
  const modo = sp.modo === 'substituir' ? 'substituir' : 'completar';
  const periodo = `ano=${anoLetivo}&sem=${semestreLetivo}`;
  const link = 'text-if-verde-700 underline underline-offset-2';
  return (
    <div className="max-w-4xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/grade?${periodo}`} className={link}>
          Grade
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Importar planilha</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Importar a grade de {anoLetivo}.{semestreLetivo} por planilha
      </h1>
      <p className="mt-1 text-slate-700">
        Uma linha por aula: turma, dia, horário e disciplina (das ofertas cadastradas). O sistema confere choques de horário de cada professor entre as turmas
        antes de gravar.
      </p>
      <nav aria-label="Semestre" className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-700">Semestre:</span>
        {[1, 2].map((s) =>
          s === semestreLetivo ? (
            <strong key={s} aria-current="true">
              {anoLetivo}.{s}
            </strong>
          ) : (
            <Link key={s} href={`/grade/importar?ano=${anoLetivo}&sem=${s}&modo=${modo}`} className={link}>
              {anoLetivo}.{s}
            </Link>
          ),
        )}
      </nav>
      <fieldset className="mt-3 text-sm">
        <legend className="text-slate-700">Modo:</legend>
        <ul className="mt-1 space-y-1">
          {(Object.keys(MODOS) as (keyof typeof MODOS)[]).map((m) => (
            <li key={m}>
              {m === modo ? (
                <strong aria-current="true">✔ {MODOS[m]}</strong>
              ) : (
                <Link href={`/grade/importar?${periodo}&modo=${m}`} className={link}>
                  {MODOS[m]}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="mt-6">
        <ImportadorPlanilha acao={importarGrade} ocultos={{ anoLetivo: String(anoLetivo), semestreLetivo: String(semestreLetivo), modo }} modeloBase={`/grade/importar/modelo?${periodo}`} itens="aulas da grade" />
      </div>
    </div>
  );
}
