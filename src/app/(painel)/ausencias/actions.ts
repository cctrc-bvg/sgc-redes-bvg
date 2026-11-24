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
  hojeEmFortaleza,
  planejarCoberturas,
  PREFIXO_DECISAO,
  statusDaAusencia,
} from '@/lib/ausencias/regras';
import { carregarDia, contextoDaAusencia, impactoDaTurma, recalcularAlertasDaTurma } from '@/lib/ausencias/servidor';

// Ids chegam por campo oculto, nunca por `acao.bind(null, id)` (ver usuarios/actions.ts).

export type EstadoRegistro = {
  erros?: Partial<Record<'motivoOperacional' | 'aulas' | 'data' | 'professorId', string[]>>;
  mensagem?: string;
  valores?: { motivoOperacional: string; aulas: string[] };
};

export async function registrarAusencia(_estado: EstadoRegistro | undefined, formData: FormData): Promise<EstadoRegistro> {
  const { usuario: editor } = await exigirPermissao('ausencias:registrar');
  const valores = {
    professorId: String(formData.get('professorId') ?? ''),
    data: String(formData.get('data') ?? ''),
    motivoOperacional: String(formData.get('motivoOperacional') ?? ''),
    aulas: formData.getAll('aula').map(String),
  };
  const devolver = { motivoOperacional: valores.motivoOperacional, aulas: valores.aulas };
  const validacao = criarRegistroAusenciaSchema(hojeEmFortaleza()).safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores: devolver };
  const { professorId, data, motivoOperacional, aulas } = validacao.data;

  const dia = await carregarDia(data);
  const daProfessor = dia.aulasDoDia.filter((a) => a.professorId === professorId);
  const grupos = agruparAulasEscolhidas(daProfessor, aulas, dia.blocos);
  if (grupos.length === 0) {
    return { mensagem: 'As aulas marcadas não pertencem mais a este professor nesta data. Recarregue a página.', valores: devolver };
  }
  const jaRegistradas = new Set(dia.ausencias.map((a) => a.ofertaId));
  if (grupos.some((g) => jaRegistradas.has(g.ofertaId))) {
    return { mensagem: 'Já existe ausência registrada para uma das disciplinas marcadas nesta data. Abra-a na lista de ausências.', valores: devolver };
  }

  const codigo = new Map(dia.blocos.map((b) => [b.id, codigoBloco(b)]));
  let criadas: string[];
  try {
    criadas = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const g of grupos) {
        const a = await tx.ausenciaDocente.create({
          data: {
            dataAula: dataParaBanco(data),
            turmaId: g.turmaId,
            ofertaId: g.ofertaId,
            professorAusenteId: professorId,
            blocosAfetados: g.blocoIds.map((b) => codigo.get(b)).join(','),
            motivoOperacional,
          },
        });
        ids.push(a.id);
      }
      return ids;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { mensagem: 'Outra pessoa acabou de registrar esta ausência. Abra-a na lista de ausências.', valores: devolver };
    }
    throw e;
  }
  for (const id of criadas) {
    await registrarAuditoria({ userId: editor.id, acao: 'REGISTROU_AUSENCIA', entidade: 'AusenciaDocente', entidadeId: id });
  }
  revalidatePath('/ausencias');
  redirect(criadas.length === 1 ? `/ausencias/${criadas[0]}?aviso=registrada` : `/ausencias?data=${data}&aviso=registradas`);
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

export type EstadoCancelamento = { mensagem?: string };

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
