import type { Metadata } from 'next';
import Link from 'next/link';
import type { NivelUrgenciaSla, TipoRefeicao } from '@prisma/client';
import { Alerta, BotaoSecundario, Campo } from '@/components/campo';
import { prisma } from '@/lib/db';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { validarDataISO } from '@/lib/alimentacao-engine';
import { NOME_DIA_EXTENSO } from '@/lib/grade/regras';
import { preverRefeicoesDaTurma, REFEICOES, somarQuantidades } from '@/lib/alimentacao/previsao';
import { ETIQUETA_SLA, NOME_REFEICAO_HORARIO } from '@/lib/ausencias/mensagens';
import { formatarData, hojeEmFortaleza, presencaPorTurno, somarDias } from '@/lib/ausencias/regras';
import { carregarDia, intervaloDoDia } from '@/lib/ausencias/servidor';
import { FormularioCancelarAcrescimo, FormularioCiencia, FormularioQuantidade } from './formularios';

export const metadata: Metadata = { title: 'Alimentação — SGC-Redes' };

const ORDEM_SLA: Record<NivelUrgenciaSla, number> = { VERMELHO_MENOS_4H: 0, AMARELO_4H_A_24H: 1, VERDE_24H_MAIS: 2 };
const CAMPO_MEDIA: Record<TipoRefeicao, 'qtdMediaLancheManha' | 'qtdMediaAlmoco' | 'qtdMediaLancheTarde'> = {
  LANCHE_MANHA: 'qtdMediaLancheManha',
  ALMOCO: 'qtdMediaAlmoco',
  LANCHE_TARDE: 'qtdMediaLancheTarde',
};

function validarDataOuNull(v: string | undefined): string | null {
  if (!v) return null;
  try {
    validarDataISO(v);
    return v;
  } catch {
    return null;
  }
}

/** Data no fuso de Fortaleza de um instante (avisos guardam o horário da refeição). */
const dataLocal = (d: Date) => hojeEmFortaleza(d);

export default async function PaginaAlimentacao({ searchParams }: { searchParams: Promise<{ data?: string; aviso?: string }> }) {
  const { usuario } = await exigirPermissao('alimentacao:ver');
  const podeConfirmar = temPermissao(usuario.role, 'alimentacao:confirmar');
  const podeAjustar = temPermissao(usuario.role, 'alimentacao:gerenciar');
  const podeComunicar = temPermissao(usuario.role, 'comunicacao:enviar');
  const hoje = hojeEmFortaleza();
  const { data: dataUrl, aviso } = await searchParams;
  const data = validarDataOuNull(dataUrl) ?? hoje;
  const agora = new Date();

  const [pendentes, avisosDoDia, turmas, dia] = await Promise.all([
    prisma.alertaAlimentacao.findMany({
      where: { canceladoEm: null, confirmadoAE: false, dataRefeicao: { gte: agora } },
      orderBy: { dataRefeicao: 'asc' },
      select: { id: true, dataRefeicao: true, tipoRefeicao: true, acao: true, qtdImpactada: true, nivelSla: true, descricao: true, turma: { select: { codigo: true, nome: true } } },
    }),
    prisma.alertaAlimentacao.findMany({
      where: { dataRefeicao: intervaloDoDia(data) },
      orderBy: [{ dataRefeicao: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        turmaId: true,
        tipoRefeicao: true,
        acao: true,
        qtdImpactada: true,
        nivelSla: true,
        confirmadoAE: true,
        confirmadoEm: true,
        canceladoEm: true,
        dataRefeicao: true,
        manual: true,
        descricao: true,
        turma: { select: { codigo: true } },
      },
    }),
    prisma.turma.findMany({ where: { ativa: true }, orderBy: [{ anoCurso: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }] }),
    carregarDia(data),
  ]);
  pendentes.sort((a, b) => ORDEM_SLA[a.nivelSla] - ORDEM_SLA[b.nivelSla] || a.dataRefeicao.getTime() - b.dataRefeicao.getTime());

  const previsoes = turmas.map((t) => {
    const blocos = dia.aulasDoDia.filter((a) => a.turmaId === t.id).map((a) => a.blocoId);
    const presenca = presencaPorTurno(blocos, dia.blocos);
    const medias = { LANCHE_MANHA: t[CAMPO_MEDIA.LANCHE_MANHA], ALMOCO: t[CAMPO_MEDIA.ALMOCO], LANCHE_TARDE: t[CAMPO_MEDIA.LANCHE_TARDE] };
    const avisos = avisosDoDia.filter((a) => a.turmaId === t.id && !a.canceladoEm);
    return { turma: t, presenca, avisos, ...preverRefeicoesDaTurma(presenca, medias, avisos) };
  });
  const total = somarQuantidades(previsoes.map((p) => p.final));
  const turnos = (p: { temAulaManha: boolean; temAulaTarde: boolean }) =>
    p.temAulaManha && p.temAulaTarde ? 'Integral' : p.temAulaManha ? 'Manhã' : p.temAulaTarde ? 'Tarde' : 'Sem aula';

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alimentação</h1>
          <p className="mt-1 text-slate-700">
            Previsão de refeições por turma (lanche só no turno com aula; almoço só em dia integral) e avisos de alteração da Coordenação.
          </p>
        </div>
        {podeAjustar && (
          <Link href="/alimentacao/adicionar" className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100">
            Acrescentar refeição
          </Link>
        )}
      </div>
      {aviso === 'acrescimo' && (
        <div className="mt-4">
          <Alerta tipo="sucesso">Acréscimo de refeição enviado ao painel da Assistência Estudantil.</Alerta>
        </div>
      )}

      <section aria-labelledby="pendentes" className="mt-6">
        <h2 id="pendentes" className="text-lg font-semibold text-slate-900">
          Avisos aguardando ciência {pendentes.length > 0 && <span className="font-normal">({pendentes.length})</span>}
        </h2>
        {pendentes.length === 0 ? (
          <p className="mt-2 text-slate-700">Nenhum aviso pendente.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pendentes.map((a) => {
              const emergencia = a.nivelSla === 'VERMELHO_MENOS_4H';
              return (
                <li
                  key={a.id}
                  className={`rounded-lg border p-4 shadow-sm ${emergencia ? 'border-if-vermelho-700 bg-if-vermelho-50' : 'border-slate-200 bg-white'}`}
                >
                  <p className="font-semibold text-slate-900">
                    {emergencia && <span className="text-if-vermelho-700">EMERGÊNCIA · </span>}
                    {a.acao === 'CANCELAR_REFEICAO' ? 'Cancelar' : 'Adicionar'} {NOME_REFEICAO_HORARIO[a.tipoRefeicao]} — {a.turma.codigo}
                  </p>
                  <p className="text-slate-800">
                    {formatarData(dataLocal(a.dataRefeicao))} · {a.qtdImpactada} estudante(s) · {ETIQUETA_SLA[a.nivelSla]}
                  </p>
                  {a.descricao && <p className="text-sm text-slate-700">Atividade: {a.descricao}</p>}
                  {emergencia && (
                    <p className="mt-1 text-sm font-semibold text-if-vermelho-700">
                      <span aria-hidden="true">☎ </span>Menos de 4h para a refeição: a Coordenação também deve ligar para a Assistência Estudantil (G06).
                    </p>
                  )}
                  {podeConfirmar && (
                    <div className="mt-3">
                      <FormularioCiencia alertaId={a.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="previsao" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="previsao" className="text-lg font-semibold text-slate-900">
            Previsão de {formatarData(data)}
            {dia.diaSemana !== null && (
              <span className="font-normal">
                {' '}
                ({NOME_DIA_EXTENSO[dia.diaSemana]}
                {dia.sabadoLetivo ? ', sábado letivo' : ''})
              </span>
            )}
          </h2>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <Campo id="data" rotulo="Outra data" type="date" defaultValue={data} />
            <BotaoSecundario type="submit">Ver</BotaoSecundario>
          </form>
        </div>
        <p className="mt-1 text-sm text-slate-700">
          <Link href={`/alimentacao?data=${somarDias(data, -1)}`} className="text-if-verde-700 underline underline-offset-2">
            ← Dia anterior
          </Link>
          {' · '}
          <Link href={`/alimentacao?data=${somarDias(data, 1)}`} className="text-if-verde-700 underline underline-offset-2">
            Próximo dia →
          </Link>
        </p>
        {dia.diaSemana === null ? (
          <div className="mt-3">
            <Alerta tipo="info">
              {dia.suspensao
                ? `Sem aula nesta data pelo calendário acadêmico: ${dia.suspensao.descricao}.`
                : 'Sem aula nesta data (fim de semana sem sábado letivo cadastrado).'}
            </Alerta>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Refeições previstas por turma em {formatarData(data)}, já com as alterações avisadas</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Turma</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Turnos</th>
                  {REFEICOES.map((r) => (
                    <th key={r} scope="col" className="px-4 py-3 text-right font-semibold">
                      {NOME_REFEICAO_HORARIO[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previsoes.map((p) => (
                  <tr key={p.turma.id}>
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {p.turma.codigo}
                    </th>
                    <td className="px-4 py-3">{turnos(p.presenca)}</td>
                    {REFEICOES.map((r) => (
                      <td key={r} className="px-4 py-3 text-right tabular-nums">
                        {p.final[r]}
                        {p.final[r] !== p.base[r] && (
                          <span className="block text-xs font-semibold text-amber-900">
                            <span aria-hidden="true">⚠ </span>alterado (previsto {p.base[r]})
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-300 bg-slate-50 font-semibold">
                <tr>
                  <th scope="row" className="px-4 py-3" colSpan={2}>
                    Total
                  </th>
                  {REFEICOES.map((r) => (
                    <td key={r} className="px-4 py-3 text-right tabular-nums">
                      {total[r]}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="avisos-dia" className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="avisos-dia" className="text-lg font-semibold text-slate-900">Avisos de {formatarData(data)}</h2>
          {podeComunicar && avisosDoDia.some((a) => !a.canceladoEm) && (
            <Link
              href={`/alimentacao/comunicar?data=${data}`}
              className="inline-flex min-h-11 items-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800"
            >
              Comunicar alterações do dia
            </Link>
          )}
        </div>
        {avisosDoDia.length === 0 ? (
          <p className="mt-2 text-slate-700">Nenhum aviso para esta data.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {avisosDoDia.map((a) => (
              <li key={a.id} className={`rounded-lg border p-4 ${a.canceladoEm ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-slate-200 bg-white shadow-sm'}`}>
                <p className="font-semibold">
                  {a.turma.codigo} · {a.acao === 'CANCELAR_REFEICAO' ? 'Cancelar' : 'Adicionar'} {NOME_REFEICAO_HORARIO[a.tipoRefeicao]} · {a.qtdImpactada}{' '}
                  estudante(s)
                </p>
                {a.descricao && <p className="text-sm">Atividade: {a.descricao}</p>}
                <p className="text-sm">
                  {ETIQUETA_SLA[a.nivelSla]} ·{' '}
                  {a.canceladoEm ? (
                    <>
                      <span aria-hidden="true">↺ </span>Aviso cancelado: refeição mantida como na grade
                    </>
                  ) : a.confirmadoAE ? (
                    <>
                      <span aria-hidden="true">✔ </span>Ciência da Assistência Estudantil
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">⏳ </span>Aguardando ciência
                    </>
                  )}
                </p>
                {podeAjustar && !a.canceladoEm && a.dataRefeicao >= agora && (
                  <div className="mt-3 flex flex-wrap items-end gap-4">
                    <FormularioQuantidade alertaId={a.id} quantidade={a.qtdImpactada} />
                    {a.manual && <FormularioCancelarAcrescimo alertaId={a.id} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
