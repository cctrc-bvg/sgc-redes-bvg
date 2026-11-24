import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataDoBanco } from '@/lib/ausencias/regras';
import { DIAS_POR_ETAPA } from '@/lib/calendario/regras';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';
import { FormularioEtapas } from '../formularios';

export const metadata: Metadata = { title: 'Etapas e semestres — SGC-Redes' };

export default async function PaginaEtapas({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  await exigirPermissao('calendario:gerenciar');
  const ano = lerAnoLetivo((await searchParams).ano) ?? anoLetivoAtual();
  const [etapas, semestres] = await Promise.all([
    prisma.etapaLetiva.findMany({ where: { anoLetivo: ano } }),
    prisma.periodoLetivo.findMany({ where: { anoLetivo: ano } }),
  ]);
  const inicial: Record<string, string> = {};
  for (const e of etapas) Object.assign(inicial, { [`etapa${e.numero}:inicio`]: dataDoBanco(e.inicio), [`etapa${e.numero}:fim`]: dataDoBanco(e.fim) });
  for (const s of semestres) Object.assign(inicial, { [`semestre${s.semestreLetivo}:inicio`]: dataDoBanco(s.inicio), [`semestre${s.semestreLetivo}:fim`]: dataDoBanco(s.fim) });
  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/calendario?ano=${ano}`} className="text-if-verde-700 underline underline-offset-2">
          Calendário {ano}
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Etapas e semestres</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Etapas e semestres de {ano}</h1>
      <p className="mt-1 text-slate-700">
        Início e término de cada etapa (meta de {DIAS_POR_ETAPA} dias letivos cada) e de cada semestre. A contagem aparece no calendário.
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioEtapas ano={ano} inicial={inicial} />
      </div>
    </div>
  );
}
