'use server';

import * as z from 'zod';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import {
  agruparAulasEscolhidas,
  codigoBloco,
  criarRegistroAusenciaSchema,
  dataDoBanco,
  dataParaBanco,
  datasDoPeriodo,
  DIAS_MAXIMOS_PERIODO,
  formatarData,
  hojeEmFortaleza,
  lerChaveDoPeriodo,
  planejarCoberturas,
  PREFIXO_DECISAO,
  statusDaAusencia,
  sugerirSubstitutos,
} from '@/lib/ausencias/regras';
import { carregarDia, contextoDaAusencia, impactoDaTurma, recalcularAlertasDaTurma } from '@/lib/ausencias/servidor';

// Ids chegam por campo oculto, nunca por `acao.bind(null, id)` (ver usuarios/actions.ts).

export type EstadoRegistro = {
  erros?: Partial<Record<'motivoOperacional' | 'aulas' | 'data' | 'professorId', string[]>>;
  mensagem?: string;
  valores?: { motivoOperacional: string; aulas: string[] };
};

/**
 * Cria as ausências do formulário (uma por turma, disciplina e dia). Usada pela Coordenação (qualquer docente) e
 * pelo próprio docente (RF02-A: `professorFixo` = ele mesmo, `informada` = true).
 */
async function criarAusencias(
  formData: FormData,
  opcoes: { autorId: string; professorFixo: string | null; informada: boolean },
): Promise<{ erro: EstadoRegistro } | { criadas: string[]; primeiraData: string }> {
  const valores = {
    professorId: opcoes.professorFixo ?? String(formData.get('professorId') ?? ''),
    data: String(formData.get('data') ?? ''),
    motivoOperacional: String(formData.get('motivoOperacional') ?? ''),
    aulas: formData.getAll('aula').map(String),
  };
  const devolver = { motivoOperacional: valores.motivoOperacional, aulas: valores.aulas };
  const schema = criarRegistroAusenciaSchema(hojeEmFortaleza());
  const validacao = schema.safeParse(valores);
  if (!validacao.success) return { erro: { erros: z.flattenError(validacao.error).fieldErrors, valores: devolver } };
  const { professorId, data, motivoOperacional, aulas } = validacao.data;

  // Período (licença de vários dias): cada aula vem com a própria data ("AAAA-MM-DD#oferta|bloco").
  const periodo = datasDoPeriodo(data, String(formData.get('ate') ?? ''));
  if (!periodo) return { erro: { mensagem: `Período inválido: use até ${DIAS_MAXIMOS_PERIODO} dias, com o fim depois do início.`, valores: devolver } };
  const porData = new Map<string, string[]>();
  for (const k of aulas) {
    const { data: d, chave } = lerChaveDoPeriodo(k, data);
    if (!periodo.includes(d) || !schema.shape.data.safeParse(d).success) return { erro: { mensagem: 'Há aula fora do período informado. Recarregue a página.', valores: devolver } };
    porData.set(d, [...(porData.get(d) ?? []), chave]);
  }

  const planos: { data: string; grupos: ReturnType<typeof agruparAulasEscolhidas>; codigo: Map<string, string> }[] = [];
  for (const [d, chaves] of porData) {
    const dia = await carregarDia(d);
    const daProfessor = dia.aulasDoDia.filter((a) => a.professorId === professorId);
    const grupos = agruparAulasEscolhidas(daProfessor, chaves, dia.blocos);
    if (grupos.length === 0) {
      return { erro: { mensagem: `As aulas marcadas em ${formatarData(d)} não pertencem mais a este professor. Recarregue a página.`, valores: devolver } };
    }
    const jaRegistradas = new Set(dia.ausencias.map((a) => a.ofertaId));
    if (grupos.some((g) => jaRegistradas.has(g.ofertaId))) {
      return { erro: { mensagem: `Já existe ausência registrada em ${formatarData(d)} para uma das disciplinas marcadas. Abra-a na lista de ausências.`, valores: devolver } };
    }
    planos.push({ data: d, grupos, codigo: new Map(dia.blocos.map((b) => [b.id, codigoBloco(b)])) });
  }

  let criadas: string[];
  try {
    criadas = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const p of planos) {
        for (const g of p.grupos) {
          const a = await tx.ausenciaDocente.create({
            data: {
              dataAula: dataParaBanco(p.data),
              turmaId: g.turmaId,
              ofertaId: g.ofertaId,
              professorAusenteId: professorId,
              blocosAfetados: g.blocoIds.map((b) => p.codigo.get(b)).join(','),
              motivoOperacional,
              informadaPeloDocente: opcoes.informada,
            },
          });
          ids.push(a.id);
        }
      }
      return ids;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { erro: { mensagem: 'Outra pessoa acabou de registrar esta ausência. Abra-a na lista de ausências.', valores: devolver } };
    }
    throw e;
  }
  for (const id of criadas) {
    await registrarAuditoria({
      userId: opcoes.autorId,
      acao: opcoes.informada ? 'INFORMOU_AUSENCIA' : 'REGISTROU_AUSENCIA',
      entidade: 'AusenciaDocente',
      entidadeId: id,
      detalhes: planos.length > 1 ? { periodo: `${periodo[0]}..${periodo.at(-1)}` } : undefined,
    });
  }
  revalidatePath('/ausencias');
  revalidatePath('/painel');
  return { criadas, primeiraData: planos[0].data };
}

export async function registrarAusencia(_estado: EstadoRegistro | undefined, formData: FormData): Promise<EstadoRegistro> {
  const { usuario: editor } = await exigirPermissao('ausencias:registrar');
  const r = await criarAusencias(formData, { autorId: editor.id, professorFixo: null, informada: false });
  if ('erro' in r) return r.erro;
  redirect(r.criadas.length === 1 ? `/ausencias/${r.criadas[0]}?aviso=registrada` : `/ausencias?data=${r.primeiraData}&aviso=registradas`);
}

/** RF02-A: o docente informa a própria ausência; a Coordenação dá ciência e decide a ocupação dos horários. */
export async function informarAusencia(_estado: EstadoRegistro | undefined, formData: FormData): Promise<EstadoRegistro> {
  const { usuario } = await exigirPermissao('ausencias:informar');
  const r = await criarAusencias(formData, { autorId: usuario.id, professorFixo: usuario.id, informada: true });
  if ('erro' in r) return r.erro;
  revalidatePath('/grade/minha');
  redirect('/grade/minha?aviso=ausencia-informada');
}

/** O docente desiste da ausência que informou, enquanto a Coordenação ainda não decidiu a cobertura. */
export async function cancelarAusenciaInformada(_estado: EstadoCancelamento | undefined, formData: FormData): Promise<EstadoCancelamento> {
  const { usuario } = await exigirPermissao('ausencias:informar');
  const ausenciaId = String(formData.get('ausenciaId') ?? '');
  const registro = await prisma.ausenciaDocente.findUnique({
    where: { id: ausenciaId },
    select: { id: true, professorAusenteId: true, informadaPeloDocente: true, status: true, _count: { select: { coberturas: true } } },
  });
  if (!registro || registro.professorAusenteId !== usuario.id || !registro.informadaPeloDocente) return { mensagem: 'Ausência não encontrada.' };
  if (registro.status !== 'PENDENTE_DECISAO' || registro._count.coberturas > 0) {
    return { mensagem: 'A Coordenação já decidiu a ocupação dos horários desta ausência. Para desfazer, fale com a Coordenação.' };
  }
  // Sem cobertura decidida, não há aviso de refeição ligado a ela: basta apagar.
  await prisma.ausenciaDocente.delete({ where: { id: ausenciaId } });
  await registrarAuditoria({ userId: usuario.id, acao: 'CANCELOU_AUSENCIA_INFORMADA', entidade: 'AusenciaDocente', entidadeId: ausenciaId });
  revalidatePath('/ausencias');
  revalidatePath('/painel');
  // O item some da lista ao cancelar: o aviso vai no topo da página, que não muda de lugar.
  redirect('/grade/minha?aviso=ausencia-cancelada');
}

export type EstadoDecisao = {
  erros?: Record<string, string>;
  mensagem?: string;
  sucesso?: boolean;
  valores?: Record<string, string>;
};

export async function decidirAusencia(_estado: EstadoDecisao | undefined, formData: FormData): Promise<EstadoDecisao> {
  const { usuario: editor } = await exigirPermissao('ausencias:registrar');
  const ausenciaId = String(formData.get('ausenciaId') ?? '');
  const registro = await prisma.ausenciaDocente.findUnique({ where: { id: ausenciaId }, select: { id: true, dataAula: true, turmaId: true } });
  if (!registro) return { mensagem: 'Ausência não encontrada. Ela pode ter sido cancelada.' };

  const dataISO = dataDoBanco(registro.dataAula);
  const dia = await carregarDia(dataISO);
  const ausencia = dia.ausencias.find((a) => a.id === ausenciaId)!;
  const escolhas = Object.fromEntries(ausencia.blocoIds.map((b) => [b, String(formData.get(`${PREFIXO_DECISAO}${b}`) ?? '')]));
  const justificativa = String(formData.get('justificativa') ?? '').trim();
  const reposicao = formData.get('reposicao') === 'on';
  const valores = { ...escolhas, justificativa, reposicao: reposicao ? 'on' : '' };

  const { coberturas, erros } = planejarCoberturas(contextoDaAusencia(dia, ausenciaId), ausencia.turmaId, ausencia.blocoIds, escolhas);
  if (Object.keys(erros).length > 0) return { erros, valores, mensagem: 'Revise os horários indicados.' };
  if (justificativa.length > 300) return { erros: { justificativa: 'Use no máximo 300 caracteres.' }, valores };

  // RF04: aviso de emergência (< 4h) exige justificativa registrada.
  const agora = new Date();
  const outrasDaTurma = dia.coberturas.filter((c) => c.turmaId === registro.turmaId && c.ausenciaId !== ausenciaId);
  const simulado = impactoDaTurma(dia, registro.turmaId, agora, [...outrasDaTurma, ...coberturas]);
  if (simulado.some((i) => i.nivelSla === 'VERMELHO_MENOS_4H') && justificativa.length < 10) {
    return {
      erros: { justificativa: 'Esta decisão gera aviso de emergência (< 4h) à Assistência Estudantil: registre a justificativa (mín. 10 caracteres).' },
      valores,
    };
  }

  const status = statusDaAusencia(ausencia.blocoIds.length, coberturas, reposicao);
  const substitutos = [...new Set(coberturas.map((c) => c.substitutoId).filter(Boolean))];
  const resultado = await prisma.$transaction(async (tx) => {
    await tx.coberturaBloco.deleteMany({ where: { ausenciaId } });
    await tx.coberturaBloco.createMany({
      data: coberturas.map((c) => ({ ausenciaId, blocoId: c.blocoId, tipo: c.tipo, substitutoId: c.substitutoId, blocoOrigemId: c.blocoOrigemId })),
    });
    await tx.ausenciaDocente.update({
      where: { id: ausenciaId },
      data: {
        status,
        justificativa: justificativa || null,
        decididaEm: coberturas.length > 0 ? agora : null,
        // Campo legado: só preenchido quando um único docente cobre a ausência inteira.
        professorSubstitutoId: status === 'COBERTA_POR_SUBSTITUICAO' && substitutos.length === 1 ? substitutos[0] : null,
      },
    });
    await tx.conviteSubstituicao.updateMany({
      where: { ausenciaId, status: 'PENDENTE', blocoId: { in: coberturas.map((c) => c.blocoId) } },
      data: { status: 'ENCERRADO', respondidoEm: agora },
    });
    return recalcularAlertasDaTurma(tx, { turmaId: registro.turmaId, dataISO, agora, ausenciaId, justificativa: justificativa || null });
  });

  const codigo = new Map(dia.blocos.map((b) => [b.id, codigoBloco(b)]));
  await registrarAuditoria({
    userId: editor.id,
    acao: 'DECIDIU_AUSENCIA',
    entidade: 'AusenciaDocente',
    entidadeId: ausenciaId,
    detalhes: {
      status,
      coberturas: coberturas.map((c) => ({ bloco: codigo.get(c.blocoId) ?? c.blocoId, tipo: c.tipo })),
      avisosRefeicao: resultado,
    },
  });
  revalidatePath('/ausencias');
  revalidatePath('/alimentacao');
  const partes = [
    'Decisão salva.',
    resultado.criados > 0 && `${resultado.criados} aviso(s) de refeição enviado(s) ao painel da Assistência Estudantil.`,
    resultado.cancelados > 0 && `${resultado.cancelados} aviso(s) de refeição cancelado(s).`,
  ].filter(Boolean);
  return { sucesso: true, mensagem: partes.join(' '), valores };
}

export type EstadoCancelamento = { mensagem?: string; sucesso?: boolean };

export async function cancelarAusencia(_estado: EstadoCancelamento | undefined, formData: FormData): Promise<EstadoCancelamento> {
  const { usuario: editor } = await exigirPermissao('ausencias:registrar');
  const ausenciaId = String(formData.get('ausenciaId') ?? '');
  if (formData.get('confirmo') !== 'on') return { mensagem: 'Marque a confirmação para cancelar o registro.' };
  const registro = await prisma.ausenciaDocente.findUnique({ where: { id: ausenciaId }, select: { id: true, dataAula: true, turmaId: true } });
  if (!registro) return { mensagem: 'Ausência não encontrada. Ela pode já ter sido cancelada.' };
  const dataISO = dataDoBanco(registro.dataAula);

  const resultado = await prisma.$transaction(async (tx) => {
    await tx.ausenciaDocente.delete({ where: { id: ausenciaId } });
    return recalcularAlertasDaTurma(tx, { turmaId: registro.turmaId, dataISO, agora: new Date(), ausenciaId: null, justificativa: null });
  });
  await registrarAuditoria({
    userId: editor.id,
    acao: 'CANCELOU_AUSENCIA',
    entidade: 'AusenciaDocente',
    entidadeId: ausenciaId,
    detalhes: { avisosRefeicaoCancelados: resultado.cancelados },
  });
  revalidatePath('/ausencias');
  revalidatePath('/alimentacao');
  redirect(`/ausencias?data=${dataISO}&aviso=cancelada`);
}

export type EstadoConvite = { mensagem?: string; sucesso?: boolean };

/** A Coordenação convida um docente livre para cobrir um horário ainda sem decisão. */
export async function convidarSubstituto(_estado: EstadoConvite | undefined, formData: FormData): Promise<EstadoConvite> {
  const { usuario } = await exigirPermissao('ausencias:registrar');
  const ausenciaId = String(formData.get('ausenciaId') ?? '');
  const blocoId = String(formData.get('blocoId') ?? '');
  const professorId = String(formData.get('professorId') ?? '');
  const registro = await prisma.ausenciaDocente.findUnique({ where: { id: ausenciaId }, select: { dataAula: true } });
  if (!registro) return { mensagem: 'Ausência não encontrada.' };
  const dia = await carregarDia(dataDoBanco(registro.dataAula));
  const ausencia = dia.ausencias.find((a) => a.id === ausenciaId)!;
  if (!ausencia.blocoIds.includes(blocoId)) return { mensagem: 'Horário inválido.' };
  if (dia.coberturas.some((c) => c.ausenciaId === ausenciaId && c.blocoId === blocoId)) return { mensagem: 'Este horário já foi decidido.' };
  if (!professorId) return { mensagem: 'Escolha o docente a convidar.' };
  if (!sugerirSubstitutos(contextoDaAusencia(dia, ausenciaId), ausencia.turmaId, blocoId).some((s) => s.id === professorId)) {
    return { mensagem: 'Este docente não está livre neste horário.' };
  }
  const existente = await prisma.conviteSubstituicao.findUnique({ where: { ausenciaId_blocoId_professorId: { ausenciaId, blocoId, professorId } } });
  if (existente?.status === 'PENDENTE') return { mensagem: 'Este docente já foi convidado e ainda não respondeu.' };
  const convite = existente
    ? await prisma.conviteSubstituicao.update({ where: { id: existente.id }, data: { status: 'PENDENTE', respondidoEm: null, criadoEm: new Date() } })
    : await prisma.conviteSubstituicao.create({ data: { ausenciaId, blocoId, professorId } });
  await registrarAuditoria({ userId: usuario.id, acao: 'CONVIDOU_SUBSTITUTO', entidade: 'AusenciaDocente', entidadeId: ausenciaId, detalhes: { conviteId: convite.id, blocoId, professorId } });
  revalidatePath(`/ausencias/${ausenciaId}`);
  revalidatePath('/grade/minha');
  return { sucesso: true, mensagem: 'Convite registrado. O docente vê o convite em "Minha grade".' };
}

/** O docente aceita ou recusa. Aceitar cria a substituição, se o horário ainda estiver pendente e ele livre. */
export async function responderConvite(_estado: EstadoConvite | undefined, formData: FormData): Promise<EstadoConvite> {
  const { usuario } = await exigirPermissao('substituicao:responder');
  const convite = await prisma.conviteSubstituicao.findUnique({
    where: { id: String(formData.get('conviteId') ?? '') },
    include: { ausencia: { select: { id: true, dataAula: true, turmaId: true, status: true, justificativa: true } } },
  });
  if (!convite || convite.professorId !== usuario.id) return { mensagem: 'Convite não encontrado.' };
  if (convite.status !== 'PENDENTE') return { mensagem: 'Este convite já foi respondido ou encerrado.' };
  const resposta = String(formData.get('resposta') ?? '');
  const agora = new Date();
  if (resposta === 'recusar') {
    await prisma.conviteSubstituicao.update({ where: { id: convite.id }, data: { status: 'RECUSADO', respondidoEm: agora } });
    await registrarAuditoria({ userId: usuario.id, acao: 'RECUSOU_CONVITE', entidade: 'AusenciaDocente', entidadeId: convite.ausenciaId, detalhes: { conviteId: convite.id } });
    revalidatePath('/grade/minha');
    revalidatePath(`/ausencias/${convite.ausenciaId}`);
    return { sucesso: true, mensagem: 'Convite recusado. A Coordenação foi informada pelo sistema.' };
  }
  if (resposta !== 'aceitar') return { mensagem: 'Resposta inválida.' };

  const dataISO = dataDoBanco(convite.ausencia.dataAula);
  const dia = await carregarDia(dataISO);
  const ausencia = dia.ausencias.find((a) => a.id === convite.ausenciaId)!;
  const encerrar = () =>
    prisma.conviteSubstituicao.update({ where: { id: convite.id }, data: { status: 'ENCERRADO', respondidoEm: agora } });
  if (dia.coberturas.some((c) => c.ausenciaId === ausencia.id && c.blocoId === convite.blocoId)) {
    await encerrar();
    return { mensagem: 'A Coordenação já resolveu este horário de outro jeito. Obrigado!' };
  }
  if (!sugerirSubstitutos(contextoDaAusencia(dia, ausencia.id), ausencia.turmaId, convite.blocoId).some((s) => s.id === usuario.id)) {
    return { mensagem: 'Você não está mais livre neste horário (já tem aula ou outra substituição).' };
  }
  const minhas = dia.coberturas.filter((c) => c.ausenciaId === ausencia.id);
  const status = statusDaAusencia(ausencia.blocoIds.length, [...minhas, { tipo: 'SUBSTITUICAO' as const }], convite.ausencia.status === 'REPOSICAO_AGENDADA');
  await prisma.$transaction(async (tx) => {
    await tx.coberturaBloco.create({ data: { ausenciaId: ausencia.id, blocoId: convite.blocoId, tipo: 'SUBSTITUICAO', substitutoId: usuario.id } });
    await tx.conviteSubstituicao.update({ where: { id: convite.id }, data: { status: 'ACEITO', respondidoEm: agora } });
    await tx.conviteSubstituicao.updateMany({
      where: { ausenciaId: ausencia.id, blocoId: convite.blocoId, status: 'PENDENTE', NOT: { id: convite.id } },
      data: { status: 'ENCERRADO', respondidoEm: agora },
    });
    await tx.ausenciaDocente.update({ where: { id: ausencia.id }, data: { status, decididaEm: agora } });
    await recalcularAlertasDaTurma(tx, { turmaId: ausencia.turmaId, dataISO, agora, ausenciaId: ausencia.id, justificativa: convite.ausencia.justificativa });
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'ACEITOU_CONVITE', entidade: 'AusenciaDocente', entidadeId: ausencia.id, detalhes: { conviteId: convite.id, status } });
  revalidatePath('/grade/minha');
  revalidatePath(`/ausencias/${ausencia.id}`);
  revalidatePath('/ausencias');
  return { sucesso: true, mensagem: 'Substituição confirmada. Obrigado!' };
}
