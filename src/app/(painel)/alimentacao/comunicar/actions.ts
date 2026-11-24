'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { validarDataISO } from '@/lib/alimentacao-engine';
import { mensagensDoDia } from '@/lib/alimentacao/comunicar';
import { lerGatilho } from '@/lib/alimentacao/mensagens';
import { intervaloDoDia } from '@/lib/ausencias/servidor';
import { lerModoEnvio, NOME_MODO } from '@/lib/comunicacao/mensagem';

export type EstadoEnvioDia = { mensagem?: string; sucesso?: boolean };

/** Registra o envio de uma das mensagens do dia (texto regenerado no servidor). */
export async function registrarEnvioDoDia(_e: EstadoEnvioDia | undefined, formData: FormData): Promise<EstadoEnvioDia> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const dataISO = String(formData.get('data') ?? '');
  try {
    validarDataISO(dataISO);
  } catch {
    return { mensagem: 'Data inválida. Recarregue a página.' };
  }
  const modo = lerModoEnvio(formData.get('modo'));
  if (!modo) return { mensagem: 'Escolha por onde a mensagem foi enviada.' };
  const { mensagens } = await mensagensDoDia(dataISO, lerGatilho(formData.get('gatilho')));
  const m = mensagens.find((x) => x.chave === String(formData.get('chave') ?? ''));
  if (!m) return { mensagem: 'Esta mensagem não se aplica mais (avisos mudaram). Recarregue a página.' };
  const log = await prisma.$transaction(async (tx) => {
    const criado = await tx.logComunicacao.create({
      data: { canal: m.canal, destino: m.destino, chave: `${m.chave}:${dataISO}`, assunto: m.assunto, mensagem: m.texto, modoEnvio: modo, sucesso: true, userId: usuario.id },
    });
    if (m.canal === 'ASSISTENCIA_ESTUDANTIL') {
      await tx.alertaAlimentacao.updateMany({ where: { dataRefeicao: intervaloDoDia(dataISO), canceladoEm: null, enviadoEm: null }, data: { enviadoEm: new Date() } });
    }
    return criado;
  });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'REGISTROU_ENVIO_MENSAGEM',
    entidade: 'LogComunicacao',
    entidadeId: log.id,
    detalhes: { canal: m.canal, modo, origem: 'alimentacao' },
  });
  revalidatePath('/alimentacao');
  revalidatePath('/alimentacao/comunicar');
  revalidatePath('/comunicacao');
  return { sucesso: true, mensagem: `Envio por ${NOME_MODO[modo].toLowerCase()} registrado no histórico.` };
}
