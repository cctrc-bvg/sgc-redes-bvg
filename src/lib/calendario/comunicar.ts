import 'server-only';
import { prisma } from '@/lib/db';
import { dataDoBanco } from '@/lib/ausencias/regras';
import type { MensagemPronta } from '@/lib/comunicacao/mensagem';
import { mensagemAvulsa } from '@/lib/comunicacao/servidor';
import { anoLetivoAtual } from '@/lib/ofertas/regras';
import { assuntoDoEvento, DESTINOS_CALENDARIO, periodoDoEvento, textoDoEvento, type EventoComunicavel } from './mensagens';

/** Evento do calendário e as mensagens prontas para cada destino ativo; null se o evento não existe. */
export async function mensagensDoEvento(id: string) {
  const bd = await prisma.eventoCalendario.findUnique({ where: { id } });
  if (!bd) return null;
  const evento: EventoComunicavel & { id: string } = { ...bd, inicio: dataDoBanco(bd.inicio), fim: dataDoBanco(bd.fim) };
  const ano = Number(evento.inicio.slice(0, 4)) || anoLetivoAtual();
  const assunto = assuntoDoEvento(evento);
  const mensagens: MensagemPronta[] = [];
  for (const { destino, publico } of DESTINOS_CALENDARIO) {
    const corpo = textoDoEvento(evento, publico);
    const m = await mensagemAvulsa(destino, assunto, corpo, ano);
    if (!m) continue;
    mensagens.push({
      ...m,
      chave: `calendario:${destino}`,
      tipo: 'comunicado',
      variaveis: { ...m.variaveis, 'assunto do comunicado': assunto.replace('[SGC-Redes] ', ''), 'texto do comunicado': corpo, data: periodoDoEvento(evento) },
    });
  }
  return { evento, mensagens };
}
