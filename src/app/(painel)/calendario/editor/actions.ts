'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { aplicarEdicoes, estadoDoInstantaneo, instantaneoDoEstado, TIPOS_DO_EDITOR, validarEdicoes } from '@/lib/calendario/editor';
import { MOTIVOS_SUSPENSAO } from '@/lib/calendario/regras';
import { aplicarInstantaneo, aplicarPeriodos, carregarRevisao, instantaneoAtual, registrarRevisaoSeMudou, ultimaRevisao } from '@/lib/calendario/revisoes';
import { lerAnoLetivo } from '@/lib/ofertas/regras';

export interface ResultadoEdicao {
  sucesso?: boolean;
  mensagem?: string;
  /** Número da revisão gerada (ou null se nada mudou de fato). */
  numero?: number | null;
  /** Suspensão não prevista criada: leva às mensagens prontas. */
  avisarEventoId?: string;
}

function revalidar() {
  revalidatePath('/calendario');
  revalidatePath('/alimentacao');
  revalidatePath('/ausencias');
  revalidatePath('/diarios');
  revalidatePath('/painel');
}

/** Grava os dias alterados no editor, de uma vez, e registra a revisão. */
export async function salvarEdicaoDoCalendario(entrada: { ano: number; baseNumero: number; motivo: string; edicoes: unknown }): Promise<ResultadoEdicao> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const ano = lerAnoLetivo(String(entrada.ano));
  if (!ano) return { mensagem: 'Ano inválido. Recarregue a página.' };
  const v = validarEdicoes(entrada.edicoes, ano, MOTIVOS_SUSPENSAO);
  if (!v.ok) return { mensagem: v.erro };
  const ultima = await ultimaRevisao(ano);
  if ((ultima?.numero ?? 0) !== Number(entrada.baseNumero)) {
    return { mensagem: 'O calendário foi alterado por outra pessoa desde que você abriu esta tela. Recarregue a página para ver a versão atual e refaça as marcações.' };
  }
  const atual = await instantaneoAtual(ano);
  const novo = instantaneoDoEstado(aplicarEdicoes(estadoDoInstantaneo(atual), v.edicoes), atual.etapas, atual.semestres);
  const { criados } = await prisma.$transaction((tx) => aplicarInstantaneo(tx, ano, novo, TIPOS_DO_EDITOR));
  const numero = await registrarRevisaoSeMudou({ ano, autorId: usuario.id, origem: 'EDITOR', motivo: entrada.motivo.slice(0, 200) });
  await registrarAuditoria({ userId: usuario.id, acao: 'EDITOU_CALENDARIO', entidade: 'CalendarioRevisao', entidadeId: `${ano}:${numero ?? ultima?.numero ?? 0}`, detalhes: { ano, dias: v.edicoes.length, revisao: numero } });
  revalidar();
  const imprevisto = criados.find((c) => c.tipo === 'SUSPENSAO_AULAS' && c.imprevisto);
  return { sucesso: true, numero, avisarEventoId: imprevisto?.id, mensagem: numero ? `Calendário salvo (revisão ${numero}).` : 'Nenhuma alteração para salvar.' };
}

/** Restaura uma revisão antiga como o calendário vigente; vira uma revisão nova (o histórico nunca se apaga). */
export async function restaurarRevisaoDoCalendario(formData: FormData): Promise<void> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const ano = lerAnoLetivo(formData.get('ano'));
  const numero = Number(formData.get('numero'));
  if (!ano || !Number.isInteger(numero)) redirect('/calendario/editor');
  if (formData.get('confirmo') !== 'on') redirect(`/calendario/editor?ano=${ano}&revisao=${numero}&aviso=confirme`);
  const rev = await carregarRevisao(ano, numero);
  if (!rev) redirect(`/calendario/editor?ano=${ano}`);
  await prisma.$transaction(async (tx) => {
    await aplicarInstantaneo(tx, ano, rev.dados);
    await aplicarPeriodos(tx, ano, rev.dados);
  });
  const nova = await registrarRevisaoSeMudou({ ano, autorId: usuario.id, origem: 'RESTAURACAO', motivo: `Restaurou a revisão ${numero}` });
  await registrarAuditoria({ userId: usuario.id, acao: 'RESTAUROU_CALENDARIO', entidade: 'CalendarioRevisao', entidadeId: `${ano}:${numero}`, detalhes: { ano, de: numero, revisao: nova } });
  revalidar();
  redirect(`/calendario/editor?ano=${ano}&aviso=restaurado`);
}
