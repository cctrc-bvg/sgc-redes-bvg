'use server';

import type { CanalWhatsapp } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { carregarAusencia, intervaloDoDia } from '@/lib/ausencias/servidor';
import { configuracaoEvolution, destinoValido, enviarPorEvolution } from '@/lib/comunicacao/evolution';

export type EstadoEnvio = { mensagem?: string; sucesso?: boolean };

type Modo = 'WHATSAPP_WEB_MANUAL' | 'WEBHOOK_AUTO';

/** Texto da mensagem regenerado no servidor (nunca vem do formulário). */
async function mensagemDaAusencia(formData: FormData) {
  const ausenciaId = String(formData.get('ausenciaId') ?? '');
  const canal = String(formData.get('canal') ?? '') as CanalWhatsapp;
  const dados = await carregarAusencia(ausenciaId);
  if (!dados) return { erro: 'Ausência não encontrada. Ela pode ter sido cancelada.' } as const;
  const mensagem = dados.mensagens.find((m) => m.canal === canal);
  if (!mensagem) return { erro: 'Esta mensagem não se aplica mais à ausência. Recarregue a página.' } as const;
  return { ausenciaId, canal, dados, texto: mensagem.texto } as const;
}

async function gravarEnvio(params: {
  userId: string;
  ausenciaId: string;
  canal: CanalWhatsapp;
  texto: string;
  modo: Modo;
  sucesso: boolean;
  turmaId: string;
  dataISO: string;
}) {
  const agora = new Date();
  const log = await prisma.$transaction(async (tx) => {
    const criado = await tx.logComunicacao.create({ data: { canal: params.canal, mensagem: params.texto, modoEnvio: params.modo, sucesso: params.sucesso } });
    if (params.sucesso && params.canal === 'ASSISTENCIA_ESTUDANTIL') {
      await tx.alertaAlimentacao.updateMany({
        where: { turmaId: params.turmaId, dataRefeicao: intervaloDoDia(params.dataISO), canceladoEm: null, enviadoEm: null, manual: false },
        data: { enviadoEm: agora },
      });
    }
    return criado;
  });
  await registrarAuditoria({
    userId: params.userId,
    acao: params.modo === 'WEBHOOK_AUTO' ? 'ENVIOU_WHATSAPP_AUTOMATICO' : 'REGISTROU_ENVIO_WHATSAPP',
    entidade: 'LogComunicacao',
    entidadeId: log.id,
    detalhes: { canal: params.canal, ausenciaId: params.ausenciaId, sucesso: params.sucesso },
  });
  revalidatePath(`/ausencias/${params.ausenciaId}`);
  revalidatePath('/comunicacao');
  revalidatePath('/alimentacao');
}

/**
 * Modo semiautomático (G07): a pessoa abre o WhatsApp com o texto pronto e confirma aqui que enviou.
 */
export async function registrarEnvio(_estado: EstadoEnvio | undefined, formData: FormData): Promise<EstadoEnvio> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const m = await mensagemDaAusencia(formData);
  if ('erro' in m) return { mensagem: m.erro };
  await gravarEnvio({
    userId: usuario.id,
    ausenciaId: m.ausenciaId,
    canal: m.canal,
    texto: m.texto,
    modo: 'WHATSAPP_WEB_MANUAL',
    sucesso: true,
    turmaId: m.dados.registro.turmaId,
    dataISO: m.dados.dataISO,
  });
  return { sucesso: true, mensagem: 'Envio registrado no histórico.' };
}

/** Envio automático pela Evolution API, quando configurada e com destino cadastrado no canal. */
export async function enviarAutomatico(_estado: EstadoEnvio | undefined, formData: FormData): Promise<EstadoEnvio> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const config = configuracaoEvolution();
  if (!config) return { mensagem: 'Envio automático não configurado. Use o WhatsApp Web.' };
  const m = await mensagemDaAusencia(formData);
  if ('erro' in m) return { mensagem: m.erro };
  const canal = await prisma.configuracaoCanal.findUnique({ where: { canal: m.canal } });
  if (!canal?.ativo || !canal.destinoId || !destinoValido(canal.destinoId)) {
    return { mensagem: 'Este canal não tem destino válido cadastrado em Comunicação. Use o WhatsApp Web.' };
  }
  const sucesso = await enviarPorEvolution(config, canal.destinoId, m.texto);
  await gravarEnvio({
    userId: usuario.id,
    ausenciaId: m.ausenciaId,
    canal: m.canal,
    texto: m.texto,
    modo: 'WEBHOOK_AUTO',
    sucesso,
    turmaId: m.dados.registro.turmaId,
    dataISO: m.dados.dataISO,
  });
  return sucesso
    ? { sucesso: true, mensagem: 'Mensagem enviada automaticamente.' }
    : { mensagem: 'A API do WhatsApp não confirmou o envio (registrado no histórico como falha). Envie pelo WhatsApp Web.' };
}

export type EstadoCanal = { mensagem?: string; sucesso?: boolean; erros?: Partial<Record<'nomeExibicao' | 'destinoId', string>> };

/** Nome e destino (JID) de cada canal; o destino só é usado no envio automático. */
export async function salvarCanal(_estado: EstadoCanal | undefined, formData: FormData): Promise<EstadoCanal> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const id = String(formData.get('canalId') ?? '');
  const nomeExibicao = String(formData.get('nomeExibicao') ?? '').trim();
  const destinoId = String(formData.get('destinoId') ?? '').trim();
  const ativo = formData.get('ativo') === 'on';
  const erros: EstadoCanal['erros'] = {};
  if (nomeExibicao.length < 3 || nomeExibicao.length > 80) erros.nomeExibicao = 'Use de 3 a 80 caracteres.';
  if (destinoId && !destinoValido(destinoId)) erros.destinoId = 'Use o JID do grupo (ex.: 120363…@g.us) ou o número com DDI, só dígitos.';
  if (Object.keys(erros).length > 0) return { erros };
  const atual = await prisma.configuracaoCanal.findUnique({ where: { id } });
  if (!atual) return { mensagem: 'Canal não encontrado.' };
  await prisma.configuracaoCanal.update({ where: { id }, data: { nomeExibicao, destinoId: destinoId || null, ativo } });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'EDITOU_CANAL_WHATSAPP',
    entidade: 'ConfiguracaoCanal',
    entidadeId: id,
    detalhes: { canal: atual.canal, destinoAlterado: (atual.destinoId ?? '') !== destinoId, ativo },
  });
  revalidatePath('/comunicacao');
  return { sucesso: true, mensagem: 'Canal salvo.' };
}
