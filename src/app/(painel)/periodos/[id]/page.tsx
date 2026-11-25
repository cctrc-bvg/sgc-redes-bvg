import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alerta } from '@/components/campo';
import { CaixaMensagem } from '@/components/caixa-mensagem';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { descreverBloco, formatarData } from '@/lib/ausencias/regras';
import { mensagemAvulsa } from '@/lib/comunicacao/servidor';
import { NOME_DIA, DIAS_SEMANA } from '@/lib/grade/regras';
import { mensagemPlanoAlimentar, NOME_TIPO_PERIODO } from '@/lib/periodos/regras';
import { carregarPeriodo } from '@/lib/periodos/servidor';
import { copiarGradeNormal, excluirPeriodo, removerGradeEspecial } from '../actions';
import { FormularioEnvioPeriodo, FormularioGradeEspecial, FormularioPresencas } from '../formularios';

export const metadata: Metadata = { title: 'Período especial — SGC-Redes' };

const botao = 'inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100';

export default async function PaginaPeriodo({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await exigirPermissao('calendario:ver');
  const gerencia = temPermissao(usuario, 'calendario:gerenciar');
  const { id } = await params;
  const d = await carregarPeriodo(id);
  if (!d) notFound();
  const { periodo } = d;
  const comGrade = new Set(d.celulas.map((c) => c.turmaId));
  const blocos = d.blocos.map((b) => ({ id: b.id, rotulo: descreverBloco(b), turno: b.turno }));
  const dias = DIAS_SEMANA.map((n) => ({ numero: n, nome: NOME_DIA[n]! }));
  const valoresPresenca = Object.fromEntries(d.presencas.map((p) => [`presenca:${p.turmaId}:${p.data}`, p.qtdAlunos]));
  const texto = mensagemPlanoAlimentar({ nome: periodo.nome, inicio: periodo.inicio, fim: periodo.fim, plano: d.plano });
  const assunto = `[SGC-Redes] Refeições — ${periodo.nome}`;
  const verResumo = d.plano.length > 0 && temPermissao(usuario, 'alimentacao:ver');
  const destinos = verResumo || gerencia ? await Promise.all((['ASSISTENCIA_ESTUDANTIL', 'NUTRICIONISTA'] as const).map(async (c) => [c, await mensagemAvulsa(`canal:${c}`, assunto, texto)] as const)) : [];

  return (
    <div className="max-w-5xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/periodos" className="text-if-verde-700 underline underline-offset-2">Períodos especiais</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{periodo.nome}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{periodo.nome}</h1>
      <p className="mt-1 text-slate-700">
        {NOME_TIPO_PERIODO[periodo.tipo]} · {formatarData(periodo.inicio)} a {formatarData(periodo.fim)} · {d.dias.length} dia(s) de aula
        {periodo.observacao && <> · {periodo.observacao}</>}
      </p>
      <p className="mt-2 max-w-3xl text-sm text-slate-700">
        Nos dias do período, a <strong>grade especial</strong> de uma turma vale no lugar da grade normal (ausências, refeições e agenda dos docentes). Turmas
        sem grade especial seguem a grade normal.
      </p>
      {d.dias.length === 0 && (
        <div className="mt-3">
          <Alerta tipo="info">Nenhum dia letivo neste intervalo (feriado, suspensão ou fora do período letivo). Confira as datas.</Alerta>
        </div>
      )}

      <section aria-labelledby="grades" className="mt-8">
        <h2 id="grades" className="text-lg font-semibold text-slate-900">Grade especial por turma</h2>
        <ul className="mt-3 space-y-3">
          {d.turmas.map((t) => {
            const ofertas = d.ofertas.filter((o) => o.turmaId === t.id).map((o) => ({ id: o.id, rotulo: `${o.disciplina.nome} (${o.professor.nome.split(' ')[0]})` }));
            const valores = Object.fromEntries(d.celulas.filter((c) => c.turmaId === t.id && c.ofertaId).map((c) => [`celula:${c.diaSemana}:${c.blocoId}`, c.ofertaId!]));
            return (
              <li key={t.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{t.nome} <span className="font-normal text-slate-600">({t.codigo})</span></p>
                  <span className="text-sm text-slate-700">{comGrade.has(t.id) ? '✔ Com grade especial' : 'Segue a grade normal'}</span>
                </div>
                {gerencia && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-if-verde-700">{comGrade.has(t.id) ? 'Editar a grade especial' : 'Montar a grade especial'}</summary>
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap gap-3">
                        <form action={copiarGradeNormal}>
                          <input type="hidden" name="periodoId" value={periodo.id} />
                          <input type="hidden" name="turmaId" value={t.id} />
                          <button type="submit" className={botao}>Copiar a grade normal como ponto de partida</button>
                        </form>
                        {comGrade.has(t.id) && (
                          <form action={removerGradeEspecial}>
                            <input type="hidden" name="periodoId" value={periodo.id} />
                            <input type="hidden" name="turmaId" value={t.id} />
                            <button type="submit" className={botao}>Voltar para a grade normal</button>
                          </form>
                        )}
                      </div>
                      <FormularioGradeEspecial periodoId={periodo.id} turmaId={t.id} blocos={blocos} ofertas={ofertas} valores={valores} dias={dias} />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {gerencia && d.dias.length > 0 && (
        <section aria-labelledby="presentes" className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="presentes" className="mb-1 text-lg font-semibold text-slate-900">Estudantes no campus</h2>
          <p className="mb-4 text-sm text-slate-700">Quantos estudantes de cada turma ficam no campus em cada dia (os demais estão no evento).</p>
          <FormularioPresencas periodoId={periodo.id} turmas={d.turmas.map((t) => ({ id: t.id, codigo: t.codigo, ativos: t.qtdAlunosAtivos }))} dias={d.dias} valores={valoresPresenca} />
        </section>
      )}

      <section aria-labelledby="refeicoes" className="mt-8">
        <h2 id="refeicoes" className="text-lg font-semibold text-slate-900">Resumo de refeições</h2>
        {d.plano.length === 0 ? (
          <p className="mt-2 text-slate-700">O resumo aparece quando alguma turma tiver grade especial e o período tiver dia letivo.</p>
        ) : (
          <>
            <p className="mt-1 max-w-3xl text-sm text-slate-700">
              Refeições pela regra do campus (só manhã: lanche da manhã; só tarde: lanche da tarde; integral: os três) sobre a grade especial, vezes os
              estudantes presentes. Entre parênteses, o normal das mesmas turmas.
            </p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <caption className="sr-only">Refeições por dia no período especial</caption>
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Dia</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Lanche da manhã</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Almoço</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Lanche da tarde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.plano.map((l) => (
                    <tr key={l.data}>
                      <th scope="row" className="px-4 py-3 font-normal">{formatarData(l.data)}</th>
                      <td className="px-4 py-3 text-right tabular-nums">{l.total.LANCHE_MANHA} <span className="text-slate-600">({l.totalNormal.LANCHE_MANHA})</span></td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.total.ALMOCO} <span className="text-slate-600">({l.totalNormal.ALMOCO})</span></td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.total.LANCHE_TARDE} <span className="text-slate-600">({l.totalNormal.LANCHE_TARDE})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {gerencia &&
              destinos.map(([canal, m]) =>
                m ? (
                  <div key={canal} className="mt-4">
                    <CaixaMensagem mensagem={m} mostrarWhatsapp={usuario.usaWhatsapp}>
                      <FormularioEnvioPeriodo periodoId={periodo.id} canal={canal} mostrarWhatsapp={usuario.usaWhatsapp} />
                    </CaixaMensagem>
                  </div>
                ) : (
                  <p key={canal} className="mt-4 text-sm text-slate-700">O contato de {canal === 'ASSISTENCIA_ESTUDANTIL' ? 'Assistência Estudantil' : 'nutricionista'} não está ativo em Comunicação: cadastre para gerar a mensagem.</p>
                ),
              )}
          </>
        )}
      </section>

      {gerencia && (
        <form action={excluirPeriodo} className="mt-10 border-t border-slate-200 pt-4">
          <input type="hidden" name="periodoId" value={periodo.id} />
          <button type="submit" className={botao}>Excluir este período (apaga a grade especial e os presentes)</button>
        </form>
      )}
    </div>
  );
}
