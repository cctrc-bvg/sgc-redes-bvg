import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta } from '@/components/campo';
import { Icone } from '@/components/icone';
import { exigirUsuario } from '@/lib/auth/dal';
import { NOME_PERFIL, temPermissao } from '@/lib/auth/rbac';
import { hojeEmFortaleza } from '@/lib/ausencias/regras';
import { carregarAno } from '@/lib/calendario/servidor';
import { FUNCOES_DA_CONTA, funcoesPorGrupo, type NomeIcone } from '@/lib/navegacao';
import { separarAcoes, type AcaoPrioritaria, type NivelAcao } from '@/lib/painel/acoes';
import { periodoCurto, proximosEventos, tituloDoEvento, type DiaDaAgenda, type EventoAgenda } from '@/lib/painel/agenda';
import { acoesDoPainel, semanaDoDocente } from '@/lib/painel/servidor';
import { NOME_TIPO_EVENTO } from '@/lib/calendario/regras';
import { montarDias } from '../calendario/dias';
import { MesCompacto } from '../calendario/mes';

export const metadata: Metadata = { title: 'Início — SGC-Redes' };

const ESTILO_NIVEL: Record<NivelAcao, { faixa: string; selo: string; rotulo: string }> = {
  urgente: { faixa: 'border-l-if-vermelho-700', selo: 'bg-if-vermelho-50 text-if-vermelho-700', rotulo: 'Urgente' },
  atencao: { faixa: 'border-l-amber-500', selo: 'bg-amber-100 text-amber-900', rotulo: 'Atenção' },
  acompanhar: { faixa: 'border-l-slate-300', selo: 'bg-slate-100 text-slate-700', rotulo: 'Acompanhar' },
};

/**
 * Tela inicial: primeiro o que precisa de atenção agora; as demais funções ficam num menu que abre com um clique
 * (aberto de início quando não há nada pendente); ao lado, a agenda do perfil (semana do docente ou mês).
 */
export default async function PaginaPainel({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { usuario } = await exigirUsuario();
  const { aviso } = await searchParams;
  const hoje = hojeEmFortaleza();
  // Docente (sem a gestão de ausências) vê a própria semana; os demais perfis, o mês do calendário acadêmico.
  const agendaDaSemana = temPermissao(usuario.role, 'substituicao:responder') && !temPermissao(usuario.role, 'ausencias:registrar');
  const [acoes, semana, ano] = await Promise.all([
    acoesDoPainel(usuario),
    agendaDaSemana ? semanaDoDocente(usuario.id, hoje) : Promise.resolve(null),
    agendaDaSemana ? Promise.resolve(null) : carregarAno(Number(hoje.slice(0, 4))),
  ]);
  const { agir, acompanhar } = separarAcoes(acoes);
  const grupos = funcoesPorGrupo(usuario.role);
  const totalFuncoes = grupos.reduce((n, g) => n + g.funcoes.length, 0) + FUNCOES_DA_CONTA.length;
  const primeiroNome = usuario.nome.split(' ')[0];
  const extenso = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Fortaleza' }).format(new Date());
  const dataPorExtenso = extenso.charAt(0).toUpperCase() + extenso.slice(1);

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Olá, {primeiroNome}</h1>
      <p className="mt-1 text-slate-700">
        {dataPorExtenso} · {NOME_PERFIL[usuario.role]}
      </p>

      {aviso === 'sem-permissao' && (
        <div className="mt-4">
          <Alerta tipo="erro">Seu perfil não tem acesso à página solicitada. Se precisar dela, fale com a Coordenação.</Alerta>
        </div>
      )}

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="atencao">
            <h2 id="atencao" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Icone nome={agir.length > 0 ? 'alerta' : 'ok'} className={`size-5 ${agir.length > 0 ? 'text-amber-700' : 'text-if-verde-700'}`} />
              {agir.length > 0 ? 'Precisa da sua atenção' : 'Tudo em dia'}
            </h2>
            {agir.length > 0 ? (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {agir.map((a) => (
                  <CartaoAcao key={a.id} acao={a} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-slate-700">Nenhuma pendência para você agora. Escolha abaixo o que deseja fazer.</p>
            )}
            {acompanhar.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-700">Para acompanhar</h3>
                <ul className="mt-1 space-y-1">
                  {acompanhar.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-2 text-sm text-slate-700">
                      <Icone nome={a.icone} className="size-4 text-slate-500" />
                      <span>
                        <strong className="font-semibold text-slate-900">{a.quantidade}</strong> {a.titulo.charAt(0).toLowerCase() + a.titulo.slice(1)}
                      </span>
                      <Link href={a.href} className="text-if-verde-700 underline underline-offset-2">
                        {a.botao}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Sem JavaScript: <details> abre e fecha nativamente. Aberto de início quando não há pendências. */}
          <details id="funcoes" open={agir.length === 0} className="group rounded-lg border border-slate-200 bg-white shadow-sm">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <Icone nome="funcoes" className="size-5 text-if-verde-700" />
              <span className="flex-1">
                Todas as funções <span className="font-normal text-slate-600">({totalFuncoes})</span>
              </span>
              <span aria-hidden="true" className="text-slate-500 transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="space-y-5 border-t border-slate-200 px-4 py-4">
              {grupos.map((g) => (
                <GrupoDeFuncoes key={g.grupo} titulo={g.grupo} funcoes={g.funcoes} />
              ))}
              <GrupoDeFuncoes titulo="Sua conta" funcoes={FUNCOES_DA_CONTA} />
            </div>
          </details>
        </div>

        <aside aria-labelledby="agenda" className="min-w-0 space-y-3">
          {semana ? (
            <SemanaDoDocente dias={semana} />
          ) : ano ? (
            <MesDoCalendario ano={ano} hoje={hoje} />
          ) : null}
        </aside>
      </div>
    </>
  );
}

function CartaoAcao({ acao: a }: { acao: AcaoPrioritaria }) {
  const estilo = ESTILO_NIVEL[a.nivel];
  return (
    <li className={`flex flex-col gap-2 rounded-lg border border-l-4 border-slate-200 bg-white p-4 shadow-sm ${estilo.faixa}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Icone nome={a.icone} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-bold tabular-nums text-slate-900">{a.quantidade}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estilo.selo}`}>{estilo.rotulo}</span>
          </p>
          <p className="font-semibold text-slate-900">{a.titulo}</p>
        </div>
      </div>
      <p className="flex-1 text-sm text-slate-700">{a.detalhe}</p>
      <Link
        href={a.href}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-if-verde-700 px-4 font-semibold text-white hover:bg-if-verde-800"
      >
        {a.botao}
        <span className="sr-only">: {a.titulo}</span>
      </Link>
    </li>
  );
}

function GrupoDeFuncoes({ titulo, funcoes }: { titulo: string; funcoes: readonly { id: string; href: string; rotulo: string; descricao: string; icone: NomeIcone }[] }) {
  return (
    <section aria-label={titulo}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{titulo}</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {funcoes.map((f) => (
          <li key={f.id}>
            <Link href={f.href} className="flex min-h-14 items-start gap-3 rounded-md border border-slate-200 p-3 hover:border-if-verde-700 hover:bg-if-verde-50">
              <span className="flex size-9 items-center justify-center rounded-md bg-if-verde-50 text-if-verde-800">
                <Icone nome={f.icone} className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-if-verde-800">{f.rotulo}</span>
                <span className="block text-sm text-slate-600">{f.descricao}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SemanaDoDocente({ dias }: { dias: DiaDaAgenda[] }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="agenda" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Icone nome="minha-grade" className="size-5 text-if-verde-700" />
          Minha semana
        </h2>
        <Link href="/grade/minha" className="text-sm text-if-verde-700 underline underline-offset-2">
          Grade completa
        </Link>
      </div>
      <ol className="space-y-2">
        {dias.map((d) => (
          <li
            key={d.dataISO}
            aria-current={d.ehHoje ? 'date' : undefined}
            className={`rounded-lg border bg-white p-3 shadow-sm ${d.ehHoje ? 'border-if-verde-700 ring-1 ring-if-verde-700' : 'border-slate-200'}`}
          >
            <p className="flex items-center justify-between gap-2 font-semibold text-slate-900">
              <span>{d.rotulo}</span>
              {d.ehHoje && <span className="rounded-full bg-if-verde-50 px-2 py-0.5 text-xs font-semibold text-if-verde-800">Hoje</span>}
            </p>
            {d.gradeDe && <p className="text-xs text-slate-600">Sábado letivo: grade de {d.gradeDe}</p>}
            {d.semAula && <p className="mt-1 text-sm text-slate-600">{d.semAula}</p>}
            {d.eventos.map((e) => (
              <p key={e} className="mt-1 text-sm text-slate-700">
                <Icone nome="calendario" className="mr-1 inline size-4 align-[-2px] text-slate-500" />
                {e}
              </p>
            ))}
            {d.aulas.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-sm">
                {d.aulas.map((a) => (
                  <li key={a.horario} title={a.horario} className={`flex gap-2 ${a.ausente ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                    <span className="w-11 shrink-0 font-semibold tabular-nums">{a.inicio}</span>
                    <span>
                      {a.turma} · {a.disciplina}
                    </span>
                    {a.ausente && <span className="sr-only"> (ausência registrada)</span>}
                  </li>
                ))}
              </ul>
            )}
            {d.mudancas.map((m) => (
              <p key={`${m.bloco}-${m.tipo}`} className="mt-1 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">
                {m.tipo === 'substituicao' ? 'Substituição' : 'Aula adiantada'}: {m.bloco} · {m.turma}
              </p>
            ))}
            {!d.semAula && d.aulas.length === 0 && d.mudancas.length === 0 && <p className="mt-1 text-sm text-slate-600">Sem aulas suas neste dia.</p>}
          </li>
        ))}
      </ol>
    </>
  );
}

function MesDoCalendario({ ano, hoje }: { ano: Awaited<ReturnType<typeof carregarAno>>; hoje: string }) {
  const mes = Number(hoje.slice(5, 7));
  const dias = montarDias(ano);
  const letivosNoMes = ano.contagem.letivos.filter((d) => d.slice(5, 7) === hoje.slice(5, 7)).length;
  const eventos: EventoAgenda[] = ano.eventos.map((e) => ({
    inicio: e.inicio,
    fim: e.fim,
    titulo: tituloDoEvento(NOME_TIPO_EVENTO[e.tipo], e.descricao),
    suspende: e.suspendeAulas,
  }));
  const proximos = proximosEventos(eventos, hoje);
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="agenda" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Icone nome="calendario" className="size-5 text-if-verde-700" />
          Calendário
        </h2>
        <Link href={`/calendario?ano=${ano.ano}&mes=${mes}`} className="text-sm text-if-verde-700 underline underline-offset-2">
          Abrir calendário
        </Link>
      </div>
      <MesCompacto ano={ano.ano} mes={mes} dias={dias} letivos={letivosNoMes} hoje={hoje} />
      <section aria-labelledby="proximos" className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h3 id="proximos" className="text-sm font-semibold text-slate-900">
          Próximos 30 dias
        </h3>
        {proximos.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">Nenhum evento no calendário.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {proximos.map((e) => (
              <li key={`${e.inicio}-${e.titulo}`} className="flex gap-2">
                <span className="w-[6.5rem] shrink-0 tabular-nums text-slate-600">{periodoCurto(e)}</span>
                <span className={e.suspende ? 'text-slate-900' : 'text-slate-700'}>
                  {e.titulo}
                  {e.suspende && <span className="ml-1 text-xs font-semibold text-slate-600">(sem aula)</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
