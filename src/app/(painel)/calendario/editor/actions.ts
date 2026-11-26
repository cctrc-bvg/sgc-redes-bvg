'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { registrarAuditoria } from '@/lib/auditoria';
import { prisma } from '@/lib/db';
import { dataDoBanco, dataParaBanco, formatarData, hojeEmFortaleza } from '@/lib/ausencias/regras';
import { exigirPermissao } from '@/lib/auth/dal';
import { anoEmBranco, aplicarEdicoesAosEventos, impactoNosDias, modeloDoAno, TIPOS_DO_EDITOR, validarEdicoes } from '@/lib/calendario/editor';
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

/** Cria o calendário de um ano em branco a partir do ano anterior (ajustável depois no editor, com histórico). */
export async function criarAnoAPartirDoAnterior(formData: FormData): Promise<void> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const ano = lerAnoLetivo(formData.get('ano'));
  if (!ano) redirect('/calendario/editor');
  const origem = ano - 1;
  const resultado = await comTravaDoAno(ano, async (tx) => {
    if (!anoEmBranco(await instantaneoAtual(ano, tx))) return 'ocupado' as const;
    const anterior = await instantaneoAtual(origem, tx);
    if (anoEmBranco(anterior)) return 'sem-anterior' as const;
    const modelo = modeloDoAno(anterior, origem, ano);
    await aplicarInstantaneo(tx, ano, modelo);
    await aplicarPeriodos(tx, ano, modelo);
    await registrarRevisaoSeMudou({ ano, autorId: usuario.id, origem: 'MODELO', motivo: `Criado a partir do calendário de ${origem}` }, tx);
    return 'criado' as const;
  });
  if (resultado === 'criado') {
    await registrarAuditoria({ userId: usuario.id, acao: 'CRIOU_CALENDARIO_DO_ANO', entidade: 'CalendarioRevisao', entidadeId: `${ano}:1`, detalhes: { ano, deAno: origem } });
    revalidar();
  }
  redirect(`/calendario/editor?ano=${ano}&aviso=${resultado}`);
}

export interface PreviaDeImpacto {
  mensagem?: string;
  /** Frases sobre o que as alterações tocam fora do calendário (vazio = nada a avisar). */
  itens?: string[];
}

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/** O que as alterações ainda não salvas afetam: ausências, períodos especiais, dias passados e a contagem de aulas dos diários. */
export async function previaDoImpactoDoCalendario(entrada: { ano: number; edicoes: unknown }): Promise<PreviaDeImpacto> {
  await exigirPermissao('calendario:gerenciar');
  const ano = lerAnoLetivo(String(entrada.ano));
  if (!ano) return { mensagem: 'Ano inválido. Recarregue a página.' };
  const v = validarEdicoes(entrada.edicoes, ano, MOTIVOS_SUSPENSAO);
  if (!v.ok) return { mensagem: v.erro };
  const { perdidos, ganhos } = impactoNosDias(await instantaneoAtual(ano), v.edicoes, ano);
  const alertas: string[] = [];
  const hoje = hojeEmFortaleza();
  const mudados = [...perdidos, ...ganhos];
  if (perdidos.length) {
    const ausencias = await prisma.ausenciaDocente.count({ where: { dataAula: { in: perdidos.map(dataParaBanco) } } });
    if (ausencias) alertas.push(`${ausencias} ausência(s) de docente registrada(s) em dias que deixam de ser letivos: confira se continuam valendo.`);
    const especiais = await prisma.periodoEspecial.findMany({ where: { inicio: { lte: dataParaBanco(perdidos.at(-1)!) }, fim: { gte: dataParaBanco(perdidos[0]!) } }, select: { nome: true, inicio: true, fim: true } });
    const tocados = especiais.filter((p) => perdidos.some((d) => d >= dataDoBanco(p.inicio) && d <= dataDoBanco(p.fim)));
    if (tocados.length) alertas.push(`Períodos especiais que coincidem com dias que deixam de ser letivos: ${tocados.map((p) => p.nome).join(', ')}.`);
  }
  if (mudados.some((d) => d < hoje)) alertas.push('Há dias já passados: as aulas presumidas dos diários (e o que falta para cumprir) são recalculadas com a nova contagem.');
  // Sem nada a conferir, a tela grava direto (não pede confirmação à toa).
  if (alertas.length === 0) return { itens: [] };
  const itens = [...alertas];
  if (perdidos.length) itens.unshift(`${dias(perdidos.length)} deixam de ser letivos (${perdidos.slice(0, 3).map((d) => formatarData(d).slice(0, 5)).join(', ')}${perdidos.length > 3 ? '…' : ''}).`);
  if (ganhos.length) itens.splice(perdidos.length ? 1 : 0, 0, `${dias(ganhos.length)} passam a ser letivos.`);
  return { itens };
}
