'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { hojeEmFortaleza } from '@/lib/ausencias/regras';
import { validarDataISO } from '@/lib/alimentacao-engine';
import { diaDaSemanaISO } from '@/lib/calendario/regras';
import { lerModoEnvio, NOME_MODO } from '@/lib/comunicacao/mensagem';
import { chaveResumoSemanal } from '@/lib/comunicacao/periodicas';
import { resumosDaSemana } from '@/lib/comunicacao/periodicas-servidor';

export type EstadoResumo = { mensagem?: string; sucesso?: boolean };

/** Registra que o resumo semanal do docente foi enviado (modo semiautomático). Uma vez por docente e semana. */
export async function registrarResumoSemanal(_estado: EstadoResumo | undefined, formData: FormData): Promise<EstadoResumo> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const segunda = String(formData.get('segunda') ?? '');
  const docenteId = String(formData.get('docenteId') ?? '');
  const modo = lerModoEnvio(formData.get('modo'));
  if (!modo) return { mensagem: 'Escolha por onde o resumo foi enviado.' };
  try {
    validarDataISO(segunda);
  } catch {
    return { mensagem: 'Semana inválida. Recarregue a página.' };
  }
  if (diaDaSemanaISO(segunda) !== 1) return { mensagem: 'Semana inválida. Recarregue a página.' };
  const chave = chaveResumoSemanal(segunda, docenteId);
  // O texto é regenerado no servidor, nunca vem do formulário.
  const resumo = (await resumosDaSemana(segunda, hojeEmFortaleza())).find((r) => r.mensagem.chave === chave);
  if (!resumo) return { mensagem: 'Este docente não tem resumo nesta semana. Recarregue a página.' };
  if (resumo.enviado) return { sucesso: true, mensagem: 'O envio desta semana já estava registrado.' };
  const m = resumo.mensagem;
  const log = await prisma.logComunicacao.create({
    data: { canal: null, destino: m.destino, chave, assunto: m.assunto, mensagem: m.texto, modoEnvio: modo, sucesso: true, userId: usuario.id },
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'REGISTROU_ENVIO_MENSAGEM', entidade: 'LogComunicacao', entidadeId: log.id, detalhes: { origem: 'resumo_semanal', segunda, modo } });
  revalidatePath('/comunicacao/periodicas');
  revalidatePath('/comunicacao');
  return { sucesso: true, mensagem: `Envio registrado (${NOME_MODO[modo].toLowerCase()}).` };
}
