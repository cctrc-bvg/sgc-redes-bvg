'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import type { EstadoImportacao } from '@/lib/importacao/estado';
import { COLUNAS_OFERTA, planejarImportacaoOfertas } from '@/lib/importacao/ofertas';
import { avisoColunasDesconhecidas, lerEntrada, serializarDados } from '@/lib/importacao/servidor';
import { PERFIS_DOCENTES } from '@/lib/ofertas/regras';

export async function importarOfertas(_estado: EstadoImportacao | undefined, formData: FormData): Promise<EstadoImportacao> {
  const { usuario } = await exigirPermissao('ofertas:gerenciar');
  const entrada = await lerEntrada(formData, COLUNAS_OFERTA);
  if ('erro' in entrada) return { mensagem: entrada.erro };
  const [turmas, disciplinas, docentes, ofertas] = await Promise.all([
    prisma.turma.findMany({ select: { id: true, codigo: true, anoCurso: true, ativa: true } }),
    prisma.disciplina.findMany({ select: { id: true, codigo: true, nome: true, anoCurso: true, semestreCurso: true, cargaHoraria: true, ativa: true } }),
    prisma.user.findMany({ where: { ativo: true, role: { in: [...PERFIS_DOCENTES] } }, select: { id: true, email: true, nome: true } }),
    prisma.disciplinaOferta.findMany({ select: { id: true, anoLetivo: true, turmaId: true, disciplinaId: true, professorId: true } }),
  ]);
  const plano = planejarImportacaoOfertas({ registros: entrada.registros, contexto: { turmas, disciplinas, docentes, ofertas } });
  const avisos = avisoColunasDesconhecidas(entrada.desconhecidas);
  const nada = plano.criar.length + plano.alterar.length === 0;

  if (!entrada.confirmar || plano.temErros) {
    if (plano.temErros) return { linhas: plano.linhas, avisos, mensagem: 'Há linhas com erro. Nada foi gravado: corrija a planilha e envie de novo.' };
    return {
      linhas: plano.linhas,
      avisos,
      dados: nada ? undefined : serializarDados(entrada),
      mensagem: nada
        ? 'A planilha é igual à distribuição atual: não há nada para gravar.'
        : `Prévia pronta: ${plano.criar.length} oferta(s) nova(s) e ${plano.alterar.length} troca(s) de professor. Confira e confirme abaixo.`,
    };
  }
  if (nada) return { concluido: true, sucesso: true, mensagem: 'Nada para gravar: a distribuição já está igual à planilha.' };
  try {
    await prisma.$transaction([
      ...plano.criar.map((o) => prisma.disciplinaOferta.create({ data: o })),
      ...plano.alterar.map((a) => prisma.disciplinaOferta.update({ where: { id: a.id }, data: { professorId: a.professorId } })),
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
