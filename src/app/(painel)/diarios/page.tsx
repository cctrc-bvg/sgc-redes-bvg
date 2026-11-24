import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alerta } from '@/components/campo';
import { SeletorPeriodo } from '@/components/quadro-grade';
import { prisma } from '@/lib/db';
import { exigirUsuario } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { dataDoBanco, formatarData, hojeEmFortaleza } from '@/lib/ausencias/regras';
import { aulasEsperadas, NOME_SEMAFORO, ORDEM_SEMAFORO, percentual, semaforo, type Semaforo } from '@/lib/diarios/regras';
import { anosDoSeletor, periodoDaUrl } from '@/lib/grade/regras';
import { FormularioPeriodo } from './formularios';

export const metadata: Metadata = { title: 'Diários — SGC-Redes' };

export default async function PaginaDiarios({ searchParams }: { searchParams: Promise<{ ano?: string; sem?: string }> }) {
  const { usuario } = await exigirUsuario();
  const verTodos = temPermissao(usuario.role, 'diarios:ver-todos');
  if (!verTodos && !temPermissao(usuario.role, 'diarios:ver-proprios')) redirect('/painel?aviso=sem-permissao');
  const { anoLetivo, semestreLetivo } = periodoDaUrl(await searchParams);
  const hoje = hojeEmFortaleza();

  const [ofertas, periodos] = await Promise.all([
    prisma.disciplinaOferta.findMany({
      where: {
        anoLetivo,
        OR: [{ semestreLetivo: null }, { semestreLetivo }],
        ...(verTodos ? {} : { professorId: usuario.id }),
      },
      select: {
        id: true,
        semestreLetivo: true,
        aulasPrevistas: true,
        aulasMinistradas: true,
        diarioEmDia: true,
        ultimaCobranca: true,
        turma: { select: { codigo: true } },
        disciplina: { select: { nome: true } },
        professor: { select: { nome: true } },
      },
    }),
    prisma.periodoLetivo.findMany({ where: { anoLetivo } }),
  ]);
  const periodo = (s: number) => periodos.find((p) => p.semestreLetivo === s);
  const atual = periodo(semestreLetivo);
  // Anuais usam o ano inteiro (início do 1º ao fim do 2º semestre); técnicas, o próprio semestre.
  const janela = (semestreDaOferta: number | null) => {
    if (semestreDaOferta === null) {
      const p1 = periodo(1);
      const p2 = periodo(2);
      return p1 && p2 ? { inicio: dataDoBanco(p1.inicio), fim: dataDoBanco(p2.fim) } : null;
    }
    const p = periodo(semestreDaOferta);
    return p ? { inicio: dataDoBanco(p.inicio), fim: dataDoBanco(p.fim) } : null;
  };

  const linhas = ofertas
    .map((o) => {
      const j = janela(o.semestreLetivo);
      const esperadas = j ? aulasEsperadas(o.aulasPrevistas, j.inicio, j.fim, hoje) : null;
      return { ...o, esperadas, situacao: semaforo(o, esperadas) };
    })
    .sort((a, b) => ORDEM_SEMAFORO[a.situacao] - ORDEM_SEMAFORO[b.situacao] || a.turma.codigo.localeCompare(b.turma.codigo) || a.disciplina.nome.localeCompare(b.disciplina.nome, 'pt-BR'));
  const contagem = (s: Semaforo) => linhas.filter((l) => l.situacao === s).length;

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{verTodos ? 'Diários e carga horária' : 'Meus diários'}</h1>
      <p className="mt-1 text-slate-700">
        Aulas ministradas × previstas por disciplina e turma (RF08), conforme o diário no sistema acadêmico.
      </p>
      <div className="mt-4">
        <SeletorPeriodo anoLetivo={anoLetivo} semestreLetivo={semestreLetivo} anos={anosDoSeletor(anoLetivo)} />
      </div>

      {verTodos && (
        <section aria-labelledby="periodo" className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="periodo" className="font-semibold text-slate-900">
            Calendário de {anoLetivo}.{semestreLetivo}
          </h2>
          <p className="mb-3 mt-1 text-sm text-slate-700">
            {atual
              ? `De ${formatarData(dataDoBanco(atual.inicio))} a ${formatarData(dataDoBanco(atual.fim))}. As aulas esperadas até hoje são proporcionais ao tempo decorrido.`
              : 'Informe o início e o fim do semestre para o semáforo comparar com as aulas esperadas até hoje (anuais precisam dos dois semestres).'}
          </p>
          <FormularioPeriodo
            anoLetivo={anoLetivo}
            semestreLetivo={semestreLetivo}
            inicio={atual ? dataDoBanco(atual.inicio) : ''}
            fim={atual ? dataDoBanco(atual.fim) : ''}
          />
        </section>
      )}

      {linhas.length === 0 ? (
        <div className="mt-6">
          <Alerta tipo="info">Nenhuma disciplina ofertada neste período{verTodos ? '' : ' para você'}.</Alerta>
        </div>
      ) : (
        <>
          <p className="mt-6 flex flex-wrap gap-2" role="status">
            {(['atrasado', 'atencao', 'em-dia', 'concluida'] as const).map((s) => (
              <span key={s} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${NOME_SEMAFORO[s].classe}`}>
                <span aria-hidden="true">{NOME_SEMAFORO[s].icone}</span> {NOME_SEMAFORO[s].texto}: {contagem(s)}
              </span>
            ))}
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <caption className="sr-only">Situação dos diários por disciplina e turma, do que precisa de atenção ao que está em dia</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Disciplina</th>
                  {verTodos && <th scope="col" className="px-4 py-3 font-semibold">Docente</th>}
                  <th scope="col" className="px-4 py-3 font-semibold">Aulas</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Esperadas até hoje</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((l) => {
                  const pct = percentual(l.aulasMinistradas, l.aulasPrevistas);
                  const s = NOME_SEMAFORO[l.situacao];
                  return (
                    <tr key={l.id}>
                      <th scope="row" className="px-4 py-3 font-normal">
                        {verTodos ? (
                          <Link href={`/diarios/${l.id}`} className="font-semibold text-if-verde-700 underline underline-offset-2 hover:text-if-verde-800">
                            {l.disciplina.nome}
                          </Link>
                        ) : (
                          <span className="font-semibold">{l.disciplina.nome}</span>
                        )}
                        <span className="block text-slate-600">
                          {l.turma.codigo} · {l.semestreLetivo ? `${anoLetivo}.${l.semestreLetivo}` : 'anual'}
                        </span>
                      </th>
                      {verTodos && <td className="px-4 py-3">{l.professor.nome}</td>}
                      <td className="px-4 py-3">
                        <span className="tabular-nums">
                          {l.aulasMinistradas} de {l.aulasPrevistas} ({pct}%)
                        </span>
                        <span className="mt-1 block h-2 w-32 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                          <span className="block h-full bg-if-verde-700" style={{ width: `${pct}%` }} />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.esperadas ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.classe}`}>
                          <span aria-hidden="true">{s.icone}</span> {s.texto}
                        </span>
                        {verTodos && l.ultimaCobranca && (
                          <span className="block text-xs text-slate-600">Lembrete em {formatarData(hojeEmFortaleza(l.ultimaCobranca))}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
