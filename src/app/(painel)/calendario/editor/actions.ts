'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { aplicarEdicoesAosEventos, TIPOS_DO_EDITOR, validarEdicoes } from '@/lib/calendario/editor';
import { MOTIVOS_SUSPENSAO } from '@/lib/calendario/regras';
import { aplicarInstantaneo, aplicarPeriodos, carregarRevisao, comTravaDoAno, garantirRevisaoInicial, garantirRevisoesIniciais, instantaneoAtual, registrarRevisaoSeMudou, ultimaRevisao } from '@/lib/calendario/revisoes';
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
  const base = Number(entrada.baseNumero);
  if (!Number.isInteger(base) || base < 0) return { mensagem: 'Versão do calendário inválida. Recarregue a página.' };
  const motivo = typeof entrada.motivo === 'string' ? entrada.motivo.slice(0, 200) : '';
  // Tudo sob a trava do ano: conferência de conflito, alteração e revisão não se misturam com outra gravação.
  const r = await comTravaDoAno(ano, async (tx) => {
    const ultima = await ultimaRevisao(ano, tx);
    if ((ultima?.numero ?? 0) !== base) return { conflito: true as const };
    await garantirRevisaoInicial(ano, tx);
    const atual = await instantaneoAtual(ano, tx);
    const { criados } = await aplicarInstantaneo(tx, ano, aplicarEdicoesAosEventos(atual, v.edicoes), TIPOS_DO_EDITOR);
    const numero = await registrarRevisaoSeMudou({ ano, autorId: usuario.id, origem: 'EDITOR', motivo }, tx);
    return { conflito: false as const, criados, numero, anterior: (await ultimaRevisao(ano, tx))?.numero ?? 0 };
  });
  if (r.conflito) return { mensagem: 'O calendário foi alterado por outra pessoa desde que você abriu esta tela. Recarregue a página para ver a versão atual e refaça as marcações.' };
  const { criados, numero } = r;
  await registrarAuditoria({ userId: usuario.id, acao: 'EDITOU_CALENDARIO', entidade: 'CalendarioRevisao', entidadeId: `${ano}:${numero ?? r.anterior}`, detalhes: { ano, dias: v.edicoes.length, revisao: numero } });
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
  // Eventos que atravessam a virada pertencem também aos anos vizinhos: o histórico deles precisa começar antes e acompanhar depois.
  const vizinhos = [ano - 1, ano + 1];
  await garantirRevisoesIniciais([ano, ...vizinhos]);
  const nova = await comTravaDoAno(ano, async (tx) => {
    await aplicarInstantaneo(tx, ano, rev.dados);
    await aplicarPeriodos(tx, ano, rev.dados);
    return registrarRevisaoSeMudou({ ano, autorId: usuario.id, origem: 'RESTAURACAO', motivo: `Restaurou a revisão ${numero}` }, tx);
  });
  for (const v of vizinhos) await registrarRevisaoSeMudou({ ano: v, autorId: usuario.id, origem: 'RESTAURACAO', motivo: `Restauração da revisão ${numero} de ${ano}` });
  await registrarAuditoria({ userId: usuario.id, acao: 'RESTAUROU_CALENDARIO', entidade: 'CalendarioRevisao', entidadeId: `${ano}:${numero}`, detalhes: { ano, de: numero, revisao: nova } });
  revalidar();
  redirect(`/calendario/editor?ano=${ano}&aviso=restaurado`);
}
