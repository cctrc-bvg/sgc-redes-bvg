import type { Metadata } from 'next';
import { STATUS_COM_REPOSICAO } from '@/lib/reposicao/regras';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alerta } from '@/components/campo';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import {
  descreverBloco,
  dataDoBanco,
  formatarData,
  hojeEmFortaleza,
  NOME_STATUS_CONVITE,
  OPCAO_DISPENSA,
  OPCAO_PENDENTE,
  opcaoAdiantamento,
  opcaoSubstituto,
  PREFIXO_DECISAO,
  sugerirAdiantamentos,
  sugerirSubstitutos,
} from '@/lib/ausencias/regras';
import { ETIQUETA_SLA, NOME_REFEICAO_HORARIO } from '@/lib/ausencias/mensagens';
import { NOME_MODO } from '@/lib/comunicacao/mensagem';
import { CaixaMensagem } from '@/components/caixa-mensagem';
import { carregarModelos } from '@/lib/comunicacao/servidor';
import { carregarAusencia, contextoDaAusencia, impactoDaTurma } from '@/lib/ausencias/servidor';
import { configuracaoEvolution, destinoValido } from '@/lib/comunicacao/evolution';
import { prisma } from '@/lib/db';
import { carregarAno } from '@/lib/calendario/servidor';
import { prazoDeReposicao, textoPrazoReposicao } from '@/lib/calendario/regras';
import { FormularioEnvio } from '../../comunicacao/formulario-envio';
import { SituacaoAusencia } from '../situacao';
import { FormularioCancelamento, FormularioConvite, FormularioDecisao, type HorarioDecisao } from './formularios';

export const metadata: Metadata = { title: 'Ausência — SGC-Redes' };

const SITUACAO_HORARIO = {
  pendente: '⚠ Sem ocupação definida',
  substituicao: '✔ Substituição',
  adiantamento: '✔ Aula adiantada',
  dispensa: '⏹ Turma dispensada',
} as const;

export default async function PaginaAusencia({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const { usuario } = await exigirPermissao('ausencias:registrar');
  const podeComunicar = temPermissao(usuario, 'comunicacao:enviar');
  const { id } = await params;
  const { aviso } = await searchParams;
  const dados = await carregarAusencia(id);
  if (!dados) notFound();
  const { registro, dia, ausencia, alertas, horarios, mensagens, dataISO } = dados;
  // Reposição das aulas dispensadas: 15 dias letivos ou o fim da etapa, o que vier primeiro (ROD, Art. 37, § 2º).
  const precisaRepor = (STATUS_COM_REPOSICAO as readonly string[]).includes(registro.status);
  const anoCal = precisaRepor ? await carregarAno(Number(dataISO.slice(0, 4))) : null;
  const prazoRepor = anoCal ? prazoDeReposicao(dataISO, anoCal.contagem.letivos, anoCal.etapas) : null;
  // Envio automático só com a API configurada e destino válido no canal (G07).
  const comApi = podeComunicar && configuracaoEvolution() !== null;
  const mostrarWhatsapp = usuario.usaWhatsapp;
  const modelos = podeComunicar ? await carregarModelos() : [];
  const enviados = podeComunicar
    ? await prisma.logComunicacao.findMany({
        where: { ausenciaId: id, sucesso: true },
        orderBy: { enviadoEm: 'desc' },
        select: { chave: true, modoEnvio: true, enviadoEm: true },
      })
    : [];
  const ultimoEnvio = new Map<string, (typeof enviados)[number]>();
  for (const e of enviados) if (e.chave && !ultimoEnvio.has(e.chave)) ultimoEnvio.set(e.chave, e);
  const canaisAutomaticos = new Set(
    comApi
      ? (await prisma.configuracaoCanal.findMany({ where: { ativo: true, destinoId: { not: null } } }))
          .filter((c) => destinoValido(c.destinoId ?? ''))
          .map((c) => c.canal)
      : [],
  );

  // Opções de cada horário, calculadas no servidor (o formulário só escolhe entre elas).
  const ctx = contextoDaAusencia(dia, id);
  const bloco = new Map(dia.blocos.map((b) => [b.id, b]));
  const docente = new Map(dia.docentes.map((d) => [d.id, d.nome]));
  const disciplina = new Map(dia.aulasDoDia.map((a) => [`${a.turmaId}|${a.blocoId}`, a.disciplina]));
  const minhas = new Map(dia.coberturas.filter((c) => c.ausenciaId === id).map((c) => [c.blocoId, c]));
  const horariosDecisao: HorarioDecisao[] = ausencia.blocoIds.map((b) => {
    const subs = sugerirSubstitutos(ctx, registro.turmaId, b);
    const adis = sugerirAdiantamentos(ctx, registro.turmaId, b);
    const atual = minhas.get(b);
    return {
      campo: `${PREFIXO_DECISAO}${b}`,
      blocoId: b,
      rotulo: descreverBloco(bloco.get(b)!),
      atual: !atual
        ? OPCAO_PENDENTE
        : atual.tipo === 'DISPENSA'
          ? OPCAO_DISPENSA
          : atual.tipo === 'SUBSTITUICAO'
            ? opcaoSubstituto(atual.substitutoId ?? '')
            : opcaoAdiantamento(atual.blocoOrigemId ?? ''),
      opcoes: [
        { valor: OPCAO_PENDENTE, rotulo: 'Decidir depois (sem ocupação)' },
        ...subs.map((s) => ({ valor: opcaoSubstituto(s.id), rotulo: `Substituição: ${s.nome}${s.daTurma ? ' (leciona na turma)' : ''}` })),
        ...adis.map((a) => ({
          valor: opcaoAdiantamento(a.blocoOrigemId),
          rotulo: `Adiantar ${disciplina.get(`${registro.turmaId}|${a.blocoOrigemId}`)} — ${docente.get(a.professorId) ?? ''} (de ${descreverBloco(bloco.get(a.blocoOrigemId)!)})`,
        })),
        { valor: OPCAO_DISPENSA, rotulo: 'Dispensar a turma neste horário' },
      ],
    };
  });

  // Prévia: o que acontece com as refeições se os horários pendentes virarem dispensa.
  const agora = new Date();
  const pendentes = ausencia.blocoIds.filter((b) => !minhas.has(b));
  const previa =
    pendentes.length > 0
      ? impactoDaTurma(dia, registro.turmaId, agora, [
          ...dia.coberturas.filter((c) => c.turmaId === registro.turmaId),
          ...pendentes.map((b) => ({ tipo: 'DISPENSA' as const, blocoId: b, blocoOrigemId: null })),
        ])
      : [];
  const ativos = alertas.filter((a) => !a.canceladoEm);
  const convites = await prisma.conviteSubstituicao.findMany({
    where: { ausenciaId: id },
    orderBy: { criadoEm: 'asc' },
    select: { id: true, blocoId: true, status: true, professor: { select: { nome: true } } },
  });
  const cancelados = alertas.filter((a) => a.canceladoEm);

  return (
    <div className="max-w-3xl">
      <nav aria-label="Trilha" className="text-sm">
        <Link href="/ausencias" className="text-if-verde-700 underline underline-offset-2">Ausências</Link>
        <span aria-hidden="true" className="text-slate-500"> / </span>
        <span aria-current="page" className="text-slate-700">{formatarData(dataISO)}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Ausência de {registro.professorAusente.nome} em {formatarData(dataISO)}
      </h1>
      <p className="mt-1 text-slate-700">
        {registro.turma.nome} · {registro.oferta.disciplina.nome} · {dados.dados.diaSemana}
        {dia.sabadoLetivo ? ' (sábado letivo)' : ''} · Motivo: {registro.motivoOperacional}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <SituacaoAusencia status={registro.status} />
        {registro.informadaPeloDocente && (
          <span className="rounded-full bg-docencia-50 px-2 py-0.5 text-xs font-semibold text-docencia-800">Informada pelo docente</span>
        )}
      </p>
      {prazoRepor && (
        <div className="mt-3">
          <Alerta tipo={registro.status !== 'REPOSICAO_AGENDADA' && !registro.reposicaoEm && prazoRepor.prazo < hojeEmFortaleza() ? 'erro' : 'info'}>
            {registro.status === 'COBERTA_POR_SUBSTITUICAO'
              ? 'Horário ocupado por outro docente: a aula não foi dada na disciplina de quem faltou, que ainda deve repô-la para completar a carga horária (o docente que ocupou o horário pode contá-lo na disciplina dele). Prazo: '
              : 'Reposição das aulas dispensadas: '}
            {textoPrazoReposicao(prazoRepor)} (ROD, Art. 37, § 2º).
            {registro.reposicaoEm
              ? ''
              : registro.status === 'REPOSICAO_AGENDADA'
                ? ' Reposição já agendada.'
                : prazoRepor.prazo < hojeEmFortaleza()
                  ? ' O prazo já passou e a reposição ainda não foi informada.'
                  : registro.status === 'TURMA_DISPENSADA'
                    ? ' Combine a data com a turma (pelo menos 75% de acordo, com registro assinado) e marque "reposição agendada" na decisão.'
                    : ' O docente informa a data da reposição em Reposições.'}
            {registro.reposicaoEm && ` Aula reposta em ${formatarData(dataDoBanco(registro.reposicaoEm))}.`}{' '}
            <Link href="/reposicoes" className="font-semibold underline underline-offset-2">Registrar ou conferir a reposição</Link>.
          </Alerta>
        </div>
      )}
      {registro.informadaPeloDocente && registro.status === 'PENDENTE_DECISAO' && (
        <div className="mt-3">
          <Alerta tipo="info">
            O próprio docente informou esta ausência. Envie a ele a &quot;Ciência da sua ausência&quot; (em Comunicar, abaixo), que já traz a orientação
            da Gestão de Pessoas, e decida quem ocupa cada horário.
          </Alerta>
        </div>
      )}

      {aviso === 'registrada' && (
        <div className="mt-4">
          <Alerta tipo="sucesso">Ausência registrada. Decida quem ocupa cada horário abaixo.</Alerta>
        </div>
      )}

      <section aria-labelledby="horarios" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="horarios" className="text-lg font-semibold text-slate-900">Situação por horário</h2>
        <ul className="mt-3 space-y-1 text-slate-800">
          {horarios.map((h) => (
            <li key={h.bloco}>
              <span className="font-semibold">{h.bloco}:</span> {SITUACAO_HORARIO[h.situacao]}
              {h.detalhe ? ` — ${h.detalhe}` : ''}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="decisao" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="decisao" className="text-lg font-semibold text-slate-900">Decidir a ocupação dos horários</h2>
        <p className="mb-4 mt-1 text-sm text-slate-700">
          Sugestões pela grade do dia: primeiro quem leciona na turma (G03), depois os demais docentes livres; adiantamentos trazem uma
          aula posterior da turma para o horário vago. Dispensar é o último recurso.
        </p>
        <FormularioDecisao ausenciaId={id} horarios={horariosDecisao} justificativa={registro.justificativa ?? ''} reposicao={registro.status === 'REPOSICAO_AGENDADA'} />
      </section>

      {(pendentes.length > 0 || convites.length > 0) && (
        <section aria-labelledby="convites" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="convites" className="text-lg font-semibold text-slate-900">Convites de substituição</h2>
          <p className="mb-4 mt-1 text-sm text-slate-700">
            O docente convidado responde em &quot;Minha grade&quot;; a mensagem para ele (e-mail ou WhatsApp) aparece em Mensagens prontas. Ao aceitar, a substituição é gravada se o horário ainda estiver pendente.
          </p>
          {convites.length > 0 && (
            <ul className="mb-4 space-y-1 text-sm text-slate-800">
              {convites.map((c) => (
                <li key={c.id}>
                  {descreverBloco(bloco.get(c.blocoId)!)} · {c.professor.nome}: {NOME_STATUS_CONVITE[c.status]}
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-4">
            {pendentes.map((b) => (
              <FormularioConvite
                key={b}
                ausenciaId={id}
                blocoId={b}
                rotulo={descreverBloco(bloco.get(b)!)}
                opcoes={sugerirSubstitutos(ctx, registro.turmaId, b).map((s) => ({ valor: s.id, rotulo: `${s.nome}${s.daTurma ? ' (leciona na turma)' : ''}` }))}
              />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="refeicoes" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="refeicoes" className="text-lg font-semibold text-slate-900">Refeições da turma neste dia</h2>
        {ativos.length === 0 ? (
          <p className="mt-2 text-slate-700">Nenhuma alteração de refeição: a turma mantém os turnos de permanência.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {ativos.map((a) => (
              <li key={a.id} className={a.nivelSla === 'VERMELHO_MENOS_4H' ? 'rounded-md border border-if-vermelho-700 bg-if-vermelho-50 p-3' : 'rounded-md border border-slate-200 p-3'}>
                <span className="font-semibold">
                  {a.acao === 'CANCELAR_REFEICAO' ? 'Cancelar' : 'Adicionar'} {NOME_REFEICAO_HORARIO[a.tipoRefeicao]}
                </span>{' '}
                · {a.qtdImpactada} estudante(s) · {ETIQUETA_SLA[a.nivelSla]}
                <span className="block text-sm text-slate-700">
                  {a.confirmadoAE ? '✔ Assistência Estudantil deu ciência' : '⏳ Aguardando ciência da Assistência Estudantil'}
                  {a.enviadoEm ? ' · mensagem enviada' : ''}
                </span>
                {a.nivelSla === 'VERMELHO_MENOS_4H' && !a.confirmadoAE && (
                  <span className="mt-1 block text-sm font-semibold text-if-vermelho-700">
                    <span aria-hidden="true">☎ </span>Emergência (G06): ligue agora para a Assistência Estudantil, além do aviso no painel.
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {cancelados.length > 0 && (
          <p className="mt-3 text-sm text-slate-600">{cancelados.length} aviso(s) anterior(es) cancelado(s) por mudança de decisão.</p>
        )}
        {previa.length > 0 && (
          <div className="mt-4">
            <Alerta tipo="info">
              Se os horários pendentes forem dispensados:{' '}
              {previa.map((i) => `${i.acao === 'CANCELAR' ? 'cancelar' : 'adicionar'} ${NOME_REFEICAO_HORARIO[i.tipoRefeicao]} (${ETIQUETA_SLA[i.nivelSla]})`).join('; ')}.
            </Alerta>
          </div>
        )}
      </section>

      {podeComunicar && (
        <section aria-labelledby="mensagens" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 id="mensagens" className="text-lg font-semibold text-slate-900">Mensagens prontas</h2>
          <p className="mb-4 mt-1 text-sm text-slate-700">
            Modo semiautomático (G07): o sistema gera os textos e você encaminha pelo e-mail institucional
            {mostrarWhatsapp ? ' ou pelo WhatsApp' : ''}, depois registra o envio. Trechos entre {'{{ }}'} são destinatários sem cadastro:
            preencha antes de enviar. E-mail e saudação dos grupos e setores ficam em Comunicação. A Gestão só é avisada de dispensa, impacto
            na alimentação ou aula sem professor definido (G08).
          </p>
          {mensagens.length === 0 ? (
            <p className="text-slate-700">Nenhuma mensagem necessária no momento.</p>
          ) : (
            <ul className="space-y-6">
              {mensagens.map((m) => {
                const ultimo = ultimoEnvio.get(m.chave);
                return (
                  <li key={m.chave}>
                    <CaixaMensagem mensagem={m} mostrarWhatsapp={mostrarWhatsapp} modelos={modelos}>
                      {ultimo && (
                        <p className="text-sm text-if-verde-800">
                          <span aria-hidden="true">✔ </span>Envio registrado ({NOME_MODO[ultimo.modoEnvio] ?? ultimo.modoEnvio},{' '}
                          {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }).format(ultimo.enviadoEm)}).
                        </p>
                      )}
                      <FormularioEnvio
                        ausenciaId={id}
                        chave={m.chave}
                        automatico={m.canal !== null && canaisAutomaticos.has(m.canal)}
                        mostrarWhatsapp={mostrarWhatsapp}
                      />
                    </CaixaMensagem>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="cancelar" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id="cancelar" className="text-lg font-semibold text-slate-900">Cancelar registro</h2>
        <p className="mb-4 mt-1 text-sm text-slate-700">Use se o docente não vai mais faltar. O registro é apagado e o histórico fica na auditoria.</p>
        <FormularioCancelamento ausenciaId={id} />
      </section>
    </div>
  );
}
