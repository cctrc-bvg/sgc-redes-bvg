'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { COLUNAS_DISCIPLINA, planejarImportacaoDisciplinas } from '@/lib/importacao/disciplinas';
import type { EstadoImportacao } from '@/lib/importacao/estado';
import { avisoColunasDesconhecidas, lerEntrada, serializarDados } from '@/lib/importacao/servidor';

export async function importarDisciplinas(_estado: EstadoImportacao | undefined, formData: FormData): Promise<EstadoImportacao> {
  const { usuario: editor } = await exigirPermissao('disciplinas:gerenciar');
  const entrada = await lerEntrada(formData, COLUNAS_DISCIPLINA);
  if ('erro' in entrada) return { mensagem: entrada.erro };

  const existentes = await prisma.disciplina.findMany({
    select: {
      id: true,
      codigo: true,
      nome: true,
      cargaHoraria: true,
      nucleo: true,
      anoCurso: true,
      semestreCurso: true,
      exigePratica: true,
      ementaUrl: true,
      ativa: true,
    },
  });
  const plano = planejarImportacaoDisciplinas({ registros: entrada.registros, presentes: entrada.presentes, existentes });
  const avisos = avisoColunasDesconhecidas(entrada.desconhecidas);
  const nada = plano.criar.length + plano.atualizar.length === 0;

  if (!entrada.confirmar || plano.temErros) {
    if (plano.temErros) {
      return {
        linhas: plano.linhas,
        avisos,
        mensagem: entrada.confirmar
          ? 'O catálogo mudou desde a prévia e agora há linhas com erro. Nada foi gravado: corrija a planilha e envie de novo.'
          : 'Há linhas com erro. Nada foi gravado: corrija a planilha e envie de novo.',
      };
    }
    return {
      linhas: plano.linhas,
      avisos,
      dados: nada ? undefined : serializarDados(entrada),
      mensagem: nada
        ? 'A planilha é igual ao catálogo: não há nada para gravar.'
        : `Prévia pronta: ${plano.criar.length} disciplina(s) nova(s) e ${plano.atualizar.length} a alterar. Confira e confirme abaixo.`,
    };
  }
  if (nada) return { concluido: true, sucesso: true, mensagem: 'Nada para gravar: o catálogo já está igual à planilha.' };

  try {
    await prisma.$transaction([
      ...plano.criar.map((d) => prisma.disciplina.create({ data: d })),
      ...plano.atualizar.map((a) => prisma.disciplina.update({ where: { id: a.id }, data: a.dados })),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || e.code === 'P2025')) {
      return { mensagem: 'O catálogo mudou durante a importação (código repetido ou disciplina removida). Nada foi gravado: envie a planilha de novo.' };
    }
    throw e;
  }
  await registrarAuditoria({
    userId: editor.id,
    acao: 'IMPORTOU_DISCIPLINAS',
    entidade: 'Disciplina',
    entidadeId: 'importacao',
    detalhes: { criadas: plano.criar.length, alteradas: plano.atualizar.map((a) => ({ id: a.id, campos: a.campos })) },
  });
  revalidatePath('/disciplinas');
  return {
    concluido: true,
    sucesso: true,
    mensagem: `Importação concluída: ${plano.criar.length} disciplina(s) cadastrada(s) e ${plano.atualizar.length} alterada(s).`,
  };
}
