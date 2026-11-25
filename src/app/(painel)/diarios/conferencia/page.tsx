import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/campo';
import { SeletorPeriodo } from '@/components/quadro-grade';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { hojeEmFortaleza } from '@/lib/ausencias/regras';
import { situacoesAutomaticas } from '@/lib/diarios/servidor';
import { anosDoSeletor, periodoDaUrl } from '@/lib/grade/regras';
import { conferirDiario } from '../actions';

export const metadata: Metadata = { title: 'Conferência dos diários — SGC-Redes' };

export default async function PaginaConferencia({ searchParams }: { searchParams: Promise<{ ano?: string; sem?: string; so?: string }> }) {
  await exigirPermissao('diarios:ver-todos');
  const params = await searchParams;
  const { anoLetivo, semestreLetivo } = periodoDaUrl(params);
  const hoje = hojeEmFortaleza();
  const soDiferentes = params.so === 'diferentes';

  const ofertas = await prisma.disciplinaOferta.findMany({
    where: { anoLetivo, OR: [{ semestreLetivo: null }, { semestreLetivo }] },
    select: {
      id: true,
      semestreLetivo: true,
      aulasPrevistas: true,
      aulasMinistradas: true,
      ministradasManual: true,
      diarioEmDia: true,
      turma: { select: { codigo: true } },
      disciplina: { select: { nome: true } },
      professor: { select: { nome: true } },
    },
  });
  const situacoes = await situacoesAutomaticas(anoLetivo, ofertas, hoje);
  const linhas = ofertas
    .map((o) => {
      const s = situacoes.get(o.id);
      return { ...o, presumido: s?.presumido ?? null, efetivas: s?.efetivas ?? o.aulasMinistradas };
    })
    // Quem foi corrigido à mão e destoa do presumido aparece primeiro: é onde a conferência rende mais.
    .map((o) => ({ ...o, diferenca: o.presumido === null ? 0 : o.efetivas - o.presumido }))
    .filter((o) => !soDiferentes || o.diferenca !== 0)
    .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca) || a.turma.codigo.localeCompare(b.turma.codigo) || a.disciplina.nome.localeCompare(b.disciplina.nome, 'pt-BR'));
  const base = `/diarios/conferencia?ano=${anoLetivo}&sem=${semestreLetivo}`;

  return (
    <>
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/diarios?ano=${anoLetivo}&sem=${semestreLetivo}`} className="text-if-verde-700 underline underline-offset-2">Diários</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Conferência</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Conferência dos diários</h1>
      <p className="mt-1 max-w-3xl text-slate-700">
        Compare o presumido (grade × dias letivos até ontem) com o diário do sistema acadêmico. Se o número for igual, o diário continua
        automático; se for diferente, vira lançamento manual. A conferência é por amostra, no fim de cada etapa.
      </p>
      <div className="mt-4">
        <SeletorPeriodo anoLetivo={anoLetivo} semestreLetivo={semestreLetivo} anos={anosDoSeletor(anoLetivo)} manter={soDiferentes ? { so: 'diferentes' } : {}} />
      </div>
      <p className="mt-3 text-sm">
        {soDiferentes ? (
          <Link href={base} className="text-if-verde-700 underline underline-offset-2">Mostrar todos</Link>
        ) : (
          <Link href={`${base}&so=diferentes`} className="text-if-verde-700 underline underline-offset-2">Mostrar só os que destoam do presumido</Link>
        )}
      </p>

      {linhas.length === 0 ? (
        <div className="mt-6">
          <Alerta tipo="info">Nenhum diário para conferir neste período.</Alerta>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">Presumido e valor atual de cada diário, com campo para o valor do sistema acadêmico</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Disciplina</th>
                <th scope="col" className="px-4 py-3 font-semibold">Docente</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Presumido</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Vale hoje</th>
                <th scope="col" className="px-4 py-3 font-semibold">No sistema acadêmico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((l) => (
                <tr key={l.id}>
                  <th scope="row" className="px-4 py-3 font-normal">
                    <Link href={`/diarios/${l.id}`} className="font-semibold text-if-verde-700 underline underline-offset-2">{l.disciplina.nome}</Link>
                    <span className="block text-slate-600">{l.turma.codigo} · de {l.aulasPrevistas} previstas</span>
                  </th>
                  <td className="px-4 py-3">{l.professor.nome}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.presumido ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {l.efetivas}
                    <span className="block text-xs text-slate-600">{l.ministradasManual ? 'manual' : 'automático'}{l.diferenca !== 0 && ` (${l.diferenca > 0 ? '+' : ''}${l.diferenca})`}</span>
                  </td>
                  <td className="px-4 py-3">
                    <form action={conferirDiario} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="ofertaId" value={l.id} />
                      <label className="sr-only" htmlFor={`aulas-${l.id}`}>Aulas no sistema acadêmico, {l.disciplina.nome} {l.turma.codigo}</label>
                      <input id={`aulas-${l.id}`} name="aulasMinistradas" inputMode="numeric" maxLength={3} defaultValue={String(l.efetivas)} className="w-16 rounded border border-slate-400 px-2 py-1 tabular-nums" />
                      <label className="flex items-center gap-1 text-xs text-slate-800">
                        <input name="diarioEmDia" type="checkbox" defaultChecked={l.diarioEmDia} className="size-4 accent-if-verde-700" /> em dia
                      </label>
                      <button type="submit" className="rounded bg-if-verde-700 px-3 py-1 text-xs font-semibold text-white hover:bg-if-verde-800">Conferir</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
