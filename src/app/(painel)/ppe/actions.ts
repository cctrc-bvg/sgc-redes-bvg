'use server';

import * as z from 'zod';
import type { ModalidadePPE, StatusPPE } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao, exigirUsuario } from '@/lib/auth/dal';
import { dataParaBanco, hojeEmFortaleza } from '@/lib/ausencias/regras';
import {
  exigeCoordenacao,
  lerCronograma,
  MODALIDADES_DEFINIVEIS,
  PeiSchema,
  ProrrogacaoSchema,
  RegistroPpeSchema,
  TRANSICOES,
  travasPei,
} from '@/lib/ppe/regras';
import { acessoAoPpe, recalcularRetencao } from '@/lib/ppe/servidor';
import { lerModoEnvio, NOME_MODO } from '@/lib/comunicacao/mensagem';
import { chaveEnvioPpe, mensagensDaPpe } from '@/lib/ppe/comunicar';

// Auditoria só com ids, modalidade e situação: nome e matrícula são dados pessoais do estudante.

export type EstadoRegistroPpe = { erros?: Partial<Record<'nomeEstudante' | 'matricula' | 'disciplinaId' | 'semestre', string[]>>; mensagem?: string; valores?: Record<string, string> };

export async function registrarPpe(_estado: EstadoRegistroPpe | undefined, formData: FormData): Promise<EstadoRegistroPpe> {
  const { usuario } = await exigirPermissao('ppe:gerenciar');
  const valores = Object.fromEntries(['nomeEstudante', 'matricula', 'disciplinaId', 'semestre'].map((c) => [c, String(formData.get(c) ?? '')]));
  const validacao = RegistroPpeSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };
  const d = validacao.data;
  const disciplina = await prisma.disciplina.findUnique({ where: { id: d.disciplinaId }, select: { id: true } });
  if (!disciplina) return { erros: { disciplinaId: ['Componente não encontrado.'] }, valores };
  const repetido = await prisma.registroPPE.findFirst({ where: { matricula: d.matricula, semestre: d.semestre, disciplinaId: d.disciplinaId }, select: { id: true } });
  if (repetido) return { erros: { disciplinaId: ['Este estudante já tem PPE deste componente no semestre.'] }, valores };
  const { criado, total } = await prisma.$transaction(async (tx) => {
    const criado = await tx.registroPPE.create({ data: d });
    return { criado, total: await recalcularRetencao(tx, d.matricula, d.semestre) };
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'REGISTROU_PPE', entidade: 'RegistroPPE', entidadeId: criado.id, detalhes: { semestre: d.semestre, componentesNoSemestre: total } });
  revalidatePath('/ppe');
  redirect(`/ppe/${criado.id}?aviso=registrada`);
}

/** Carrega a PPE e confere o acesso de quem está agindo. */
async function carregarComAcesso(ppeId: string) {
  const { usuario } = await exigirUsuario();
  const ppe = await prisma.registroPPE.findUnique({ where: { id: ppeId }, include: { disciplina: true, pei: { include: { encontros: true } } } });
  if (!ppe) return { usuario, ppe: null, acesso: { ver: false, definir: false, gerenciar: false } };
  return { usuario, ppe, acesso: await acessoAoPpe(usuario, ppe) };
}

export type EstadoPpe = { mensagem?: string; sucesso?: boolean; erros?: Record<string, string>; valores?: Record<string, string> };

export async function definirModalidade(_estado: EstadoPpe | undefined, formData: FormData): Promise<EstadoPpe> {
  const { usuario, ppe, acesso } = await carregarComAcesso(String(formData.get('ppeId') ?? ''));
  if (!ppe || !acesso.definir) return { mensagem: 'Você não pode definir a modalidade desta PPE.' };
  const modalidade = String(formData.get('modalidade') ?? '') as ModalidadePPE;
  if (!(MODALIDADES_DEFINIVEIS as readonly string[]).includes(modalidade)) return { mensagem: 'Escolha a modalidade.' };
  if (ppe.status !== 'AGUARDANDO_PROFESSOR' && ppe.status !== 'EM_ANDAMENTO') return { mensagem: 'A modalidade só muda enquanto a PPE está em andamento.' };
  if (ppe.pei && modalidade !== 'PEI') return { mensagem: 'Já existe PEI preenchido. Para mudar para Dependência, peça à Coordenação para excluir o PEI.' };
  if (modalidade === ppe.modalidade) return { sucesso: true, mensagem: 'Nenhuma alteração.' };
  await prisma.registroPPE.update({ where: { id: ppe.id }, data: { modalidade, status: 'EM_ANDAMENTO' } });
  await registrarAuditoria({ userId: usuario.id, acao: 'DEFINIU_MODALIDADE_PPE', entidade: 'RegistroPPE', entidadeId: ppe.id, detalhes: { modalidade } });
  revalidatePath(`/ppe/${ppe.id}`);
  revalidatePath('/ppe');
  return { sucesso: true, mensagem: 'Modalidade definida.' };
}

const CAMPOS_PEI = ['cargaHorariaPei', 'horasPresenciais', 'horasPraticas', 'objetivos', 'conteudos', 'criteriosAval'] as const;

export async function salvarPei(_estado: EstadoPpe | undefined, formData: FormData): Promise<EstadoPpe> {
  const { usuario, ppe, acesso } = await carregarComAcesso(String(formData.get('ppeId') ?? ''));
  if (!ppe || !acesso.definir) return { mensagem: 'Você não pode editar o PEI desta PPE.' };
  if (ppe.modalidade !== 'PEI') return { mensagem: 'Defina a modalidade PEI antes de preencher o plano.' };
  if (!['EM_ANDAMENTO', 'PRORROGADO'].includes(ppe.status)) return { mensagem: 'O PEI só pode ser editado enquanto a PPE está em andamento.' };

  const linhas = Number(formData.get('linhasCronograma') ?? 0);
  const valores: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === 'string' && !k.startsWith('$')) valores[k] = v;
  const validacao = PeiSchema.safeParse(Object.fromEntries(CAMPOS_PEI.map((c) => [c, String(formData.get(c) ?? '')])));
  const erros: Record<string, string> = {};
  if (!validacao.success) {
    for (const [campo, msgs] of Object.entries(z.flattenError(validacao.error).fieldErrors)) if (msgs?.[0]) erros[campo] = msgs[0];
  }
  const cronograma = lerCronograma((n) => String(formData.get(n) ?? ''), Number.isInteger(linhas) && linhas > 0 ? linhas : 0);
  for (const [i, msg] of Object.entries(cronograma.erros)) erros[`encontro:${i}`] = msg;
  if (validacao.success) Object.assign(erros, travasPei(validacao.data, ppe.disciplina).erros);
  if (validacao.success && cronograma.encontros.length === 0) erros.cronograma = 'Inclua ao menos um encontro no cronograma.';
  if (Object.keys(erros).length > 0 || !validacao.success) return { erros, valores, mensagem: 'Revise os campos indicados.' };

  const d = validacao.data;
  const dados = { ...d, criteriosAval: d.criteriosAval ?? null };
  await prisma.$transaction(async (tx) => {
    const pei = await tx.planoEstudoIndividual.upsert({
      where: { ppeId: ppe.id },
      update: dados,
      create: { ...dados, ppeId: ppe.id, docenteId: usuario.id },
    });
    await tx.peiEncontro.deleteMany({ where: { peiId: pei.id } });
    await tx.peiEncontro.createMany({
      data: cronograma.encontros.map((e) => ({ peiId: pei.id, data: dataParaBanco(e.data), conteudo: e.conteudo, metodologiaAvaliacao: e.metodologiaAvaliacao })),
    });
  });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'SALVOU_PEI',
    entidade: 'RegistroPPE',
    entidadeId: ppe.id,
    detalhes: { cargaHorariaPei: d.cargaHorariaPei, horasPraticas: d.horasPraticas, encontros: cronograma.encontros.length },
  });
  revalidatePath(`/ppe/${ppe.id}`);
  return { sucesso: true, mensagem: `PEI salvo com ${cronograma.encontros.length} encontro(s).` };
}

/** G09: copia o cronograma (ou o PEI inteiro, se ainda não houver) de outro estudante da mesma disciplina e semestre. */
export async function clonarCronograma(_estado: EstadoPpe | undefined, formData: FormData): Promise<EstadoPpe> {
  const { usuario, ppe, acesso } = await carregarComAcesso(String(formData.get('ppeId') ?? ''));
  if (!ppe || !acesso.definir) return { mensagem: 'Você não pode editar o PEI desta PPE.' };
  if (ppe.modalidade !== 'PEI' || !['EM_ANDAMENTO', 'PRORROGADO'].includes(ppe.status)) return { mensagem: 'Só é possível copiar para um PEI em andamento.' };
  const origem = await prisma.registroPPE.findFirst({
    where: { id: String(formData.get('origemId') ?? ''), disciplinaId: ppe.disciplinaId, semestre: ppe.semestre, NOT: { id: ppe.id } },
    include: { pei: { include: { encontros: true } } },
  });
  if (!origem?.pei) return { mensagem: 'Escolha um PEI da mesma disciplina e semestre.' };
  const o = origem.pei;
  await prisma.$transaction(async (tx) => {
    const pei = ppe.pei
      ? ppe.pei
      : await tx.planoEstudoIndividual.create({
          data: {
            ppeId: ppe.id,
            docenteId: usuario.id,
            cargaHorariaPei: o.cargaHorariaPei,
            horasPresenciais: o.horasPresenciais,
            horasPraticas: o.horasPraticas,
            objetivos: o.objetivos,
            conteudos: o.conteudos,
            criteriosAval: o.criteriosAval,
          },
        });
    await tx.peiEncontro.deleteMany({ where: { peiId: pei.id } });
    await tx.peiEncontro.createMany({ data: o.encontros.map((e) => ({ peiId: pei.id, data: e.data, conteudo: e.conteudo, metodologiaAvaliacao: e.metodologiaAvaliacao })) });
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'CLONOU_CRONOGRAMA_PEI', entidade: 'RegistroPPE', entidadeId: ppe.id, detalhes: { origem: origem.id, encontros: o.encontros.length } });
  revalidatePath(`/ppe/${ppe.id}`);
  return { sucesso: true, mensagem: ppe.pei ? `Cronograma copiado (${o.encontros.length} encontro(s)).` : `PEI copiado com ${o.encontros.length} encontro(s). Revise e salve.` };
}

export async function mudarSituacao(_estado: EstadoPpe | undefined, formData: FormData): Promise<EstadoPpe> {
  const { usuario, ppe, acesso } = await carregarComAcesso(String(formData.get('ppeId') ?? ''));
  if (!ppe || !acesso.definir) return { mensagem: 'Você não pode mudar a situação desta PPE.' };
  const destino = String(formData.get('status') ?? '') as StatusPPE;
  if (!TRANSICOES[ppe.status].includes(destino)) return { mensagem: 'Mudança de situação não permitida a partir da situação atual.' };
  if (exigeCoordenacao(destino) && !acesso.gerenciar) return { mensagem: 'Só a Coordenação marca o lançamento no sistema acadêmico (Art. 125).' };

  const dados: { status: StatusPPE; notaFinal?: number | null } = { status: destino };
  const nota = String(formData.get('notaFinal') ?? '').trim().replace(',', '.');
  if (destino === 'APROVADO' || destino === 'REPROVADO') {
    if (nota && !/^\d{1,2}(\.\d{1,2})?$/.test(nota)) return { erros: { notaFinal: 'Nota de 0 a 10 (ex.: 7,5).' } };
    if (nota && Number(nota) > 10) return { erros: { notaFinal: 'Nota de 0 a 10 (ex.: 7,5).' } };
    dados.notaFinal = nota ? Number(nota) : null;
  }
  if (destino === 'PRORROGADO') {
    if (ppe.modalidade !== 'PEI' || !ppe.pei) return { mensagem: 'A prorrogação (Art. 124) vale para PEI com plano preenchido.' };
    const p = ProrrogacaoSchema.safeParse({ prorrogadoAte: formData.get('prorrogadoAte') ?? '', justificativaProrrogacao: formData.get('justificativaProrrogacao') ?? '' });
    if (!p.success) {
      const e = z.flattenError(p.error).fieldErrors;
      const erros: Record<string, string> = {};
      if (e.prorrogadoAte?.[0]) erros.prorrogadoAte = e.prorrogadoAte[0];
      if (e.justificativaProrrogacao?.[0]) erros.justificativaProrrogacao = e.justificativaProrrogacao[0];
      return { erros };
    }
    if (p.data.prorrogadoAte <= hojeEmFortaleza()) return { erros: { prorrogadoAte: 'A nova data-limite deve ser futura.' } };
    await prisma.planoEstudoIndividual.update({
      where: { id: ppe.pei.id },
      data: { prorrogadoAte: dataParaBanco(p.data.prorrogadoAte), justificativaProrrogacao: p.data.justificativaProrrogacao },
    });
  }
  await prisma.registroPPE.update({ where: { id: ppe.id }, data: dados });
  await registrarAuditoria({ userId: usuario.id, acao: 'MUDOU_SITUACAO_PPE', entidade: 'RegistroPPE', entidadeId: ppe.id, detalhes: { de: ppe.status, para: destino } });
  revalidatePath(`/ppe/${ppe.id}`);
  revalidatePath('/ppe');
  return { sucesso: true, mensagem: 'Situação atualizada.' };
}

export async function excluirPpe(_estado: EstadoPpe | undefined, formData: FormData): Promise<EstadoPpe> {
  const { usuario } = await exigirPermissao('ppe:gerenciar');
  if (formData.get('confirmo') !== 'on') return { mensagem: 'Marque a confirmação para excluir.' };
  const ppe = await prisma.registroPPE.findUnique({ where: { id: String(formData.get('ppeId') ?? '') } });
  if (!ppe) return { mensagem: 'PPE não encontrada.' };
  if (ppe.status === 'LANCADO_ACADEMICO') return { mensagem: 'PPE já lançada no sistema acadêmico não pode ser excluída.' };
  await prisma.$transaction(async (tx) => {
    await tx.registroPPE.delete({ where: { id: ppe.id } });
    await recalcularRetencao(tx, ppe.matricula, ppe.semestre);
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'EXCLUIU_PPE', entidade: 'RegistroPPE', entidadeId: ppe.id, detalhes: { semestre: ppe.semestre, status: ppe.status } });
  revalidatePath('/ppe');
  redirect(`/ppe?semestre=${ppe.semestre}&aviso=excluida`);
}


export type EstadoEnvio = { mensagem?: string; sucesso?: boolean };

/** Registra no histórico o envio (manual) de uma mensagem pronta da PPE. */
export async function registrarEnvioPpe(_e: EstadoEnvio | undefined, formData: FormData): Promise<EstadoEnvio> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const modo = lerModoEnvio(formData.get('modo'));
  if (!modo) return { mensagem: 'Escolha por onde a mensagem foi enviada.' };
  const dados = await mensagensDaPpe(String(formData.get('id') ?? ''));
  if (!dados) return { mensagem: 'PPE não encontrada.' };
  const m = dados.mensagens.find((x) => x.chave === String(formData.get('chave') ?? ''));
  if (!m || formData.get('situacao') !== dados.situacao) return { mensagem: 'Esta mensagem não se aplica mais. Recarregue a página.' };
  const log = await prisma.logComunicacao.create({
    data: { canal: m.canal, destino: m.destino, chave: chaveEnvioPpe(dados.situacao, m.chave, dados.id), assunto: m.assunto, mensagem: m.texto, modoEnvio: modo, sucesso: true, userId: usuario.id },
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'REGISTROU_ENVIO_MENSAGEM', entidade: 'LogComunicacao', entidadeId: log.id, detalhes: { canal: m.canal, modo, origem: 'ppe', situacao: dados.situacao } });
  revalidatePath(`/ppe/${dados.id}/comunicar`);
  revalidatePath('/comunicacao');
  return { sucesso: true, mensagem: `Envio por ${NOME_MODO[modo].toLowerCase()} registrado no histórico.` };
}
