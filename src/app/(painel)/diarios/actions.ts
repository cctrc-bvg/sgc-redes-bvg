'use server';

import * as z from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { validarDataISO } from '@/lib/alimentacao-engine';
import { dataParaBanco } from '@/lib/ausencias/regras';
import { DiarioSchema, lembreteDoDiario, validarMinistradas } from '@/lib/diarios/regras';
import { lerModoEnvio, NOME_MODO } from '@/lib/comunicacao/mensagem';
import { lerAnoLetivo } from '@/lib/ofertas/regras';
import { lerSemestreLetivo } from '@/lib/grade/regras';
import { situacoesAutomaticas } from '@/lib/diarios/servidor';
import { hojeEmFortaleza } from '@/lib/ausencias/regras';

export type EstadoDiario = {
  erros?: Partial<Record<'aulasMinistradas' | 'observacaoDiario', string[]>>;
  mensagem?: string;
  sucesso?: boolean;
  valores?: Record<string, string>;
};

export async function atualizarDiario(_estado: EstadoDiario | undefined, formData: FormData): Promise<EstadoDiario> {
  const { usuario } = await exigirPermissao('diarios:ver-todos');
  const ofertaId = String(formData.get('ofertaId') ?? '');
  const valores = {
    aulasMinistradas: String(formData.get('aulasMinistradas') ?? ''),
    diarioEmDia: formData.get('diarioEmDia') === 'on' ? 'on' : '',
    observacaoDiario: String(formData.get('observacaoDiario') ?? ''),
  };
  const validacao = DiarioSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };
  const atual = await prisma.disciplinaOferta.findUnique({ where: { id: ofertaId } });
  if (!atual) return { mensagem: 'Oferta não encontrada.' };
  const alto = validarMinistradas(validacao.data.aulasMinistradas, atual.aulasPrevistas);
  if (alto) return { erros: { aulasMinistradas: [alto] }, valores };

  // RF08-A: valor igual ao presumido de uma oferta automática continua automático; qualquer outro vira manual.
  const hoje = hojeEmFortaleza();
  const sit = (await situacoesAutomaticas(atual.anoLetivo, [atual], hoje)).get(atual.id);
  const presumido = sit?.presumido ?? null;
  const manual = atual.ministradasManual || presumido === null || validacao.data.aulasMinistradas !== presumido;
  // Valor diferente do que vale hoje vira o novo ponto de partida (valor + data); o mesmo valor não mexe em nada.
  const mudouValor = validacao.data.aulasMinistradas !== (sit?.efetivas ?? atual.aulasMinistradas);
  const novoPonto = manual && (mudouValor || !atual.ministradasManual);
  const dados = {
    aulasMinistradas: novoPonto ? validacao.data.aulasMinistradas : atual.aulasMinistradas,
    ministradasManual: manual,
    ministradasEm: novoPonto ? dataParaBanco(hoje) : atual.ministradasEm,
    diarioEmDia: validacao.data.diarioEmDia,
    observacaoDiario: validacao.data.observacaoDiario ?? null,
  };
  const alterados = (Object.keys(dados) as (keyof typeof dados)[]).filter((k) => String(dados[k]) !== String(atual[k]));
  if (alterados.length === 0) return { sucesso: true, mensagem: 'Nenhuma alteração para salvar.', valores };
  await prisma.disciplinaOferta.update({ where: { id: atual.id }, data: dados });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'ATUALIZOU_DIARIO',
    entidade: 'DisciplinaOferta',
    entidadeId: atual.id,
    detalhes: { camposAlterados: alterados, aulasMinistradas: dados.aulasMinistradas, diarioEmDia: dados.diarioEmDia },
  });
  revalidatePath('/diarios');
  return { sucesso: true, mensagem: 'Diário atualizado.', valores };
}

/** Descarta o lançamento manual: o diário volta a valer o presumido pela grade e pelo calendário. */
export async function voltarAoAutomatico(formData: FormData): Promise<void> {
  const { usuario } = await exigirPermissao('diarios:ver-todos');
  const ofertaId = String(formData.get('ofertaId') ?? '');
  const atual = await prisma.disciplinaOferta.findUnique({ where: { id: ofertaId }, select: { id: true, ministradasManual: true } });
  if (!atual || !atual.ministradasManual) return;
  await prisma.disciplinaOferta.update({ where: { id: atual.id }, data: { ministradasManual: false } });
  await registrarAuditoria({ userId: usuario.id, acao: 'ATUALIZOU_DIARIO', entidade: 'DisciplinaOferta', entidadeId: atual.id, detalhes: { voltouAoAutomatico: true } });
  revalidatePath('/diarios');
  revalidatePath(`/diarios/${atual.id}`);
}

/**
 * Conferência por amostra (G26): a Coordenação compara com o diário do sistema acadêmico. Valor igual ao presumido
 * confirma o automático; valor diferente vira lançamento manual. Também marca se o diário está em dia.
 */
export async function conferirDiario(formData: FormData): Promise<void> {
  const { usuario } = await exigirPermissao('diarios:ver-todos');
  const ofertaId = String(formData.get('ofertaId') ?? '');
  const texto = String(formData.get('aulasMinistradas') ?? '').trim();
  if (!/^\d{1,3}$/.test(texto)) return;
  const informado = Number(texto);
  const emDia = formData.get('diarioEmDia') === 'on';
  const atual = await prisma.disciplinaOferta.findUnique({ where: { id: ofertaId } });
  if (!atual || validarMinistradas(informado, atual.aulasPrevistas)) return;
  const hoje = hojeEmFortaleza();
  const sit = (await situacoesAutomaticas(atual.anoLetivo, [atual], hoje)).get(atual.id);
  const presumido = sit?.presumido ?? null;
  const igual = presumido !== null && informado === presumido;
  const manual = atual.ministradasManual || !igual;
  // Mesmo valor que já vale: nada muda. Valor diferente: vira o novo ponto de partida, a partir de hoje.
  const novoPonto = manual && (informado !== (sit?.efetivas ?? atual.aulasMinistradas) || !atual.ministradasManual);
  const dados = {
    aulasMinistradas: novoPonto ? informado : atual.aulasMinistradas,
    ministradasManual: manual,
    ministradasEm: novoPonto ? dataParaBanco(hoje) : atual.ministradasEm,
    diarioEmDia: emDia,
  };
  await prisma.disciplinaOferta.update({ where: { id: atual.id }, data: dados });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'ATUALIZOU_DIARIO',
    entidade: 'DisciplinaOferta',
    entidadeId: atual.id,
    detalhes: { conferencia: true, informado, presumido, confirmouAutomatico: igual && !atual.ministradasManual, diarioEmDia: emDia },
  });
  revalidatePath('/diarios');
  revalidatePath('/diarios/conferencia');
}

export type EstadoLembrete = { mensagem?: string; sucesso?: boolean };

/** Registra que o lembrete foi enviado pelo WhatsApp (modo semiautomático). */
export async function registrarLembrete(_estado: EstadoLembrete | undefined, formData: FormData): Promise<EstadoLembrete> {
  const { usuario } = await exigirPermissao('diarios:ver-todos');
  const ofertaId = String(formData.get('ofertaId') ?? '');
  const modo = lerModoEnvio(formData.get('modo'));
  if (!modo) return { mensagem: 'Escolha por onde o lembrete foi enviado.' };
  const atual = await prisma.disciplinaOferta.findUnique({
    where: { id: ofertaId },
    include: {
      turma: { select: { codigo: true } },
      disciplina: { select: { nome: true } },
      professor: { select: { nome: true, email: true, whatsapp: true, usaWhatsapp: true } },
    },
  });
  if (!atual) return { mensagem: 'Oferta não encontrada.' };
  const m = lembreteDoDiario(atual);
  await prisma.$transaction([
    prisma.disciplinaOferta.update({ where: { id: atual.id }, data: { ultimaCobranca: new Date() } }),
    prisma.logComunicacao.create({
      data: { canal: null, destino: m.destino, chave: m.chave, assunto: m.assunto, mensagem: m.texto, modoEnvio: modo, sucesso: true, userId: usuario.id },
    }),
  ]);
  await registrarAuditoria({ userId: usuario.id, acao: 'COBROU_DIARIO', entidade: 'DisciplinaOferta', entidadeId: atual.id, detalhes: { modo } });
  revalidatePath('/diarios');
  revalidatePath('/comunicacao');
  return { sucesso: true, mensagem: `Lembrete registrado (${NOME_MODO[modo].toLowerCase()}).` };
}

export type EstadoPeriodo = { mensagem?: string; sucesso?: boolean; erros?: Partial<Record<'inicio' | 'fim', string>> };

const dataOk = (v: string) => {
  try {
    validarDataISO(v);
    return true;
  } catch {
    return false;
  }
};

/** Início e fim do semestre letivo: base das aulas esperadas até hoje. */
export async function salvarPeriodo(_estado: EstadoPeriodo | undefined, formData: FormData): Promise<EstadoPeriodo> {
  const { usuario } = await exigirPermissao('diarios:ver-todos');
  const anoLetivo = lerAnoLetivo(formData.get('anoLetivo'));
  const semestreLetivo = lerSemestreLetivo(formData.get('semestreLetivo'));
  const inicio = String(formData.get('inicio') ?? '');
  const fim = String(formData.get('fim') ?? '');
  if (!anoLetivo || !semestreLetivo) return { mensagem: 'Período inválido. Recarregue a página.' };
  const erros: EstadoPeriodo['erros'] = {};
  if (!dataOk(inicio)) erros.inicio = 'Informe a data de início.';
  if (!dataOk(fim)) erros.fim = 'Informe a data de fim.';
  else if (dataOk(inicio) && fim <= inicio) erros.fim = 'O fim deve ser depois do início.';
  if (dataOk(inicio) && Number(inicio.slice(0, 4)) !== anoLetivo) {
    erros.inicio = `Use uma data de ${anoLetivo}.`;
  }
  if (Object.keys(erros).length > 0) return { erros };
  const salvo = await prisma.periodoLetivo.upsert({
    where: { anoLetivo_semestreLetivo: { anoLetivo, semestreLetivo } },
    update: { inicio: dataParaBanco(inicio), fim: dataParaBanco(fim) },
    create: { anoLetivo, semestreLetivo, inicio: dataParaBanco(inicio), fim: dataParaBanco(fim) },
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'DEFINIU_PERIODO_LETIVO', entidade: 'PeriodoLetivo', entidadeId: salvo.id, detalhes: { anoLetivo, semestreLetivo, inicio, fim } });
  revalidatePath('/diarios');
  return { sucesso: true, mensagem: 'Período salvo.' };
}
