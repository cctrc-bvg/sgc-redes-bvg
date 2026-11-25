import type { Metadata } from 'next';
import Link from 'next/link';
import { Alerta, BotaoSecundario, Campo, Selecao } from '@/components/campo';
import { exigirPermissao } from '@/lib/auth/dal';
import { NOME_DIA_EXTENSO } from '@/lib/grade/regras';
import { ConsultaAusenciaSchema, formatarData, hojeEmFortaleza, MOTIVOS_OPERACIONAIS } from '@/lib/ausencias/regras';
import { aulasParaRegistro } from '@/lib/ausencias/opcoes';
import { FormularioRegistro } from './formulario-registro';

export const metadata: Metadata = { title: 'Registrar ausência — SGC-Redes' };

export default async function PaginaNovaAusencia({ searchParams }: { searchParams: Promise<{ professorId?: string; data?: string; ate?: string }> }) {
  await exigirPermissao('ausencias:registrar');
  const params = await searchParams;
  const hoje = hojeEmFortaleza();
  const consulta = ConsultaAusenciaSchema.safeParse({ professorId: params.professorId ?? '', data: params.data ?? '' });
  const enviada = params.professorId !== undefined || params.data !== undefined;
  const dataEscolhida = consulta.success ? consulta.data.data : (params.data ?? hoje);

  // Licença de vários dias: "Até" opcional; cada dia do período mostra as próprias aulas.
  const opcoes = await aulasParaRegistro(consulta.success ? consulta.data.professorId : null, consulta.success ? consulta.data.data : hoje, params.ate);
  const { datas, varios, comAulasLivres } = opcoes;
  const dia = opcoes.diaInicial;
  const erroPeriodo = consulta.success ? opcoes.erroPeriodo : null;
  const professor = consulta.success && !erroPeriodo ? dia.docentes.find((d) => d.id === consulta.data.professorId) : undefined;
  const aulas = opcoes.dias[0]?.aulas ?? [];
  const erros = enviada && !consulta.success ? consulta.error.issues : [];
  const erro = (campo: string) => erros.filter((i) => i.path[0] === campo).map((i) => i.message);

  return (
    <div className="max-w-2xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/ausencias" className="text-if-verde-700 underline underline-offset-2">Ausências</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">Registrar</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Registrar ausência</h1>
      <p className="mt-1 text-slate-700">Escolha o docente e a data; o sistema mostra as aulas dele naquele dia pela grade vigente.</p>

      <section aria-labelledby="etapa1" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="etapa1" className="mb-4 text-lg font-semibold text-slate-900">1. Docente e data</h2>
        <form method="get" className="grid gap-5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end" noValidate>
          <Selecao
            id="professorId"
            rotulo="Docente"
            opcoes={[{ valor: '', rotulo: 'Selecione…' }, ...dia.docentes.map((d) => ({ valor: d.id, rotulo: d.nome }))]}
            defaultValue={params.professorId ?? ''}
            erros={erro('professorId')}
          />
          <Campo id="data" rotulo="Data" type="date" defaultValue={dataEscolhida} erros={erro('data')} />
          <Campo
            id="ate"
            rotulo="Até (opcional)"
            type="date"
            defaultValue={params.ate ?? ''}
            erros={erroPeriodo ? [erroPeriodo] : undefined}
            dica="Licença de vários dias"
          />
          <BotaoSecundario type="submit">Ver aulas</BotaoSecundario>
        </form>
      </section>

      {professor && varios && (
        <section aria-labelledby="etapa2" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="etapa2" className="mb-1 text-lg font-semibold text-slate-900">
            2. Aulas de {professor.nome} de {formatarData(datas[0])} a {formatarData(datas[datas.length - 1])}
          </h2>
          <p className="mb-4 text-sm text-slate-600">Cada dia segue a grade vigente e o calendário acadêmico (feriados e sábados letivos).</p>
          {comAulasLivres.length === 0 ? (
            <Alerta tipo="info">Este docente não tem aula a registrar neste período. Confira as datas ou a grade.</Alerta>
          ) : (
            <FormularioRegistro professorId={professor.id} data={datas[0]} ate={datas[datas.length - 1]} dias={comAulasLivres} motivos={MOTIVOS_OPERACIONAIS} />
          )}
        </section>
      )}

      {professor && !varios && (
        <section aria-labelledby="etapa2" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="etapa2" className="mb-1 text-lg font-semibold text-slate-900">
            2. Aulas de {professor.nome} em {formatarData(dia.dataISO)}
          </h2>
          {dia.diaSemana !== null && (
            <p className="mb-4 text-sm text-slate-600">
              Grade de {NOME_DIA_EXTENSO[dia.diaSemana]}
              {dia.sabadoLetivo ? ' (sábado letivo)' : ''}.
            </p>
          )}
          {dia.diaSemana === null ? (
            <Alerta tipo="info">
              {dia.suspensao
                ? `Não há aula nesta data pelo calendário acadêmico: ${dia.suspensao.descricao}.`
                : 'Não há aula nesta data: é fim de semana e não há sábado letivo cadastrado.'}
            </Alerta>
          ) : aulas.length === 0 ? (
            <Alerta tipo="info">Este docente não tem aula na grade deste dia. Confira a data ou a grade do período.</Alerta>
          ) : aulas.every((a) => a.jaRegistrada) ? (
            <Alerta tipo="info">
              Todas as aulas deste docente nesta data já têm ausência registrada. <Link href="/ausencias" className="underline">Ver ausências</Link>.
            </Alerta>
          ) : (
            <FormularioRegistro professorId={professor.id} data={dia.dataISO} dias={[{ dataISO: dia.dataISO, titulo: null, aulas }]} motivos={MOTIVOS_OPERACIONAIS} />
          )}
        </section>
      )}
    </div>
  );
}
