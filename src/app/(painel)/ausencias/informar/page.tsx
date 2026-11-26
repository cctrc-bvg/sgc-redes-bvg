import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta, BotaoSecundario, Campo } from '@/components/campo';
import { exigirPermissao } from '@/lib/auth/dal';
import { ConsultaAusenciaSchema, formatarData, hojeEmFortaleza, MOTIVOS_OPERACIONAIS } from '@/lib/ausencias/regras';
import { ORIENTACAO_GESTAO_PESSOAS } from '@/lib/ausencias/mensagens';
import { aulasParaRegistro } from '@/lib/ausencias/opcoes';
import { FormularioRegistro } from '../nova/formulario-registro';

export const metadata: Metadata = { title: 'Informar ausência — SGC-Redes' };

/**
 * RF02-A (decisão G15): o docente informa a própria ausência. Entra como "Aguardando decisão" para a Coordenação,
 * que dá ciência e decide a ocupação dos horários. Motivo só operacional; o pessoal e o comprovante vão à Gestão de Pessoas.
 */
export default async function PaginaInformarAusencia({ searchParams }: { searchParams: Promise<{ data?: string; ate?: string }> }) {
  const { usuario } = await exigirPermissao('ausencias:informar');
  const params = await searchParams;
  const hoje = hojeEmFortaleza();
  const enviada = params.data !== undefined;
  const consulta = ConsultaAusenciaSchema.safeParse({ professorId: usuario.id, data: params.data ?? '' });
  const dataEscolhida = consulta.success ? consulta.data.data : (params.data ?? hoje);
  const opcoes = consulta.success ? await aulasParaRegistro(usuario.id, consulta.data.data, params.ate) : null;
  const erroData = enviada && !consulta.success ? consulta.error.issues.filter((i) => i.path[0] === 'data').map((i) => i.message) : [];
  const erroPeriodo = opcoes?.erroPeriodo ?? null;
  const pertoDemais = consulta.success && consulta.data.data <= hoje;

  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/grade/minha" className="text-if-verde-700 underline underline-offset-2">
          Minha grade
        </Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Informar ausência</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Informar minha ausência</h1>
      <p className="mt-1 text-slate-700">
        Escolha a data (ou o período) e as aulas. A Coordenação recebe o aviso na tela inicial, dá ciência e organiza a ocupação dos horários; você acompanha em
        Minha grade.
      </p>
      <div className="mt-4">
        <Alerta tipo="info">{ORIENTACAO_GESTAO_PESSOAS}</Alerta>
      </div>

      <section aria-labelledby="etapa1" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="etapa1" className="mb-4 text-lg font-semibold text-slate-900">1. Quando</h2>
        <form method="get" className="grid gap-5 sm:grid-cols-[auto_auto_auto] sm:items-end" noValidate>
          <Campo id="data" rotulo="Data" type="date" defaultValue={dataEscolhida} erros={erroData.length ? erroData : undefined} />
          <Campo
            id="ate"
            rotulo="Até (opcional)"
            type="date"
            defaultValue={params.ate ?? ''}
            erros={erroPeriodo ? [erroPeriodo] : undefined}
            dica="Vários dias (até 15)"
          />
          <BotaoSecundario type="submit">Ver minhas aulas</BotaoSecundario>
        </form>
      </section>

      {opcoes && !erroPeriodo && (
        <section aria-labelledby="etapa2" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="etapa2" className="mb-1 text-lg font-semibold text-slate-900">
            2. Minhas aulas {opcoes.varios ? `de ${formatarData(opcoes.datas[0])} a ${formatarData(opcoes.datas.at(-1)!)}` : `em ${formatarData(opcoes.datas[0])}`}
          </h2>
          {pertoDemais && (
            <div className="my-3">
              <Alerta tipo="erro">Ausência para hoje: além de informar aqui, ligue para a Coordenação, para dar tempo de organizar a ocupação dos horários e as refeições.</Alerta>
            </div>
          )}
          {opcoes.comAulasLivres.length === 0 ? (
            <Alerta tipo="info">
              {opcoes.dias.some((d) => d.aulas.length > 0)
                ? 'Todas as suas aulas nesta data já têm ausência registrada. Acompanhe em Minha grade.'
                : 'Você não tem aula na grade nesta data (ou é feriado ou fim de semana sem sábado letivo).'}
            </Alerta>
          ) : (
            <FormularioRegistro
              modo="informar"
              professorId={usuario.id}
              data={opcoes.datas[0]}
              ate={opcoes.varios ? opcoes.datas.at(-1) : undefined}
              dias={opcoes.comAulasLivres}
              motivos={MOTIVOS_OPERACIONAIS}
            />
          )}
        </section>
      )}
    </div>
  );
}
