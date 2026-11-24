'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataDoBanco, dataParaBanco } from '@/lib/ausencias/regras';
import type { EstadoImportacao } from '@/lib/importacao/estado';
import { COLUNAS_SABADO, planejarImportacaoSabados } from '@/lib/importacao/sabados';
import { avisoColunasDesconhecidas, lerEntrada, serializarDados } from '@/lib/importacao/servidor';

export async function importarSabados(_estado: EstadoImportacao | undefined, formData: FormData): Promise<EstadoImportacao> {
  const { usuario } = await exigirPermissao('grade:editar');
  const entrada = await lerEntrada(formData, COLUNAS_SABADO);
  if ('erro' in entrada) return { mensagem: entrada.erro };
  const existentes = (await prisma.sabadoLetivo.findMany()).map((s) => ({ id: s.id, data: dataDoBanco(s.data), diaSemanaReferente: s.diaSemanaReferente, observacao: s.observacao }));
  const plano = planejarImportacaoSabados({ registros: entrada.registros, presentes: entrada.presentes, existentes });
  const avisos = avisoColunasDesconhecidas(entrada.desconhecidas);
  const nada = plano.criar.length + plano.atualizar.length === 0;

  if (!entrada.confirmar || plano.temErros) {
    if (plano.temErros) return { linhas: plano.linhas, avisos, mensagem: 'Há linhas com erro. Nada foi gravado: corrija a planilha e envie de novo.' };
    return {
      linhas: plano.linhas,
      avisos,
      dados: nada ? undefined : serializarDados(entrada),
      mensagem: nada
        ? 'A planilha é igual ao calendário cadastrado: não há nada para gravar.'
        : `Prévia pronta: ${plano.criar.length} sábado(s) novo(s) e ${plano.atualizar.length} a alterar. Confira e confirme abaixo.`,
    };
  }
  if (nada) return { concluido: true, sucesso: true, mensagem: 'Nada para gravar: o calendário já está igual à planilha.' };
  try {
    await prisma.$transaction([
      ...plano.criar.map((s) => prisma.sabadoLetivo.create({ data: { data: dataParaBanco(s.data), diaSemanaReferente: s.diaSemanaReferente, observacao: s.observacao } })),
      ...plano.atualizar.map((s) => prisma.sabadoLetivo.update({ where: { id: s.id }, data: { diaSemanaReferente: s.diaSemanaReferente, observacao: s.observacao } })),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || e.code === 'P2025')) {
      return { mensagem: 'O calendário mudou durante a importação. Nada foi gravado: envie a planilha de novo.' };
    }
    throw e;
  }
  await registrarAuditoria({ userId: usuario.id, acao: 'IMPORTOU_SABADOS_LETIVOS', entidade: 'SabadoLetivo', entidadeId: 'importacao', detalhes: { criados: plano.criar.length, alterados: plano.atualizar.length } });
  revalidatePath('/grade/sabados');
  revalidatePath('/grade');
  return { concluido: true, sucesso: true, mensagem: `Importação concluída: ${plano.criar.length} sábado(s) cadastrado(s) e ${plano.atualizar.length} alterado(s).` };
}
