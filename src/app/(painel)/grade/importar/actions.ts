'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { lerSemestreLetivo } from '@/lib/grade/regras';
import type { EstadoImportacao } from '@/lib/importacao/estado';
import { COLUNAS_GRADE, planejarImportacaoGrade } from '@/lib/importacao/grade';
import { dadosDaGrade } from '@/lib/importacao/grade-servidor';
import { avisoColunasDesconhecidas, lerEntrada, serializarDados } from '@/lib/importacao/servidor';
import { lerAnoLetivo } from '@/lib/ofertas/regras';

/**
 * Importa a grade de um semestre. Ano, semestre e modo vêm ligados pela página (não são segredo e são
 * validados de novo aqui); a permissão é conferida a cada envio.
 */
export async function importarGrade(
  periodo: { ano: string; sem: string; modo: string },
  _estado: EstadoImportacao | undefined,
  formData: FormData,
): Promise<EstadoImportacao> {
  const { usuario } = await exigirPermissao('grade:editar');
  const anoLetivo = lerAnoLetivo(periodo.ano);
  const semestreLetivo = lerSemestreLetivo(periodo.sem);
  if (!anoLetivo || !semestreLetivo) return { mensagem: 'Período inválido. Recarregue a página.' };
  const substituir = periodo.modo === 'substituir';
  const entrada = await lerEntrada(formData, COLUNAS_GRADE);
  if ('erro' in entrada) return { mensagem: entrada.erro };
  const dados = await dadosDaGrade(anoLetivo, semestreLetivo);
  const plano = planejarImportacaoGrade({ registros: entrada.registros, ...dados, substituir });
  const avisos = avisoColunasDesconhecidas(entrada.desconhecidas);
  const total = plano.gravar.length + plano.remover.length;

  if (!entrada.confirmar || plano.temErros) {
    if (plano.temErros) return { linhas: plano.linhas, avisos, mensagem: 'Há linhas com erro. Nada foi gravado: corrija a planilha e envie de novo.' };
    return {
      linhas: plano.linhas,
      avisos,
      dados: total ? serializarDados(entrada) : undefined,
      mensagem: total
        ? `Prévia da grade ${anoLetivo}.${semestreLetivo}: ${plano.gravar.length} horário(s) a preencher ou trocar e ${plano.remover.length} a liberar${substituir ? ' (modo substituir)' : ''}. Confira e confirme abaixo.`
        : 'A planilha é igual à grade cadastrada: não há nada para gravar.',
    };
  }
  if (!total) return { concluido: true, sucesso: true, mensagem: 'Nada para gravar: a grade já está igual à planilha.' };
  const periodoBd = { anoLetivo, semestreLetivo };
  try {
    await prisma.$transaction([
      ...plano.gravar.map((c) =>
        prisma.gradeHorario.upsert({
          where: { anoLetivo_semestreLetivo_turmaId_diaSemana_blocoId: { ...periodoBd, turmaId: c.turmaId, diaSemana: c.diaSemana, blocoId: c.blocoId } },
          create: { ...periodoBd, ...c },
          update: { ofertaId: c.ofertaId },
        }),
      ),
      ...plano.remover.map((c) => prisma.gradeHorario.deleteMany({ where: { ...periodoBd, ...c } })),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2003', 'P2025'].includes(e.code)) {
      return { mensagem: 'A grade mudou durante a importação. Nada foi gravado: envie a planilha de novo.' };
    }
    throw e;
  }
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'IMPORTOU_GRADE',
    entidade: 'GradeHorario',
    entidadeId: `${anoLetivo}.${semestreLetivo}`,
    detalhes: { anoLetivo, semestreLetivo, gravadas: plano.gravar.length, liberadas: plano.remover.length, substituir },
  });
  revalidatePath('/grade');
  return {
    concluido: true,
    sucesso: true,
    mensagem: `Grade ${anoLetivo}.${semestreLetivo} importada: ${plano.gravar.length} horário(s) preenchido(s) ou trocado(s) e ${plano.remover.length} liberado(s).`,
  };
}
