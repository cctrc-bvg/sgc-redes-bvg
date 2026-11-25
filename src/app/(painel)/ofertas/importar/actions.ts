'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import type { EstadoImportacao } from '@/lib/importacao/estado';
import { COLUNAS_OFERTA, planejarImportacaoOfertas } from '@/lib/importacao/ofertas';
import { avisoColunasDesconhecidas, lerEntrada, serializarDados } from '@/lib/importacao/servidor';

export async function importarOfertas(_estado: EstadoImportacao | undefined, formData: FormData): Promise<EstadoImportacao> {
  const { usuario } = await exigirPermissao('ofertas:gerenciar');
  const entrada = await lerEntrada(formData, COLUNAS_OFERTA);
  if ('erro' in entrada) return { mensagem: entrada.erro };
  const [turmas, disciplinas, docentes, ofertas] = await Promise.all([
    prisma.turma.findMany({ select: { id: true, codigo: true, anoCurso: true, ativa: true } }),
    prisma.disciplina.findMany({ select: { id: true, codigo: true, nome: true, anoCurso: true, semestreCurso: true, cargaHoraria: true, ativa: true } }),
    // Qualquer conta ativa pode receber disciplina pela planilha; quem ainda não lecionava passa a lecionar.
    prisma.user.findMany({ where: { ativo: true }, select: { id: true, email: true, nome: true } }),
    prisma.disciplinaOferta.findMany({ select: { id: true, anoLetivo: true, turmaId: true, disciplinaId: true, professorId: true } }),
  ]);
  const plano = planejarImportacaoOfertas({ registros: entrada.registros, contexto: { turmas, disciplinas, docentes, ofertas } });
  const avisos = avisoColunasDesconhecidas(entrada.desconhecidas);
  const nada = plano.criar.length + plano.alterar.length === 0;
  const ignoradas = plano.linhas.filter((l) => l.situacao === 'ignorar').length;
  const sobreIgnoradas = ignoradas > 0 ? ` ${ignoradas} linha(s) sem professor ficaram de fora.` : '';

  if (!entrada.confirmar || plano.temErros) {
    if (plano.temErros) return { linhas: plano.linhas, avisos, mensagem: 'Há linhas com erro. Nada foi gravado: corrija a planilha e envie de novo.' };
    return {
      linhas: plano.linhas,
      avisos,
      dados: nada ? undefined : serializarDados(entrada),
      mensagem: nada
        ? `A planilha é igual à distribuição atual: não há nada para gravar.${sobreIgnoradas}`
        : `Prévia pronta: ${plano.criar.length} oferta(s) nova(s) e ${plano.alterar.length} troca(s) de professor.${sobreIgnoradas} Confira e confirme abaixo.`,
    };
  }
  if (nada) return { concluido: true, sucesso: true, mensagem: 'Nada para gravar: a distribuição já está igual à planilha.' };
  try {
    await prisma.$transaction([
      ...plano.criar.map((o) => prisma.disciplinaOferta.create({ data: o })),
      ...plano.alterar.map((a) => prisma.disciplinaOferta.update({ where: { id: a.id }, data: { professorId: a.professorId } })),
      prisma.user.updateMany({
        where: { id: { in: [...new Set([...plano.criar.map((o) => o.professorId), ...plano.alterar.map((a) => a.professorId)])] }, leciona: false },
        data: { leciona: true },
      }),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || e.code === 'P2025')) {
      return { mensagem: 'A distribuição mudou durante a importação. Nada foi gravado: envie a planilha de novo.' };
    }
    throw e;
  }
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'IMPORTOU_OFERTAS',
    entidade: 'DisciplinaOferta',
    entidadeId: 'importacao',
    detalhes: { criadas: plano.criar.length, alteradas: plano.alterar.map(({ id, professorAnterior, professorId }) => ({ id, professorAnterior, professorNovo: professorId })) },
  });
  revalidatePath('/ofertas');
  return { concluido: true, sucesso: true, mensagem: `Importação concluída: ${plano.criar.length} oferta(s) criada(s) e ${plano.alterar.length} professor(es) trocado(s).` };
}
