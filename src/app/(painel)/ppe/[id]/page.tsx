import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alerta } from '@/components/campo';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataDoBanco, formatarData } from '@/lib/ausencias/regras';
import { calcularTetoPei } from '@/lib/ppi-ppe-engines';
import { LINHAS_EXTRAS_CRONOGRAMA, MODALIDADES_DEFINIVEIS, NOME_MODALIDADE, NOME_STATUS_PPE, TRANSICOES } from '@/lib/ppe/regras';
import { acessoAoPpe } from '@/lib/ppe/servidor';
import { FormularioClonar, FormularioExclusaoPpe, FormularioModalidade, FormularioPei, FormularioSituacao } from '../formularios';

export const metadata: Metadata = { title: 'PPE — SGC-Redes' };

export default async function PaginaPpeDetalhe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const { usuario } = await exigirPermissao('ppe:ver');
  const { id } = await params;
  const { aviso } = await searchParams;
  const ppe = await prisma.registroPPE.findUnique({
    where: { id },
    include: { disciplina: true, pei: { include: { encontros: { orderBy: { data: 'asc' } }, docente: { select: { nome: true } } } } },
  });
  if (!ppe) notFound();
  const acesso = await acessoAoPpe(usuario, ppe);
  // Sem acesso a esta PPE (ex.: professor de outra disciplina): responde como inexistente.
  if (!acesso.ver) notFound();
  const [outrasDoEstudante, origensClone] = await Promise.all([
    prisma.registroPPE.count({ where: { matricula: ppe.matricula, semestre: ppe.semestre } }),
    acesso.definir && ppe.modalidade === 'PEI'
      ? prisma.registroPPE.findMany({
          where: { disciplinaId: ppe.disciplinaId, semestre: ppe.semestre, NOT: { id: ppe.id }, pei: { isNot: null } },
          select: { id: true, nomeEstudante: true, pei: { select: { _count: { select: { encontros: true } } } } },
        })
      : Promise.resolve([]),
  ]);
  const teto = calcularTetoPei(ppe.disciplina.cargaHoraria);
  const editavel = acesso.definir && ['EM_ANDAMENTO', 'PRORROGADO'].includes(ppe.status);
  const proximas = TRANSICOES[ppe.status].filter((s) => acesso.gerenciar || s !== 'LANCADO_ACADEMICO');

  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href={`/ppe?semestre=${ppe.semestre}`} className="text-if-verde-700 underline underline-offset-2">
          PPE / PEI
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{ppe.disciplina.nome}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {ppe.disciplina.nome} — {ppe.nomeEstudante}
      </h1>
      <p className="mt-1 text-slate-700">
        Matrícula {ppe.matricula} · {ppe.semestre} · CH {ppe.disciplina.cargaHoraria}h (teto do PEI {teto}h) · {NOME_MODALIDADE[ppe.modalidade]} ·{' '}
        <strong>{NOME_STATUS_PPE[ppe.status]}</strong>
        {ppe.notaFinal !== null && ` · Nota ${String(ppe.notaFinal).replace('.', ',')}`}
      </p>

      {aviso === 'registrada' && (
        <div className="mt-4">
          <Alerta tipo="sucesso">PPE registrada. O docente da disciplina define a modalidade.</Alerta>
        </div>
      )}
      {ppe.alertaRetencao && (
        <div className="mt-4">
          <Alerta tipo="erro">
            Art. 115: este estudante tem {outrasDoEstudante} componentes pendentes em {ppe.semestre}. A PPE vale para até 2; o caso é de retenção.
          </Alerta>
        </div>
      )}

      {acesso.definir && (ppe.status === 'AGUARDANDO_PROFESSOR' || ppe.status === 'EM_ANDAMENTO') && (
        <section aria-labelledby="modalidade" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="modalidade" className="mb-3 text-lg font-semibold text-slate-900">Modalidade</h2>
          <FormularioModalidade ppeId={ppe.id} atual={ppe.modalidade} opcoes={MODALIDADES_DEFINIVEIS.map((m) => ({ valor: m, rotulo: NOME_MODALIDADE[m] }))} />
        </section>
      )}

      {ppe.modalidade === 'PEI' && (
        <section aria-labelledby="pei" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="pei" className="text-lg font-semibold text-slate-900">Plano de Estudo Individual</h2>
            {ppe.pei && (
              <Link href={`/ppe/${ppe.id}/imprimir`} className="text-sm text-if-verde-700 underline underline-offset-2">
                Versão para impressão
              </Link>
            )}
          </div>
          {ppe.pei && (
            <p className="mb-3 mt-1 text-sm text-slate-700">
              Docente: {ppe.pei.docente.nome}
              {ppe.pei.prorrogadoAte && ` · Prorrogado até ${formatarData(dataDoBanco(ppe.pei.prorrogadoAte))}: ${ppe.pei.justificativaProrrogacao ?? ''}`}
            </p>
          )}
          {editavel ? (
            <>
              {origensClone.length > 0 && (
                <div className="mb-6 rounded-md bg-slate-50 p-4">
                  <p className="mb-2 text-sm text-slate-700">G09: um PEI por estudante. Para turmas de PPE na mesma disciplina, copie o cronograma de outro PEI.</p>
                  <FormularioClonar
                    ppeId={ppe.id}
                    origens={origensClone.map((o) => ({ valor: o.id, rotulo: `${o.nomeEstudante} (${o.pei?._count.encontros ?? 0} encontro(s))` }))}
                  />
                </div>
              )}
              <FormularioPei
                ppeId={ppe.id}
                teto={teto}
                exigePratica={ppe.disciplina.exigePratica}
                linhasExtras={LINHAS_EXTRAS_CRONOGRAMA}
                iniciais={{
                  cargaHorariaPei: ppe.pei ? String(ppe.pei.cargaHorariaPei) : '',
                  horasPresenciais: ppe.pei ? String(ppe.pei.horasPresenciais) : '',
                  horasPraticas: ppe.pei ? String(ppe.pei.horasPraticas) : '',
                  objetivos: ppe.pei?.objetivos ?? '',
                  conteudos: ppe.pei?.conteudos ?? '',
                  criteriosAval: ppe.pei?.criteriosAval ?? '',
                  encontros: (ppe.pei?.encontros ?? []).map((e) => ({ data: dataDoBanco(e.data), conteudo: e.conteudo, metodologia: e.metodologiaAvaliacao })),
                }}
              />
            </>
          ) : ppe.pei ? (
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="font-semibold">Carga horária</dt>
                <dd>
                  {ppe.pei.cargaHorariaPei}h ({ppe.pei.horasPresenciais}h presenciais, {ppe.pei.horasPraticas}h práticas)
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Objetivos</dt>
                <dd className="whitespace-pre-line">{ppe.pei.objetivos}</dd>
              </div>
              <div>
                <dt className="font-semibold">Conteúdos</dt>
                <dd className="whitespace-pre-line">{ppe.pei.conteudos}</dd>
              </div>
              <div>
                <dt className="font-semibold">Cronograma</dt>
                <dd>
                  <ul className="list-disc pl-5">
                    {ppe.pei.encontros.map((e) => (
                      <li key={e.id}>
                        {formatarData(dataDoBanco(e.data))}: {e.conteudo} — {e.metodologiaAvaliacao}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-slate-700">PEI ainda não preenchido pelo docente.</p>
          )}
        </section>
      )}

      {acesso.definir && proximas.length > 0 && (
        <section aria-labelledby="situacao" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="situacao" className="mb-3 text-lg font-semibold text-slate-900">Situação</h2>
          <FormularioSituacao
            ppeId={ppe.id}
            opcoes={proximas.map((s) => ({ valor: s, rotulo: NOME_STATUS_PPE[s] }))}
            permiteProrrogar={proximas.includes('PRORROGADO') && ppe.modalidade === 'PEI'}
          />
        </section>
      )}

      {acesso.gerenciar && ppe.status !== 'LANCADO_ACADEMICO' && (
        <section aria-labelledby="excluir" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="excluir" className="mb-3 text-lg font-semibold text-slate-900">Excluir</h2>
          <FormularioExclusaoPpe ppeId={ppe.id} />
        </section>
      )}
    </div>
  );
}
