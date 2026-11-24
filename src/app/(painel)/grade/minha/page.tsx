import type { Metadata } from 'next';
import Link from 'next/link';
import { QuadroGrade, SeletorPeriodo, type ConteudoCelula } from '@/components/quadro-grade';
import { exigirPermissao } from '@/lib/auth/dal';
import { blocosOrdenados, celulasDoProfessor } from '@/lib/grade/consultas';
import { anosDoSeletor, chaveCelula, periodoDaUrl } from '@/lib/grade/regras';
import { formatarData, hojeEmFortaleza, somarDias } from '@/lib/ausencias/regras';
import { mudancasDoProfessor } from '@/lib/ausencias/servidor';
import { AvisoSabados } from '../sabados/aviso';

export const metadata: Metadata = { title: 'Minha grade — SGC-Redes' };

export default async function PaginaMinhaGrade({ searchParams }: { searchParams: Promise<{ ano?: string; sem?: string }> }) {
  const { usuario } = await exigirPermissao('grade:ver');
  const { anoLetivo, semestreLetivo } = periodoDaUrl(await searchParams);
  const hoje = hojeEmFortaleza();
  const [blocos, celulas, mudancas] = await Promise.all([
    blocosOrdenados(),
    celulasDoProfessor(usuario.id, anoLetivo, semestreLetivo),
    mudancasDoProfessor(usuario.id, hoje, somarDias(hoje, 14)),
  ]);

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
      {mudancas.length > 0 && (
        <section aria-labelledby="mudancas" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 id="mudancas" className="font-semibold text-slate-900">
            <span aria-hidden="true">⚠ </span>Mudanças nos próximos 14 dias
          </h2>
          <ul className="mt-2 space-y-1 text-slate-800">
            {mudancas.map((m) => (
              <li key={`${m.dataISO}-${m.bloco}-${m.tipo}`}>
                <span className="font-semibold">
                  {formatarData(m.dataISO)} · {m.bloco} · {m.turma}:
                </span>{' '}
                {m.detalhe}
              </li>
            ))}
          </ul>
        </section>
      )}
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
