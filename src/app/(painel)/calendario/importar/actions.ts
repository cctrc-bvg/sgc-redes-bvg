'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataParaBanco } from '@/lib/ausencias/regras';
import { carregarAno } from '@/lib/calendario/servidor';
import { COLUNAS_CALENDARIO, planejarImportacaoCalendario } from '@/lib/importacao/calendario';
import type { EstadoImportacao } from '@/lib/importacao/estado';
import { avisoColunasDesconhecidas, lerEntrada, serializarDados } from '@/lib/importacao/servidor';
import { lerAnoLetivo } from '@/lib/ofertas/regras';

/** Importa o calendário de um ano (etapas, semestres, eventos e sábados letivos). O ano vem ligado pela página. */
export async function importarCalendario(anoBruto: string, _estado: EstadoImportacao | undefined, formData: FormData): Promise<EstadoImportacao> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const ano = lerAnoLetivo(anoBruto);
  if (!ano) return { mensagem: 'Ano inválido. Recarregue a página.' };
  const entrada = await lerEntrada(formData, COLUNAS_CALENDARIO);
  if ('erro' in entrada) return { mensagem: entrada.erro };
  const existente = await carregarAno(ano);
  const plano = planejarImportacaoCalendario({ ano, registros: entrada.registros, existente });
  const avisos = avisoColunasDesconhecidas(entrada.desconhecidas);

  if (!entrada.confirmar || plano.temErros) {
    if (plano.temErros) return { linhas: plano.linhas, avisos, mensagem: 'Há linhas com erro. Nada foi gravado: corrija a planilha e envie de novo.' };
    return {
      linhas: plano.linhas,
      avisos,
      dados: plano.mudancas ? serializarDados(entrada) : undefined,
      mensagem: plano.mudancas
        ? `Prévia do calendário de ${ano}: ${plano.mudancas} item(ns) a gravar. Confira e confirme abaixo.`
        : `A planilha é igual ao calendário de ${ano}: não há nada para gravar.`,
    };
  }
  if (!plano.mudancas) return { concluido: true, sucesso: true, mensagem: 'Nada para gravar: o calendário já está igual à planilha.' };

  const intervalo = (i: { inicio: string; fim: string }) => ({ inicio: dataParaBanco(i.inicio), fim: dataParaBanco(i.fim) });
  const evento = (e: (typeof plano.eventosCriar)[number]) => ({ ...e, ...intervalo(e) });
  try {
    await prisma.$transaction([
      ...plano.etapas.flatMap((e, i) =>
        e
          ? [
              prisma.etapaLetiva.upsert({
                where: { anoLetivo_numero: { anoLetivo: ano, numero: i + 1 } },
                create: { anoLetivo: ano, numero: i + 1, ...intervalo(e) },
                update: intervalo(e),
              }),
            ]
          : [],
      ),
      ...plano.semestres.flatMap((s, i) =>
        s
          ? [
              prisma.periodoLetivo.upsert({
                where: { anoLetivo_semestreLetivo: { anoLetivo: ano, semestreLetivo: i + 1 } },
                create: { anoLetivo: ano, semestreLetivo: i + 1, ...intervalo(s) },
                update: intervalo(s),
              }),
            ]
          : [],
      ),
      ...plano.eventosCriar.map((e) => prisma.eventoCalendario.create({ data: evento(e) })),
      ...plano.eventosAtualizar.map(({ id, ...e }) => prisma.eventoCalendario.update({ where: { id }, data: evento(e) })),
      ...plano.sabadosCriar.map((s) => prisma.sabadoLetivo.create({ data: { ...s, data: dataParaBanco(s.data) } })),
      ...plano.sabadosAtualizar.map(({ id, ...s }) => prisma.sabadoLetivo.update({ where: { id }, data: s })),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || e.code === 'P2025')) {
      return { mensagem: 'O calendário mudou durante a importação. Nada foi gravado: envie a planilha de novo.' };
    }
    throw e;
  }
  const detalhes = {
    ano,
    etapas: plano.etapas.filter(Boolean).length,
    semestres: plano.semestres.filter(Boolean).length,
    eventosCriados: plano.eventosCriar.length,
    eventosAlterados: plano.eventosAtualizar.length,
    sabadosCriados: plano.sabadosCriar.length,
    sabadosAlterados: plano.sabadosAtualizar.length,
  };
  await registrarAuditoria({ userId: usuario.id, acao: 'IMPORTOU_CALENDARIO', entidade: 'EventoCalendario', entidadeId: String(ano), detalhes });
  for (const caminho of ['/calendario', '/grade', '/grade/sabados', '/diarios', '/alimentacao', '/ausencias']) revalidatePath(caminho);
  return {
    concluido: true,
    sucesso: true,
    mensagem:
      `Calendário de ${ano} importado: ${detalhes.etapas + detalhes.semestres} período(s), ` +
      `${detalhes.eventosCriados} evento(s) novo(s) e ${detalhes.eventosAlterados} alterado(s), ` +
      `${detalhes.sabadosCriados} sábado(s) letivo(s) novo(s) e ${detalhes.sabadosAlterados} alterado(s).`,
  };
}
