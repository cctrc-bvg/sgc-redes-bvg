import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirPermissao } from '@/lib/auth/dal';
import { hojeEmFortaleza } from '@/lib/ausencias/regras';
import { SUSPENDE_POR_PADRAO, TIPOS_EVENTO } from '@/lib/calendario/regras';
import { FormularioEvento } from '../../formularios';

export const metadata: Metadata = { title: 'Novo evento — SGC-Redes' };

export default async function PaginaNovoEvento({ searchParams }: { searchParams: Promise<{ inicio?: string; tipo?: string }> }) {
  await exigirPermissao('calendario:gerenciar');
  const { inicio, tipo: tipoParam } = await searchParams;
  const tipo = TIPOS_EVENTO.find((t) => t === tipoParam) ?? 'FERIADO';
  const data = /^\d{4}-\d{2}-\d{2}$/.test(inicio ?? '') ? inicio! : hojeEmFortaleza();
  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/calendario?ano=${data.slice(0, 4)}&mes=${Number(data.slice(5, 7))}`} className="text-if-verde-700 underline underline-offset-2">
          Calendário
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Novo evento</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Novo evento no calendário</h1>
      <p className="mt-1 text-slate-700">
        Para sábado letivo, use <Link href="/grade/sabados" className="text-if-verde-700 underline underline-offset-2">Sábados letivos</Link> (com o dia da grade a que se refere).
      </p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FormularioEvento inicial={{ tipo, inicio: data, fim: '', descricao: '', suspendeAulas: SUSPENDE_POR_PADRAO[tipo], imprevisto: false, motivo: '' }} />
      </div>
    </div>
  );
}
