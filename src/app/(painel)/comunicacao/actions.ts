'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { carregarAusencia, intervaloDoDia } from '@/lib/ausencias/servidor';
import { configuracaoEvolution, destinoValido, enviarPorEvolution } from '@/lib/comunicacao/evolution';
import { emailsValidos, lerModoEnvio, preencherCampos, NOME_MODO, type MensagemPronta, type ModoEnvioManual } from '@/lib/comunicacao/mensagem';
import { mensagemAvulsa } from '@/lib/comunicacao/servidor';
import { anunciaEventoFuturo, camposComDataPassada, valoresDosCampos } from '@/lib/comunicacao/modelos';
import { hojeEmFortaleza } from '@/lib/ausencias/regras';

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

export interface ValoresAvulsa {
  destinos: string[];
  assunto: string;
  texto: string;
  modelo: string;
  /** Campos {{...}} preenchidos na tela (valor bruto: datas em aaaa-mm-dd, horas em hh:mm). */
  campos: Record<string, string>;
}

export type EstadoAvulsa = {
  mensagem?: string;
  sucesso?: boolean;
  erros?: Partial<Record<'destino' | 'assunto' | 'texto' | 'modo' | 'campos', string>>;
  valores?: ValoresAvulsa;
  prontas?: MensagemPronta[];
  /** Destinos sem ninguém (ex.: turma sem ofertas no ano). */
  vazios?: string[];
};

const MAX_DESTINOS = 30;

/**
 * Mensagem avulsa: um ou vários destinatários (grupos/setores, grupos de docentes ou pessoas), assunto e texto,
 * com os campos {{...}} preenchidos na tela. Gera uma caixa pronta por destinatário; "registrar" grava no
 * histórico o envio de uma delas (identificada pela chave).
 */
export async function prepararAvulsa(_estado: EstadoAvulsa | undefined, formData: FormData): Promise<EstadoAvulsa> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const idModelo = String(formData.get('modelo') ?? '');
  const modelo = idModelo ? await prisma.modeloMensagem.findFirst({ where: { id: idModelo, ativo: true } }) : null;
  // Sem JavaScript, o texto-padrão entra quando o texto (ou o assunto) vem vazio, e sugere os destinatários.
  let destinos = [...new Set(formData.getAll('destino').map(String).filter(Boolean))];
  if (destinos.length === 0 && modelo && !String(formData.get('texto') ?? '').trim()) destinos = modelo.destinos.map((c) => `canal:${c}`);
  const assunto = String(formData.get('assunto') ?? '').trim() || (modelo?.assunto ?? '');
  const texto = String(formData.get('texto') ?? '').trim() || (modelo?.texto ?? '');
  const campos: Record<string, string> = {};
  for (const [nome, valor] of formData.entries()) {
    if (nome.startsWith('campo:') && typeof valor === 'string' && nome.length <= 66) campos[nome.slice(6)] = valor.slice(0, 500);
  }
  const valores: ValoresAvulsa = { destinos, assunto, texto, modelo: modelo?.id ?? '', campos };
  const erros: EstadoAvulsa['erros'] = {};
  if (assunto.length < 3 || assunto.length > 150) erros.assunto = 'Use de 3 a 150 caracteres.';
  if (texto.length < 3 || texto.length > 4000) erros.texto = 'Use de 3 a 4.000 caracteres.';
  if (destinos.length === 0) erros.destino = 'Escolha ao menos um destinatário.';
  if (destinos.length > MAX_DESTINOS) erros.destino = `Escolha até ${MAX_DESTINOS} destinatários (use um grupo de docentes).`;
  if (anunciaEventoFuturo(assunto, texto)) {
    const passadas = camposComDataPassada(campos, hojeEmFortaleza());
    if (passadas.length > 0) erros.campos = `A data já passou (${passadas.join(', ')}): informe uma data de hoje em diante.`;
  }
  if (Object.keys(erros).length > 0) return { erros, valores };

  const preenchidos = valoresDosCampos(campos);
  const assuntoFinal = preencherCampos(assunto, preenchidos);
  const textoFinal = preencherCampos(texto, preenchidos);
  const prontas: MensagemPronta[] = [];
  const vazios: string[] = [];
  for (const d of destinos) {
    const m = await mensagemAvulsa(d, assuntoFinal, textoFinal);
    if (m) prontas.push(m);
    else vazios.push(d);
  }
  if (prontas.length === 0) return { erros: { destino: 'Nenhum dos destinatários escolhidos tem pessoas ou cadastro ativo.' }, valores };

  const chave = String(formData.get('registrar') ?? '');
  if (chave) {
    const pronta = prontas.find((p) => p.chave === chave);
    if (!pronta) return { mensagem: 'Esta mensagem não está mais entre as geradas. Gere de novo.', valores, prontas, vazios };
    const modo = lerModoEnvio(formData.get('modo'));
    if (!modo) return { erros: { modo: 'Escolha por onde a mensagem foi enviada.' }, valores, prontas, vazios };
    await gravarEnvio({ userId: usuario.id, ausenciaId: null, mensagem: pronta, modo, sucesso: true });
    return { sucesso: true, mensagem: `Envio para ${pronta.titulo} registrado no histórico.`, valores, prontas, vazios };
  }
  return { valores, prontas, vazios };
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
