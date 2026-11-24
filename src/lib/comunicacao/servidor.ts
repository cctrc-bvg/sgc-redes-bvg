import 'server-only';
import type { CanalWhatsapp } from '@prisma/client';
import { prisma } from '@/lib/db';
import { CAMPO_SAUDACAO, NOME_CANAL } from '@/lib/ausencias/mensagens';
import { contatoDoUsuario, primeiroNome, saudacao, type MensagemPronta } from './mensagem';

/** Destinatários da mensagem avulsa: grupos/setores ativos e usuários ativos. Valor "canal:X" ou "usuario:<id>". */
export async function opcoesDeDestino() {
  const [canais, usuarios] = await Promise.all([
    prisma.configuracaoCanal.findMany({ where: { ativo: true }, orderBy: { canal: 'asc' }, select: { canal: true } }),
    prisma.user.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
  ]);
  return {
    canais: canais.map((c) => ({ valor: `canal:${c.canal}`, rotulo: NOME_CANAL[c.canal] })),
    usuarios: usuarios.map((u) => ({ valor: `usuario:${u.id}`, rotulo: u.nome })),
  };
}

/** Monta a mensagem avulsa com saudação e contato do destinatário; null se o destino não existir. */
export async function mensagemAvulsa(destino: string, assunto: string, texto: string): Promise<MensagemPronta | null> {
  const [tipo, id] = destino.split(':', 2);
  if (tipo === 'canal' && id && id in NOME_CANAL) {
    const canal = id as CanalWhatsapp;
    const cfg = await prisma.configuracaoCanal.findUnique({ where: { canal } });
    if (!cfg?.ativo) return null;
    return {
      chave: `avulsa:canal:${canal}`,
      titulo: NOME_CANAL[canal],
      canal,
      destino: NOME_CANAL[canal],
      para: cfg.email,
      whatsapp: null,
      aceitaWhatsapp: true,
      assunto,
      texto: `${saudacao(cfg.saudacao, CAMPO_SAUDACAO[canal])}\n\n${texto}`,
    };
  }
  if (tipo === 'usuario' && id) {
    const u = await prisma.user.findFirst({ where: { id, ativo: true }, select: { nome: true, email: true, whatsapp: true, usaWhatsapp: true } });
    if (!u) return null;
    return {
      chave: `avulsa:usuario:${id}`,
      titulo: u.nome,
      canal: null,
      destino: 'Usuário do sistema',
      ...contatoDoUsuario(u),
      assunto,
      texto: `${saudacao(primeiroNome(u.nome), 'nome do destinatário')}\n\n${texto}`,
    };
  }
  return null;
}
