'use server';

import * as z from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { AcrescimoSchema, planejarAcrescimo } from '@/lib/alimentacao/acrescimo';
import { lerQuantidade } from '@/lib/alimentacao/previsao';
import { ALUNOS_MAXIMO } from '@/lib/turmas/regras';
import { hojeEmFortaleza } from '@/lib/ausencias/regras';
import { temPermissao } from '@/lib/auth/rbac';

/** Quem pode comunicar vai direto para as mensagens prontas do dia (CAE, nutricionista, Gestão, turmas). */
const paginaComunicar = (dataRefeicao: Date, motivo: 'acrescimo' | 'ajuste' | 'ciencia') =>
  `/alimentacao/comunicar?data=${hojeEmFortaleza(dataRefeicao)}&motivo=${motivo}`;

export type EstadoAviso = { mensagem?: string; sucesso?: boolean };

/** A Assistência Estudantil dá ciência do aviso (RF04). */
export async function darCiencia(_estado: EstadoAviso | undefined, formData: FormData): Promise<EstadoAviso> {
  const { usuario } = await exigirPermissao('alimentacao:confirmar');
  const alertaId = String(formData.get('alertaId') ?? '');
  const alvo = await prisma.alertaAlimentacao.findUnique({ where: { id: alertaId }, select: { id: true, canceladoEm: true, confirmadoAE: true, dataRefeicao: true } });
  if (!alvo) return { mensagem: 'Aviso não encontrado.' };
  if (alvo.canceladoEm) return { mensagem: 'Este aviso foi cancelado pela Coordenação: a refeição volta ao normal.' };
  if (alvo.confirmadoAE) return { sucesso: true, mensagem: 'Ciência já registrada.' };
  await prisma.alertaAlimentacao.update({ where: { id: alvo.id }, data: { confirmadoAE: true, confirmadoEm: new Date() } });
  await registrarAuditoria({ userId: usuario.id, acao: 'DEU_CIENCIA_ALIMENTACAO', entidade: 'AlertaAlimentacao', entidadeId: alvo.id });
  revalidatePath('/alimentacao');
  revalidatePath('/ausencias');
  if (temPermissao(usuario, 'comunicacao:enviar')) redirect(paginaComunicar(alvo.dataRefeicao, 'ciencia'));
  return { sucesso: true, mensagem: 'Ciência registrada.' };
}

/** G04: a Coordenação ajusta a quantidade (ex.: estudantes que esperam o ônibus e almoçam). */
export async function ajustarQuantidade(_estado: EstadoAviso | undefined, formData: FormData): Promise<EstadoAviso> {
  const { usuario } = await exigirPermissao('alimentacao:gerenciar');
  const alertaId = String(formData.get('alertaId') ?? '');
  const qtd = lerQuantidade(formData.get('qtdImpactada'), ALUNOS_MAXIMO);
  if (qtd === null) return { mensagem: `Informe um número de 0 a ${ALUNOS_MAXIMO}.` };
  const alvo = await prisma.alertaAlimentacao.findUnique({ where: { id: alertaId }, select: { id: true, canceladoEm: true, qtdImpactada: true, dataRefeicao: true } });
  if (!alvo || alvo.canceladoEm) return { mensagem: 'Aviso não encontrado ou cancelado.' };
  if (alvo.qtdImpactada === qtd) return { sucesso: true, mensagem: 'Nenhuma alteração.' };
  // Mudou a quantidade: a AE precisa dar ciência de novo.
  await prisma.alertaAlimentacao.update({ where: { id: alvo.id }, data: { qtdImpactada: qtd, confirmadoAE: false, confirmadoEm: null } });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'AJUSTOU_QUANTIDADE_ALIMENTACAO',
    entidade: 'AlertaAlimentacao',
    entidadeId: alvo.id,
    detalhes: { de: alvo.qtdImpactada, para: qtd },
  });
  revalidatePath('/alimentacao');
  revalidatePath('/ausencias');
  if (temPermissao(usuario, 'comunicacao:enviar')) redirect(paginaComunicar(alvo.dataRefeicao, 'ajuste'));
  return { sucesso: true, mensagem: 'Quantidade ajustada. A Assistência Estudantil precisa dar ciência de novo.' };
}

export type EstadoAcrescimo = {
  erros?: Partial<Record<'turmaId' | 'data' | 'refeicoes' | 'quantidade' | 'descricao', string[]>>;
  mensagem?: string;
  valores?: { turmaId: string; data: string; refeicoes: string[]; quantidade: string; descricao: string };
};

/** G05: refeição extra para encontro no contraturno (PEI, laboratório, reposição). */
export async function criarAcrescimo(_estado: EstadoAcrescimo | undefined, formData: FormData): Promise<EstadoAcrescimo> {
  const { usuario } = await exigirPermissao('alimentacao:gerenciar');
  const valores = {
    turmaId: String(formData.get('turmaId') ?? ''),
    data: String(formData.get('data') ?? ''),
    refeicoes: formData.getAll('refeicoes').map(String),
    quantidade: String(formData.get('quantidade') ?? ''),
    descricao: String(formData.get('descricao') ?? ''),
  };
  const validacao = AcrescimoSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };
  const d = validacao.data;
  const turma = await prisma.turma.findFirst({ where: { id: d.turmaId, ativa: true }, select: { id: true } });
  if (!turma) return { erros: { turmaId: ['Escolha uma turma ativa.'] }, valores };
  const { itens, passadas } = planejarAcrescimo(d, new Date());
  if (passadas.length > 0) return { erros: { refeicoes: ['Uma das refeições marcadas já passou. Desmarque-a ou escolha outra data.'] }, valores };

  const ids = await prisma.$transaction(
    itens.map((i) =>
      prisma.alertaAlimentacao.create({
        data: {
          turmaId: turma.id,
          dataRefeicao: i.instante,
          tipoRefeicao: i.tipo,
          acao: 'ADICIONAR_REFEICAO',
          qtdImpactada: d.quantidade,
          antecedenciaMin: i.antecedenciaMin,
          nivelSla: i.nivel,
          manual: true,
          descricao: d.descricao,
        },
        select: { id: true },
      }),
    ),
  );
  for (const { id } of ids) {
    await registrarAuditoria({ userId: usuario.id, acao: 'ADICIONOU_REFEICAO', entidade: 'AlertaAlimentacao', entidadeId: id, detalhes: { quantidade: d.quantidade } });
  }
  revalidatePath('/alimentacao');
  if (temPermissao(usuario, 'comunicacao:enviar')) redirect(`/alimentacao/comunicar?data=${d.data}&motivo=acrescimo`);
  redirect(`/alimentacao?data=${d.data}&aviso=acrescimo`);
}

/** Cancela um acréscimo manual ainda futuro (a AE vê o cancelamento). */
export async function cancelarAcrescimo(_estado: EstadoAviso | undefined, formData: FormData): Promise<EstadoAviso> {
  const { usuario } = await exigirPermissao('alimentacao:gerenciar');
  const alertaId = String(formData.get('alertaId') ?? '');
  const alvo = await prisma.alertaAlimentacao.findUnique({ where: { id: alertaId }, select: { id: true, manual: true, canceladoEm: true, dataRefeicao: true } });
  if (!alvo || !alvo.manual) return { mensagem: 'Só acréscimos lançados à mão podem ser cancelados aqui. Avisos de ausência mudam pela ausência.' };
  if (alvo.canceladoEm) return { sucesso: true, mensagem: 'Acréscimo já cancelado.' };
  if (alvo.dataRefeicao < new Date()) return { mensagem: 'A refeição já passou.' };
  await prisma.alertaAlimentacao.update({ where: { id: alvo.id }, data: { canceladoEm: new Date() } });
  await registrarAuditoria({ userId: usuario.id, acao: 'CANCELOU_ACRESCIMO_REFEICAO', entidade: 'AlertaAlimentacao', entidadeId: alvo.id });
  revalidatePath('/alimentacao');
  return { sucesso: true, mensagem: 'Acréscimo cancelado.' };
}
