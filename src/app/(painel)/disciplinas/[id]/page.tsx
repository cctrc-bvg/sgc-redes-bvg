import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { calcularTetoPei } from '@/lib/ppi-ppe-engines';
import { NOME_NUCLEO, descreverPeriodo, divisaoTeoricaPratica } from '@/lib/disciplinas/regras';
import { FormularioDisciplina } from '../formulario-disciplina';
import { FormularioExclusao } from '../formulario-exclusao';

export const metadata: Metadata = { title: 'Disciplina — SGC-Redes' };

export default async function PaginaDisciplina({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await exigirPermissao('disciplinas:ver');
  const podeGerenciar = temPermissao(usuario.role, 'disciplinas:gerenciar');
  const { id } = await params;
  const d = await prisma.disciplina.findUnique({
    where: { id },
    include: { _count: { select: { ofertas: true, ppes: true } } },
  });
  if (!d) notFound();
  const usada = d._count.ofertas > 0 || d._count.ppes > 0;
  const divisao = divisaoTeoricaPratica(d.nucleo, d.cargaHoraria);

  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/disciplinas" className="text-if-verde-700 underline underline-offset-2">Disciplinas</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{d.nome}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{d.nome}</h1>
      {podeGerenciar && (
        <p className="mt-1 text-slate-700">
          {d._count.ofertas} oferta(s) · {d._count.ppes} registro(s) de PPE
        </p>
      )}

      {podeGerenciar ? (
        <section aria-labelledby="dados" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="dados" className="mb-4 text-lg font-semibold text-slate-900">Dados da disciplina</h2>
          <FormularioDisciplina
            modo="editar"
            disciplinaId={d.id}
            iniciais={{
              codigo: d.codigo ?? '',
              nome: d.nome,
              cargaHoraria: String(d.cargaHoraria),
              exigePratica: d.exigePratica,
              ementaUrl: d.ementaUrl ?? '',
              programaTexto: d.programaTexto ?? '',
              nucleo: d.nucleo ?? '',
              anoCurso: d.anoCurso ? String(d.anoCurso) : '',
              semestreCurso: d.semestreCurso ? String(d.semestreCurso) : '',
              ativa: d.ativa,
            }}
          />
        </section>
      ) : (
        <section aria-labelledby="dados" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="dados" className="sr-only">Dados da disciplina</h2>
          {!d.ativa && (
            <p className="mb-4 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
              <span aria-hidden="true">⏸</span> Desativada — fora da matriz vigente
            </p>
          )}
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold text-slate-700">Código</dt>
              <dd className="text-slate-900">{d.codigo ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-700">Núcleo e período</dt>
              <dd className="text-slate-900">
                {d.nucleo ? `${NOME_NUCLEO[d.nucleo]} · ` : ''}
                {descreverPeriodo(d)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-700">Carga horária total</dt>
              <dd className="text-slate-900">
                {d.cargaHoraria}h{divisao && ` (${divisao.teorica}h teóricas + ${divisao.pratica}h práticas)`}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-700">Teto do PEI (Art. 117 §1º)</dt>
              <dd className="text-slate-900">{calcularTetoPei(d.cargaHoraria)}h (30%)</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-slate-700">Conteúdo prático (Art. 121)</dt>
              <dd className="text-slate-900">{d.exigePratica ? 'Exige: o PEI deve reservar horas práticas' : 'Não exige'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-semibold text-slate-700">Ementa / PPC</dt>
              <dd className="text-slate-900">
                {d.ementaUrl ? (
                  <a href={d.ementaUrl} rel="noopener noreferrer" className="break-all text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                    {d.ementaUrl}
                  </a>
                ) : (
                  'Não informada'
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-semibold text-slate-700">Programa</dt>
              <dd className="whitespace-pre-line text-slate-900">{d.programaTexto ?? 'Não informado'}</dd>
            </div>
          </dl>
        </section>
      )}

      {podeGerenciar && !usada && (
        <section aria-labelledby="exclusao" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="exclusao" className="text-lg font-semibold text-slate-900">Excluir</h2>
          <p className="mb-4 mt-1 text-sm text-slate-700">
            Disponível apenas enquanto a disciplina não tem ofertas nem PPEs. Depois disso, use &quot;Disciplina ativa&quot;.
          </p>
          <FormularioExclusao disciplinaId={d.id} />
        </section>
      )}
    </div>
  );
}
