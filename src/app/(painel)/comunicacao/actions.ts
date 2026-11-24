'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { carregarAusencia, intervaloDoDia } from '@/lib/ausencias/servidor';
import { configuracaoEvolution, destinoValido, enviarPorEvolution } from '@/lib/comunicacao/evolution';
import { emailsValidos, lerModoEnvio, NOME_MODO, type MensagemPronta, type ModoEnvioManual } from '@/lib/comunicacao/mensagem';
import { mensagemAvulsa } from '@/lib/comunicacao/servidor';

export type EstadoEnvio = { mensagem?: string; sucesso?: boolean };

type Modo = ModoEnvioManual | 'WEBHOOK_AUTO';

/** Texto da mensagem regenerado no servidor (nunca vem do formulário). */
async function mensagemDaAusencia(formData: FormData) {
  const ausenciaId = String(formData.get('ausenciaId') ?? '');
  const chave = String(formData.get('chave') ?? '');
  const dados = await carregarAusencia(ausenciaId);
  if (!dados) return { erro: 'Ausência não encontrada. Ela pode ter sido cancelada.' } as const;
  const mensagem = dados.mensagens.find((m) => m.chave === chave);
  if (!mensagem) return { erro: 'Esta mensagem não se aplica mais à ausência. Recarregue a página.' } as const;
  return { ausenciaId, dados, mensagem } as const;
}

async function gravarEnvio(params: {
  userId: string;
  ausenciaId: string | null;
  mensagem: MensagemPronta;
  modo: Modo;
  sucesso: boolean;
  turmaId?: string;
  dataISO?: string;
}) {
  const agora = new Date();
  const { mensagem: m } = params;
  const log = await prisma.$transaction(async (tx) => {
    const criado = await tx.logComunicacao.create({
      data: {
        canal: m.canal,
        destino: m.destino,
        chave: m.chave,
        ausenciaId: params.ausenciaId,
        assunto: m.assunto,
        mensagem: m.texto,
        modoEnvio: params.modo,
        sucesso: params.sucesso,
        userId: params.userId,
      },
    });
    if (params.sucesso && m.canal === 'ASSISTENCIA_ESTUDANTIL' && params.turmaId && params.dataISO) {
      await tx.alertaAlimentacao.updateMany({
        where: { turmaId: params.turmaId, dataRefeicao: intervaloDoDia(params.dataISO), canceladoEm: null, enviadoEm: null, manual: false },
        data: { enviadoEm: agora },
      });
    }
    return criado;
  });
  await registrarAuditoria({
    userId: params.userId,
    acao: params.modo === 'WEBHOOK_AUTO' ? 'ENVIOU_WHATSAPP_AUTOMATICO' : 'REGISTROU_ENVIO_MENSAGEM',
    entidade: 'LogComunicacao',
    entidadeId: log.id,
    detalhes: { canal: m.canal, destino: m.destino, modo: params.modo, ausenciaId: params.ausenciaId, sucesso: params.sucesso },
  });
  if (params.ausenciaId) revalidatePath(`/ausencias/${params.ausenciaId}`);
  revalidatePath('/comunicacao');
  revalidatePath('/alimentacao');
}

/**
 * Modo semiautomático (G07): a pessoa envia por e-mail, WhatsApp ou outro meio e confirma aqui.
 * O histórico guarda o texto gerado pelo sistema (edições feitas na caixa não são gravadas).
 */
export async function registrarEnvio(_estado: EstadoEnvio | undefined, formData: FormData): Promise<EstadoEnvio> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const modo = lerModoEnvio(formData.get('modo'));
  if (!modo) return { mensagem: 'Escolha por onde a mensagem foi enviada.' };
  const m = await mensagemDaAusencia(formData);
  if ('erro' in m) return { mensagem: m.erro };
  await gravarEnvio({
    userId: usuario.id,
    ausenciaId: m.ausenciaId,
    mensagem: m.mensagem,
    modo,
    sucesso: true,
    turmaId: m.dados.registro.turmaId,
    dataISO: m.dados.dataISO,
  });
  return { sucesso: true, mensagem: `Envio por ${NOME_MODO[modo].toLowerCase()} registrado no histórico.` };
}

/** Envio automático pela Evolution API, quando configurada e com destino cadastrado no canal. */
export async function enviarAutomatico(_estado: EstadoEnvio | undefined, formData: FormData): Promise<EstadoEnvio> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const config = configuracaoEvolution();
  if (!config) return { mensagem: 'Envio automático não configurado. Use o e-mail ou o WhatsApp Web.' };
  const m = await mensagemDaAusencia(formData);
  if ('erro' in m) return { mensagem: m.erro };
  const canal = m.mensagem.canal ? await prisma.configuracaoCanal.findUnique({ where: { canal: m.mensagem.canal } }) : null;
  if (!canal?.ativo || !canal.destinoId || !destinoValido(canal.destinoId)) {
    return { mensagem: 'Este canal não tem destino válido cadastrado em Comunicação. Use o e-mail ou o WhatsApp Web.' };
  }
  const sucesso = await enviarPorEvolution(config, canal.destinoId, m.mensagem.texto);
  await gravarEnvio({
    userId: usuario.id,
    ausenciaId: m.ausenciaId,
    mensagem: m.mensagem,
    modo: 'WEBHOOK_AUTO',
    sucesso,
    turmaId: m.dados.registro.turmaId,
    dataISO: m.dados.dataISO,
  });
  return sucesso
    ? { sucesso: true, mensagem: 'Mensagem enviada automaticamente.' }
    : { mensagem: 'A API do WhatsApp não confirmou o envio (registrado no histórico como falha). Use o e-mail ou o WhatsApp Web.' };
}

export type EstadoAvulsa = {
  mensagem?: string;
  sucesso?: boolean;
  erros?: Partial<Record<'destino' | 'assunto' | 'texto' | 'modo', string>>;
  valores?: { destino: string; assunto: string; texto: string };
  pronta?: MensagemPronta;
};

/**
 * Mensagem avulsa: escolhe um grupo/setor ou um usuário, escreve assunto e texto e recebe a caixa pronta
 * (e-mail do destinatário, saudação e links). "registrar" grava o envio no histórico.
 */
export async function prepararAvulsa(_estado: EstadoAvulsa | undefined, formData: FormData): Promise<EstadoAvulsa> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const destino = String(formData.get('destino') ?? '');
  const assunto = String(formData.get('assunto') ?? '').trim();
  const texto = String(formData.get('texto') ?? '').trim();
  const valores = { destino, assunto, texto };
  const erros: EstadoAvulsa['erros'] = {};
  if (assunto.length < 3 || assunto.length > 150) erros.assunto = 'Use de 3 a 150 caracteres.';
  if (texto.length < 3 || texto.length > 4000) erros.texto = 'Use de 3 a 4.000 caracteres.';
  const pronta = await mensagemAvulsa(destino, assunto, texto);
  if (!pronta) erros.destino = 'Escolha o destinatário.';
  if (Object.keys(erros).length > 0 || !pronta) return { erros, valores };

  if (formData.get('registrar') === '1') {
    const modo = lerModoEnvio(formData.get('modo'));
    if (!modo) return { erros: { modo: 'Escolha por onde a mensagem foi enviada.' }, valores, pronta };
    await gravarEnvio({ userId: usuario.id, ausenciaId: null, mensagem: pronta, modo, sucesso: true });
    return { sucesso: true, mensagem: 'Envio registrado no histórico.', valores, pronta };
  }
  return { valores, pronta };
}

export type EstadoCanal = { mensagem?: string; sucesso?: boolean; erros?: Partial<Record<'nomeExibicao' | 'destinoId' | 'email' | 'saudacao', string>> };

/** Nome, e-mail, saudação e destino (JID) de cada canal; o destino só é usado no envio automático. */
export async function salvarCanal(_estado: EstadoCanal | undefined, formData: FormData): Promise<EstadoCanal> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const id = String(formData.get('canalId') ?? '');
  const nomeExibicao = String(formData.get('nomeExibicao') ?? '').trim();
  const destinoId = String(formData.get('destinoId') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const saudacao = String(formData.get('saudacao') ?? '').trim();
  const ativo = formData.get('ativo') === 'on';
  const erros: EstadoCanal['erros'] = {};
  if (nomeExibicao.length < 3 || nomeExibicao.length > 80) erros.nomeExibicao = 'Use de 3 a 80 caracteres.';
  if (email && (email.length > 300 || !emailsValidos(email))) erros.email = 'Use e-mails válidos, separados por vírgula.';
  if (saudacao.length > 80) erros.saudacao = 'Use até 80 caracteres.';
  if (/[{}]/.test(saudacao)) erros.saudacao = 'Não use chaves { }.';
  if (destinoId && !destinoValido(destinoId)) erros.destinoId = 'Use o JID do grupo (ex.: 120363…@g.us) ou o número com DDI, só dígitos.';
  if (Object.keys(erros).length > 0) return { erros };
  const atual = await prisma.configuracaoCanal.findUnique({ where: { id } });
  if (!atual) return { mensagem: 'Canal não encontrado.' };
  await prisma.configuracaoCanal.update({ where: { id }, data: { nomeExibicao, destinoId: destinoId || null, email: email || null, saudacao: saudacao || null, ativo } });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'EDITOU_CANAL_WHATSAPP',
    entidade: 'ConfiguracaoCanal',
    entidadeId: id,
    detalhes: { canal: atual.canal, destinoAlterado: (atual.destinoId ?? '') !== destinoId, emailAlterado: (atual.email ?? '') !== email, ativo },
  });
  revalidatePath('/comunicacao');
  return { sucesso: true, mensagem: 'Canal salvo.' };
}
