'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirUsuario } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { dataDoBanco, dataParaBanco, hojeEmFortaleza } from '@/lib/ausencias/regras';
import { nomeSeguroDoAnexo, ReposicaoSchema, validarAnexo, validarDataReposicao } from '@/lib/reposicao/regras';

export type EstadoReposicao = {
  mensagem?: string;
  sucesso?: boolean;
  erros?: Partial<Record<'data' | 'observacao' | 'formulario', string[]>>;
};

/** Quem pode mexer na reposição: a Coordenação (qualquer) ou o próprio docente ausente. */
async function autorizar(ausenciaId: string) {
  const { usuario } = await exigirUsuario();
  const coordenacao = temPermissao(usuario, 'ausencias:registrar');
  if (!coordenacao && !temPermissao(usuario, 'ausencias:informar')) return { erro: 'Sem permissão.' } as const;
  const ausencia = await prisma.ausenciaDocente.findUnique({
    where: { id: ausenciaId },
    select: { id: true, dataAula: true, status: true, professorAusenteId: true, reposicaoEm: true, reposicaoCienteEm: true, _count: { select: { anexosReposicao: true } } },
  });
  if (!ausencia || (!coordenacao && ausencia.professorAusenteId !== usuario.id)) return { erro: 'Ausência não encontrada.' } as const;
  return { usuario, coordenacao, ausencia } as const;
}

/** Lê o arquivo opcional do formulário; null se não enviou nada. */
async function lerFormulario(formData: FormData, existentes: number): Promise<{ erro: string } | { bytes: Buffer; mime: string; ext: string; nome: string } | null> {
  const arquivo = formData.get('formulario');
  if (!(arquivo instanceof File) || arquivo.size === 0) return null;
  if (arquivo.size > 5 * 1024 * 1024) return { erro: 'O arquivo passa de 5 MB. Reduza-o ou envie pelo e-mail institucional.' };
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const tipo = validarAnexo(bytes, existentes);
  if ('erro' in tipo) return tipo;
  return { bytes, mime: tipo.mime, ext: tipo.ext, nome: nomeSeguroDoAnexo(arquivo.name, tipo.ext) };
}

async function guardarFormulario(ausenciaId: string, userId: string, f: { bytes: Buffer; mime: string; nome: string }) {
  return prisma.anexoReposicao.create({
    data: { ausenciaId, nome: f.nome, tipoMime: f.mime, tamanho: f.bytes.length, conteudo: new Uint8Array(f.bytes), enviadoPorId: userId },
  });
}

/**
 * Informa (docente) ou registra (Coordenação) que a aula foi reposta. O formulário em anexo é opcional. Quando a
 * Coordenação registra, a ciência é imediata; quando o docente informa, a Coordenação ainda dá ciência.
 */
export async function registrarReposicao(_estado: EstadoReposicao | undefined, formData: FormData): Promise<EstadoReposicao> {
  const ctx = await autorizar(String(formData.get('ausenciaId') ?? ''));
  if ('erro' in ctx) return { mensagem: ctx.erro };
  const { usuario, coordenacao, ausencia } = ctx;
  if (ausencia.reposicaoEm) return { mensagem: 'A reposição desta aula já foi registrada.' };
  if (ausencia.status !== 'TURMA_DISPENSADA' && ausencia.status !== 'REPOSICAO_AGENDADA') return { mensagem: 'Esta ausência não tem aula a repor.' };

  const parsed = ReposicaoSchema.safeParse({ data: String(formData.get('data') ?? ''), observacao: String(formData.get('observacao') ?? '') });
  if (!parsed.success) return { erros: z.flattenError(parsed.error).fieldErrors };
  const erroData = validarDataReposicao(parsed.data.data, dataDoBanco(ausencia.dataAula), hojeEmFortaleza());
  if (erroData) return { erros: { data: [erroData] } };
  const formulario = await lerFormulario(formData, ausencia._count.anexosReposicao);
  if (formulario && 'erro' in formulario) return { erros: { formulario: [formulario.erro] } };

  const agora = new Date();
  await prisma.ausenciaDocente.update({
    where: { id: ausencia.id },
    data: {
      reposicaoEm: dataParaBanco(parsed.data.data),
      reposicaoOrigem: coordenacao ? 'COORDENACAO' : 'DOCENTE',
      reposicaoObservacao: parsed.data.observacao ?? null,
      reposicaoInformadaEm: agora,
      ...(coordenacao ? { reposicaoCienteEm: agora, reposicaoCientePorId: usuario.id } : {}),
    },
  });
  if (formulario) await guardarFormulario(ausencia.id, usuario.id, formulario);
  await registrarAuditoria({
    userId: usuario.id,
    acao: coordenacao ? 'REGISTROU_REPOSICAO' : 'INFORMOU_REPOSICAO',
    entidade: 'AusenciaDocente',
    entidadeId: ausencia.id,
    detalhes: { data: parsed.data.data, comFormulario: Boolean(formulario) },
  });
  revalidarReposicoes(ausencia.id);
  return { sucesso: true, mensagem: coordenacao ? 'Reposição registrada.' : 'Reposição informada. A Coordenação será avisada na tela inicial.' };
}

/** Anexa o formulário depois (docente ou Coordenação), sem mudar a situação da reposição. */
export async function anexarFormulario(_estado: EstadoReposicao | undefined, formData: FormData): Promise<EstadoReposicao> {
  const ctx = await autorizar(String(formData.get('ausenciaId') ?? ''));
  if ('erro' in ctx) return { mensagem: ctx.erro };
  const { usuario, ausencia } = ctx;
  const formulario = await lerFormulario(formData, ausencia._count.anexosReposicao);
  if (!formulario) return { erros: { formulario: ['Escolha o arquivo do formulário (PDF, JPG ou PNG).'] } };
  if ('erro' in formulario) return { erros: { formulario: [formulario.erro] } };
  await guardarFormulario(ausencia.id, usuario.id, formulario);
  await registrarAuditoria({ userId: usuario.id, acao: 'ANEXOU_FORMULARIO_REPOSICAO', entidade: 'AusenciaDocente', entidadeId: ausencia.id });
  revalidarReposicoes(ausencia.id);
  return { sucesso: true, mensagem: 'Formulário anexado.' };
}

/** A Coordenação dá ciência da reposição informada pelo docente. */
export async function darCienciaReposicao(formData: FormData): Promise<void> {
  const ctx = await autorizar(String(formData.get('ausenciaId') ?? ''));
  if ('erro' in ctx || !ctx.coordenacao || !ctx.ausencia.reposicaoEm || ctx.ausencia.reposicaoCienteEm) return;
  await prisma.ausenciaDocente.update({ where: { id: ctx.ausencia.id }, data: { reposicaoCienteEm: new Date(), reposicaoCientePorId: ctx.usuario.id } });
  await registrarAuditoria({ userId: ctx.usuario.id, acao: 'DEU_CIENCIA_REPOSICAO', entidade: 'AusenciaDocente', entidadeId: ctx.ausencia.id });
  revalidarReposicoes(ctx.ausencia.id);
}

/** A Coordenação desfaz um registro de reposição feito por engano (os arquivos anexados ficam). */
export async function desfazerReposicao(formData: FormData): Promise<void> {
  const ctx = await autorizar(String(formData.get('ausenciaId') ?? ''));
  if ('erro' in ctx || !ctx.coordenacao || !ctx.ausencia.reposicaoEm) return;
  await prisma.ausenciaDocente.update({
    where: { id: ctx.ausencia.id },
    data: { reposicaoEm: null, reposicaoOrigem: null, reposicaoObservacao: null, reposicaoInformadaEm: null, reposicaoCienteEm: null, reposicaoCientePorId: null },
  });
  await registrarAuditoria({ userId: ctx.usuario.id, acao: 'DESFEZ_REPOSICAO', entidade: 'AusenciaDocente', entidadeId: ctx.ausencia.id });
  revalidarReposicoes(ctx.ausencia.id);
}

function revalidarReposicoes(ausenciaId: string) {
  revalidatePath('/reposicoes');
  revalidatePath(`/ausencias/${ausenciaId}`);
  revalidatePath('/painel');
  revalidatePath('/diarios');
}
