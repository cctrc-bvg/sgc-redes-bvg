/**
 * Mensagens prontas no modo semiautomático: o sistema gera o texto e quem é responsável encaminha por
 * e-mail institucional ou WhatsApp. Nada aqui depende do WhatsApp: sem número cadastrado (ou com a pessoa
 * tendo desligado o WhatsApp), a mensagem continua disponível para copiar ou abrir no e-mail.
 */
import type { CanalWhatsapp } from '@prisma/client';
import type { TipoInteracao } from './modelos';

export interface MensagemPronta {
  /** Identifica a mensagem dentro da origem (ex.: "canal:CTP", "substituto:<userId>"). */
  chave: string;
  /** Título da caixa na tela (pode ter nome do destinatário). */
  titulo: string;
  /** Grupo ou setor; null em mensagem individual. */
  canal: CanalWhatsapp | null;
  /** Descrição do destinatário para o histórico, sem nome (LGPD). */
  destino: string;
  /** E-mail do destinatário, quando cadastrado. */
  para: string | null;
  /** Número para wa.me (só dígitos, com DDI); null abre o WhatsApp para escolher contato ou grupo. */
  whatsapp: string | null;
  /** Falso quando o destinatário não quer WhatsApp: a tela não oferece o botão. */
  aceitaWhatsapp: boolean;
  assunto: string;
  texto: string;
  /** Tipo de interação: define os textos-padrão oferecidos na caixa. */
  tipo?: TipoInteracao;
  /** Valores das variáveis `{{...}}` dos textos-padrão (as que faltarem viram campos a preencher). */
  variaveis?: Readonly<Record<string, string>>;
}

/** Campos a preencher: `{{nome do destinatário}}`. */
const PADRAO_CAMPO = /\{\{([^{}\n]{1,60})\}\}/g;

export const campo = (nome: string) => `{{${nome}}}`;

/** Nomes dos campos ainda não preenchidos, na ordem em que aparecem (sem repetir). */
export function camposPendentes(...textos: string[]): string[] {
  const vistos = new Set<string>();
  for (const t of textos) for (const m of t.matchAll(PADRAO_CAMPO)) vistos.add(m[1].trim());
  return [...vistos];
}

/** Troca cada campo preenchido pelo valor; campos sem valor continuam marcados. */
export function preencherCampos(texto: string, valores: Readonly<Record<string, string>>): string {
  return texto.replace(PADRAO_CAMPO, (inteiro, nome: string) => {
    const v = (valores[nome.trim()] ?? '').trim();
    return v ? v : inteiro;
  });
}

/** Saudação com o nome cadastrado ou um campo para preencher. */
export const saudacao = (nome: string | null | undefined, campoSeVazio: string) => `Olá, ${nome?.trim() ? nome.trim() : campo(campoSeVazio)}!`;

/** Primeiro nome, para mensagens individuais. */
export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

/** Tira a formatação do WhatsApp (*negrito*, _itálico_) para o e-mail. */
export function textoParaEmail(texto: string): string {
  return texto.replace(/\*([^*\n]+)\*/g, '$1').replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1$2');
}

/** E-mail aceito no "Para": formato simples, sem espaços nem vírgulas (vários endereços separados por vírgula). */
export function emailsValidos(bruto: string): boolean {
  const partes = bruto.split(',').map((p) => p.trim()).filter(Boolean);
  return partes.length > 0 && partes.every((p) => /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(p));
}

/** Link `mailto:` com assunto e corpo (RFC 6068: quebras de linha como CRLF). */
export function linkEmail(p: { para: string | null; assunto: string; texto: string }): string {
  const para = p.para && emailsValidos(p.para) ? p.para.split(',').map((e) => e.trim()).join(',') : '';
  const corpo = textoParaEmail(p.texto).replace(/\r?\n/g, '\r\n');
  return `mailto:${para}?subject=${encodeURIComponent(p.assunto)}&body=${encodeURIComponent(corpo)}`;
}

/** Link do WhatsApp com o texto pronto; sem número, a pessoa escolhe o contato ou grupo ao abrir. */
export const linkWhatsapp = (texto: string, numero?: string | null) =>
  `https://wa.me/${numero ?? ''}?text=${encodeURIComponent(texto)}`;

/** Número para wa.me: só dígitos, com DDI 55 quando faltar. null se não parecer um celular/telefone do Brasil. */
export function numeroWhatsapp(bruto: string | null | undefined): string | null {
  const d = (bruto ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

/** Contato de um usuário para mensagem individual, respeitando quem não quer WhatsApp. */
export function contatoDoUsuario(u: { email: string; whatsapp: string | null; usaWhatsapp: boolean }) {
  return {
    para: u.email,
    whatsapp: u.usaWhatsapp ? numeroWhatsapp(u.whatsapp) : null,
    aceitaWhatsapp: u.usaWhatsapp,
  };
}

export const MODOS_ENVIO = ['EMAIL_MANUAL', 'WHATSAPP_WEB_MANUAL', 'OUTRO_MANUAL'] as const;
export type ModoEnvioManual = (typeof MODOS_ENVIO)[number];

export const NOME_MODO: Record<string, string> = {
  EMAIL_MANUAL: 'E-mail',
  WHATSAPP_WEB_MANUAL: 'WhatsApp',
  OUTRO_MANUAL: 'Outro meio (copiado e colado)',
  WEBHOOK_AUTO: 'Automático (API)',
};

export const lerModoEnvio = (v: unknown): ModoEnvioManual | null =>
  (MODOS_ENVIO as readonly string[]).includes(String(v)) ? (String(v) as ModoEnvioManual) : null;

/** Endereço do sistema para pôr nas mensagens (APP_URL), sem barra no fim. */
export function enderecoDoSistema(caminho: string, appUrl = process.env.APP_URL): string | null {
  const base = (appUrl ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\/\S+$/.test(base) ? `${base}${caminho}` : null;
}

/**
 * Mensagem individual para quem não tem cadastro no sistema (ex.: estudante): o e-mail fica para
 * digitar na caixa e o WhatsApp abre para escolher o contato. O histórico guarda só `destino`.
 */
export function mensagemSemCadastro(p: {
  chave: string;
  titulo: string;
  destino: string;
  nome: string;
  assunto: string;
  texto: string;
  tipo?: TipoInteracao;
  variaveis?: Readonly<Record<string, string>>;
}): MensagemPronta {
  const nome = primeiroNome(p.nome);
  return {
    chave: p.chave,
    titulo: p.titulo,
    canal: null,
    destino: p.destino,
    para: null,
    whatsapp: null,
    aceitaWhatsapp: true,
    assunto: p.assunto,
    texto: `${saudacao(nome, 'nome')}\n\n${p.texto}`,
    tipo: p.tipo,
    variaveis: { ...p.variaveis, nome },
  };
}
