import type { Metadata } from 'next';
import Link from 'next/link';
import { QuadroGrade, SeletorPeriodo, type ConteudoCelula } from '@/components/quadro-grade';
import { exigirPermissao } from '@/lib/auth/dal';
import { blocosOrdenados, celulasDoProfessor } from '@/lib/grade/consultas';
import { anosDoSeletor, chaveCelula, periodoDaUrl } from '@/lib/grade/regras';
import { AvisoSabados } from '../sabados/aviso';

export const metadata: Metadata = { title: 'Minha grade — SGC-Redes' };

export default async function PaginaMinhaGrade({ searchParams }: { searchParams: Promise<{ ano?: string; sem?: string }> }) {
  const { usuario } = await exigirPermissao('grade:ver');
  const { anoLetivo, semestreLetivo } = periodoDaUrl(await searchParams);
  const [blocos, celulas] = await Promise.all([blocosOrdenados(), celulasDoProfessor(usuario.id, anoLetivo, semestreLetivo)]);

  const conteudo = new Map<string, ConteudoCelula[]>();
  for (const c of celulas) {
    const chave = chaveCelula(c.diaSemana, c.blocoId);
    conteudo.set(chave, [...(conteudo.get(chave) ?? []), { titulo: c.turma.nome, detalhe: c.oferta?.disciplina.nome }]);
  }

  return (
    <div>
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/grade?ano=${anoLetivo}&sem=${semestreLetivo}`} className="text-if-verde-700 underline underline-offset-2">
          Grade
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Minha grade</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Minha grade — {anoLetivo}.{semestreLetivo}
      </h1>
      <p className="mt-1 text-slate-700">
        {celulas.length} aula(s) por semana em {new Set(celulas.map((c) => c.turma.nome)).size} turma(s).
      </p>
      <div className="mt-4">
        <SeletorPeriodo anoLetivo={anoLetivo} semestreLetivo={semestreLetivo} anos={anosDoSeletor(anoLetivo)} />
      </div>
      <div className="mt-6">
        <QuadroGrade blocos={blocos} celulas={conteudo} legenda={`Grade de ${usuario.nome} em ${anoLetivo}.${semestreLetivo}`} />
      </div>
      <AvisoSabados anoLetivo={anoLetivo} semestreLetivo={semestreLetivo} />
    </div>
  );
}
