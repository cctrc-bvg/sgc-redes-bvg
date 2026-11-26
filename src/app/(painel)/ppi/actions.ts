'use server';

import * as z from 'zod';
import { Prisma, type StatusPpi } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { dataDoBanco, dataParaBanco, hojeEmFortaleza } from '@/lib/ausencias/regras';
import { criarAtividadeSchema, distribuirHoras, META_PPI, SolicitacaoSchema } from '@/lib/ppi/regras';
import { lerModoEnvio, NOME_MODO } from '@/lib/comunicacao/mensagem';
import { chaveEnvioPpi, mensagemResumoPpiCca, mensagensDaPpi } from '@/lib/ppi/comunicar';

// Auditoria só com ids e horas: nome, matrícula e comprovantes são dados pessoais do estudante.

/** Recalcula as horas de todas as atividades e o total da solicitação (tetos acumulados por categoria). */
async function recalcular(tx: Prisma.TransactionClient, solicitacaoId: string) {
  const atividades = await tx.ppiAtividade.findMany({ where: { solicitacaoId }, include: { regra: true } });
  const regras = new Map(atividades.map((a) => [a.regraId, a.regra]));
  const horas = distribuirHoras(
    atividades.map((a) => ({ id: a.id, regraId: a.regraId, quantidadeInformada: a.quantidadeInformada, dataRealizacao: dataDoBanco(a.dataRealizacao), aprovada: a.aprovada })),
    regras,
  );
  for (const a of atividades) {
    const h = horas.get(a.id) ?? 0;
    if (h !== a.horasCalculadas) await tx.ppiAtividade.update({ where: { id: a.id }, data: { horasCalculadas: h } });
  }
  const total = Math.round([...horas.values()].reduce((s, h) => s + h, 0) * 10) / 10;
  await tx.ppiSolicitacao.update({ where: { id: solicitacaoId }, data: { totalValidado: total } });
  return total;
}

export type EstadoSolicitacao = { erros?: Partial<Record<'nomeEstudante' | 'matricula' | 'turmaAtual', string[]>>; mensagem?: string; valores?: Record<string, string> };

export async function criarSolicitacao(_estado: EstadoSolicitacao | undefined, formData: FormData): Promise<EstadoSolicitacao> {
  const { usuario } = await exigirPermissao('ppi:gerenciar');
  const valores = Object.fromEntries(['nomeEstudante', 'matricula', 'turmaAtual'].map((c) => [c, String(formData.get(c) ?? '')]));
  const validacao = SolicitacaoSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };
  const existente = await prisma.ppiSolicitacao.findFirst({ where: { matricula: validacao.data.matricula, status: { not: 'INDEFERIDA' } }, select: { id: true } });
  if (existente) return { erros: { matricula: ['Já existe uma solicitação em aberto ou deferida para esta matrícula.'] }, valores };
  const criada = await prisma.ppiSolicitacao.create({ data: validacao.data });
  await registrarAuditoria({ userId: usuario.id, acao: 'CRIOU_SOLICITACAO_PPI', entidade: 'PpiSolicitacao', entidadeId: criada.id });
  revalidatePath('/ppi');
  redirect(`/ppi/${criada.id}`);
}

export type EstadoAtividade = { erros?: Record<string, string[] | undefined>; mensagem?: string; sucesso?: boolean; valores?: Record<string, string> };

const CAMPOS_ATIVIDADE = ['regraId', 'descricaoComprovante', 'codigoCertificado', 'dataRealizacao', 'quantidadeInformada', 'orientadorId', 'orientadorExterno'] as const;

export async function adicionarAtividade(_estado: EstadoAtividade | undefined, formData: FormData): Promise<EstadoAtividade> {
  const { usuario } = await exigirPermissao('ppi:gerenciar');
  const solicitacaoId = String(formData.get('solicitacaoId') ?? '');
  const valores = Object.fromEntries(CAMPOS_ATIVIDADE.map((c) => [c, String(formData.get(c) ?? '')]));
  const validacao = criarAtividadeSchema(hojeEmFortaleza()).safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };
  const d = validacao.data;
  const [solicitacao, regra, orientador] = await Promise.all([
    prisma.ppiSolicitacao.findUnique({ where: { id: solicitacaoId }, select: { id: true, status: true } }),
    prisma.ppiRegraCategoria.findUnique({ where: { id: d.regraId } }),
    d.orientadorId ? prisma.user.findFirst({ where: { id: d.orientadorId, ativo: true }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (!solicitacao) return { mensagem: 'Solicitação não encontrada.' };
  if (solicitacao.status === 'DEFERIDA') return { mensagem: 'Solicitação já deferida: reabra (Em análise) para lançar atividades.' };
  if (!regra) return { erros: { regraId: ['Escolha uma categoria do Manual.'] }, valores };
  if (d.orientadorId && !orientador) return { erros: { orientadorId: ['Orientador inválido.'] }, valores };

  let total: number;
  try {
    total = await prisma.$transaction(async (tx) => {
      await tx.ppiAtividade.create({
        data: {
          solicitacaoId,
          regraId: regra.id,
          descricaoComprovante: d.descricaoComprovante,
          codigoCertificado: d.codigoCertificado,
          dataRealizacao: dataParaBanco(d.dataRealizacao),
          quantidadeInformada: d.quantidadeInformada,
          orientadorId: d.orientadorId ?? null,
          orientadorExterno: d.orientadorExterno ?? null,
          horasCalculadas: 0,
        },
      });
      return recalcular(tx, solicitacaoId);
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { erros: { codigoCertificado: ['Este certificado já foi usado nesta solicitação (regra do certificado único).'] }, valores };
    }
    throw e;
  }
  await registrarAuditoria({ userId: usuario.id, acao: 'LANCOU_ATIVIDADE_PPI', entidade: 'PpiSolicitacao', entidadeId: solicitacaoId, detalhes: { regraId: regra.id, totalValidado: total } });
  revalidatePath(`/ppi/${solicitacaoId}`);
  revalidatePath('/ppi');
  return { sucesso: true, mensagem: `Atividade lançada. Total validado: ${String(total).replace('.', ',')}h de ${META_PPI}h.` };
}

export type EstadoSimples = { mensagem?: string; sucesso?: boolean };

/** Remover ou (des)aprovar uma atividade; o total é recalculado. */
export async function alterarAtividade(_estado: EstadoSimples | undefined, formData: FormData): Promise<EstadoSimples> {
  const { usuario } = await exigirPermissao('ppi:gerenciar');
  const atividadeId = String(formData.get('atividadeId') ?? '');
  const operacao = String(formData.get('operacao') ?? '');
  const a = await prisma.ppiAtividade.findUnique({ where: { id: atividadeId }, include: { solicitacao: { select: { id: true, status: true } } } });
  if (!a) return { mensagem: 'Atividade não encontrada.' };
  if (a.solicitacao.status === 'DEFERIDA') return { mensagem: 'Solicitação já deferida: reabra para alterar.' };
  if (!['remover', 'aprovar', 'glosar'].includes(operacao)) return { mensagem: 'Operação inválida.' };
  const total = await prisma.$transaction(async (tx) => {
    if (operacao === 'remover') await tx.ppiAtividade.delete({ where: { id: a.id } });
    else await tx.ppiAtividade.update({ where: { id: a.id }, data: { aprovada: operacao === 'aprovar' } });
    return recalcular(tx, a.solicitacao.id);
  });
  await registrarAuditoria({
    userId: usuario.id,
    acao: operacao === 'remover' ? 'REMOVEU_ATIVIDADE_PPI' : operacao === 'aprovar' ? 'APROVOU_ATIVIDADE_PPI' : 'GLOSOU_ATIVIDADE_PPI',
    entidade: 'PpiSolicitacao',
    entidadeId: a.solicitacao.id,
    detalhes: { atividadeId: a.id, totalValidado: total },
  });
  revalidatePath(`/ppi/${a.solicitacao.id}`);
  revalidatePath('/ppi');
  return { sucesso: true, mensagem: 'Atividade atualizada.' };
}

const STATUS_VALIDOS: readonly StatusPpi[] = ['EM_ANALISE', 'DEFERIDA', 'INDEFERIDA'];

export async function decidirSolicitacao(_estado: EstadoSimples | undefined, formData: FormData): Promise<EstadoSimples> {
  const { usuario } = await exigirPermissao('ppi:gerenciar');
  const solicitacaoId = String(formData.get('solicitacaoId') ?? '');
  const status = String(formData.get('status') ?? '') as StatusPpi;
  const observacoes = String(formData.get('observacoes') ?? '').trim();
  if (!STATUS_VALIDOS.includes(status)) return { mensagem: 'Escolha a decisão.' };
  if (observacoes.length > 1000) return { mensagem: 'Observações: use no máximo 1.000 caracteres.' };
  const s = await prisma.ppiSolicitacao.findUnique({ where: { id: solicitacaoId } });
  if (!s) return { mensagem: 'Solicitação não encontrada.' };
  if (status === 'DEFERIDA' && s.totalValidado < s.metaHoras) {
    return { mensagem: `Não é possível deferir: faltam ${String(Math.round((s.metaHoras - s.totalValidado) * 10) / 10).replace('.', ',')}h para a meta de ${s.metaHoras}h.` };
  }
  if (status === 'INDEFERIDA' && observacoes.length < 10) return { mensagem: 'Para indeferir, registre o motivo nas observações (mín. 10 caracteres).' };
  await prisma.ppiSolicitacao.update({ where: { id: s.id }, data: { status, observacoes: observacoes || null } });
  await registrarAuditoria({ userId: usuario.id, acao: 'DECIDIU_PPI', entidade: 'PpiSolicitacao', entidadeId: s.id, detalhes: { de: s.status, para: status, totalValidado: s.totalValidado } });
  revalidatePath(`/ppi/${s.id}`);
  revalidatePath('/ppi');
  // Decidida: leva às mensagens prontas para o estudante e a CTP.
  if ((status === 'DEFERIDA' || status === 'INDEFERIDA') && temPermissao(usuario, 'comunicacao:enviar')) redirect(`/ppi/${s.id}/comunicar?aviso=decidida`);
  return { sucesso: true, mensagem: 'Situação atualizada.' };
}

export type EstadoEnvio = { mensagem?: string; sucesso?: boolean };

/** Registra no histórico o envio (manual) de uma mensagem pronta da decisão da PPI. */
export async function registrarEnvioPpi(_e: EstadoEnvio | undefined, formData: FormData): Promise<EstadoEnvio> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const modo = lerModoEnvio(formData.get('modo'));
  if (!modo) return { mensagem: 'Escolha por onde a mensagem foi enviada.' };
  const dados = await mensagensDaPpi(String(formData.get('id') ?? ''));
  if (!dados) return { mensagem: 'Solicitação não encontrada.' };
  const m = dados.mensagens.find((x) => x.chave === String(formData.get('chave') ?? ''));
  if (!m || formData.get('situacao') !== dados.solicitacao.status) return { mensagem: 'Esta mensagem não se aplica mais. Recarregue a página.' };
  const s = dados.solicitacao;
  const log = await prisma.logComunicacao.create({
    data: { canal: m.canal, destino: m.destino, chave: chaveEnvioPpi(s.status, m.chave, s.id), assunto: m.assunto, mensagem: m.texto, modoEnvio: modo, sucesso: true, userId: usuario.id },
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'REGISTROU_ENVIO_MENSAGEM', entidade: 'LogComunicacao', entidadeId: log.id, detalhes: { canal: m.canal, modo, origem: 'ppi', situacao: s.status } });
  revalidatePath(`/ppi/${s.id}/comunicar`);
  revalidatePath('/comunicacao');
  return { sucesso: true, mensagem: `Envio por ${NOME_MODO[modo].toLowerCase()} registrado no histórico.` };
}

/** Registra no histórico o envio do apanhado geral da PPI à CCA (o texto é regenerado no servidor). */
export async function registrarEnvioResumoCca(_e: EstadoEnvio | undefined, formData: FormData): Promise<EstadoEnvio> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const modo = lerModoEnvio(formData.get('modo'));
  if (!modo) return { mensagem: 'Escolha por onde a mensagem foi enviada.' };
  const { mensagem: m } = await mensagemResumoPpiCca();
  if (!m) return { mensagem: 'O contato da CCA não está ativo em Comunicação.' };
  const log = await prisma.logComunicacao.create({
    data: { canal: m.canal, destino: m.destino, chave: `ppi-resumo:cca:${hojeEmFortaleza()}`, assunto: m.assunto, mensagem: m.texto, modoEnvio: modo, sucesso: true, userId: usuario.id },
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'REGISTROU_ENVIO_MENSAGEM', entidade: 'LogComunicacao', entidadeId: log.id, detalhes: { canal: m.canal, modo, origem: 'ppi_resumo' } });
  revalidatePath('/ppi/resumo-cca');
  revalidatePath('/comunicacao');
  return { sucesso: true, mensagem: `Envio por ${NOME_MODO[modo].toLowerCase()} registrado no histórico.` };
}
