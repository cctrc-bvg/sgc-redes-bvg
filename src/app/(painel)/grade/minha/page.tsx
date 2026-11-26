import type { Metadata } from 'next';
import Link from 'next/link';
import { QuadroGrade, SeletorPeriodo, type ConteudoCelula } from '@/components/quadro-grade';
import { exigirPermissao } from '@/lib/auth/dal';
import { blocosOrdenados, celulasDoProfessor } from '@/lib/grade/consultas';
import { anosDoSeletor, chaveCelula, periodoDaUrl } from '@/lib/grade/regras';
import { dataDoBanco, dataParaBanco, descreverBloco, formatarData, hojeEmFortaleza, NOME_STATUS, somarDias } from '@/lib/ausencias/regras';
import { prisma } from '@/lib/db';
import { CancelarAusenciaInformada, RespostaConvite } from './convites';
import { Alerta } from '@/components/campo';
import { acumulaDocencia, ehDocente, temPermissao } from '@/lib/auth/rbac';
import { mudancasDoProfessor } from '@/lib/ausencias/servidor';
import { inicioDaSemana } from '@/lib/painel/agenda';
import { semanaDoDocente } from '@/lib/painel/servidor';
import { SemanaDoDocente } from '@/components/semana-docente';
import { validarDataISO } from '@/lib/alimentacao-engine';
import { AvisoSabados } from '../sabados/aviso';

export const metadata: Metadata = { title: 'Minha grade — SGC-Redes' };

export default async function PaginaMinhaGrade({ searchParams }: { searchParams: Promise<{ ano?: string; sem?: string; aviso?: string; semana?: string }> }) {
  const { usuario } = await exigirPermissao('grade:ver');
  const params = await searchParams;
  const { anoLetivo, semestreLetivo } = periodoDaUrl(params);
  const podeInformar = temPermissao(usuario, 'ausencias:informar');
  const hoje = hojeEmFortaleza();
  // Semana mostrada (segunda-feira): a da URL, se válida, ou a atual; as setas avançam e voltam de 7 em 7 dias.
  const segundaAtual = inicioDaSemana(hoje);
  const segundaDaUrl = (() => {
    try {
      validarDataISO(params.semana ?? '');
      return inicioDaSemana(params.semana!);
    } catch {
      return null;
    }
  })();
  const segunda = segundaDaUrl ?? segundaAtual;
  const [blocos, celulas, mudancas, semana] = await Promise.all([
    blocosOrdenados(),
    celulasDoProfessor(usuario.id, anoLetivo, semestreLetivo),
    mudancasDoProfessor(usuario.id, hoje, somarDias(hoje, 14)),
    ehDocente(usuario) ? semanaDoDocente(usuario.id, hoje, segunda) : Promise.resolve(null),
  ]);
  const hrefSemana = (iso: string) => `/grade/minha?ano=${anoLetivo}&sem=${semestreLetivo}&semana=${iso}#semana`;
  const convites = await prisma.conviteSubstituicao.findMany({
    where: { professorId: usuario.id, status: 'PENDENTE', ausencia: { dataAula: { gte: dataParaBanco(hoje) } } },
    orderBy: [{ ausencia: { dataAula: 'asc' } }],
    select: {
      id: true,
      bloco: true,
      ausencia: { select: { dataAula: true, turma: { select: { nome: true } }, oferta: { select: { disciplina: { select: { nome: true } } } } } },
    },
  });

  // Ausências do docente daqui para a frente (informadas por ele ou registradas pela Coordenação).
  const minhasAusencias = podeInformar
    ? await prisma.ausenciaDocente.findMany({
        where: { professorAusenteId: usuario.id, dataAula: { gte: dataParaBanco(hoje) } },
        orderBy: [{ dataAula: 'asc' }],
        select: {
          id: true,
          dataAula: true,
          blocosAfetados: true,
          status: true,
          informadaPeloDocente: true,
          turma: { select: { nome: true } },
          oferta: { select: { disciplina: { select: { nome: true } } } },
          _count: { select: { coberturas: true } },
        },
      })
    : [];

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
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="mt-1 text-slate-700">
          {celulas.length} aula(s) por semana em {new Set(celulas.map((c) => c.turma.nome)).size} turma(s).
        </p>
        {podeInformar && (
          <Link
            href="/ausencias/informar"
            className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-100"
          >
            Informar ausência
          </Link>
        )}
      </div>
      {params.aviso === 'ausencia-informada' && (
        <div className="mt-4">
          <Alerta tipo="sucesso">
            Ausência informada. A Coordenação vai dar ciência e organizar a ocupação dos horários; acompanhe a situação abaixo, em &quot;Minhas ausências&quot;.
          </Alerta>
        </div>
      )}
      {params.aviso === 'ausencia-cancelada' && (
        <div className="mt-4">
          <Alerta tipo="sucesso">Ausência cancelada. A Coordenação não precisa mais decidir a ocupação dos horários.</Alerta>
        </div>
      )}
      {minhasAusencias.length > 0 && (
        <section aria-labelledby="minhas-ausencias" className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <h2 id="minhas-ausencias" className="font-semibold text-slate-900">
            Minhas ausências ({minhasAusencias.length})
          </h2>
          <ul className="mt-2 space-y-3">
            {minhasAusencias.map((a) => {
              const descricao = `${formatarData(dataDoBanco(a.dataAula))} · ${a.blocosAfetados.split(',').join(', ')} · ${a.turma.nome} (${a.oferta.disciplina.nome})`;
              const cancelavel = a.informadaPeloDocente && a.status === 'PENDENTE_DECISAO' && a._count.coberturas === 0;
              return (
                <li key={a.id} className="space-y-1">
                  <p className="text-slate-800">
                    <span className="font-semibold">{descricao}</span>
                    <span className="block text-sm text-slate-600">
                      {NOME_STATUS[a.status]} · {a.informadaPeloDocente ? 'informada por você' : 'registrada pela Coordenação'}
                    </span>
                  </p>
                  {cancelavel && <CancelarAusenciaInformada ausenciaId={a.id} descricao={descricao} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {convites.length > 0 && (
        <section aria-labelledby="convites" className="mt-4 rounded-lg border border-if-verde-700 bg-if-verde-50 p-4">
          <h2 id="convites" className="font-semibold text-slate-900">Convites de substituição ({convites.length})</h2>
          <ul className="mt-2 space-y-3">
            {convites.map((c) => {
              const descricao = `${formatarData(dataDoBanco(c.ausencia.dataAula))} · ${descreverBloco(c.bloco)} · ${c.ausencia.turma.nome} (aula de ${c.ausencia.oferta.disciplina.nome})`;
              return (
                <li key={c.id} className="space-y-2">
                  <p className="text-slate-800">{descricao}</p>
                  <RespostaConvite conviteId={c.id} descricao={descricao} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {mudancas.length > 0 && (
        <section aria-labelledby="mudancas" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 id="mudancas" className="font-semibold text-slate-900">
            <span aria-hidden="true">⚠ </span>Mudanças nos próximos 14 dias
          </h2>
          <ul className="mt-2 space-y-1 text-slate-800">
            {mudancas.map((m) => (
              <li key={`${m.dataISO}-${m.bloco}-${m.tipo}`}>
                <Link href={hrefSemana(inicioDaSemana(m.dataISO))} className="font-semibold text-if-verde-800 underline underline-offset-2">
                  {formatarData(m.dataISO)} · {m.bloco} · {m.turma}:
                </Link>{' '}
                {m.detalhe}
              </li>
            ))}
          </ul>
        </section>
      )}
      {semana && (
        <div className="mt-6 max-w-3xl">
          <SemanaDoDocente
            dias={semana}
            acumula={acumulaDocencia(usuario)}
            navegacao={{
              anterior: hrefSemana(somarDias(segunda, -7)),
              proxima: hrefSemana(somarDias(segunda, 7)),
              atual: hrefSemana(segundaAtual),
              titulo: `Semana de ${formatarData(segunda).slice(0, 5)} a ${formatarData(somarDias(segunda, 4)).slice(0, 5)}`,
              ehSemanaAtual: segunda === segundaAtual,
            }}
          />
          <p className="mt-2 text-sm text-slate-600">
            Mostra as suas aulas de cada dia, com as substituições aceitas e as aulas adiantadas. Use as setas para ver as outras semanas.
          </p>
        </div>
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
