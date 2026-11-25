import 'server-only';
import { prisma } from '@/lib/db';
import { mensagemSemCadastro, type MensagemPronta } from '@/lib/comunicacao/mensagem';
import { mensagemAvulsa } from '@/lib/comunicacao/servidor';
import { assuntoPpi, ppiDecidida, PUBLICOS_PPI, textoPpi } from './mensagens';

/** Solicitação de PPI e as mensagens da decisão (vazias enquanto não decidida); null se não existe. */
export async function mensagensDaPpi(id: string) {
  const s = await prisma.ppiSolicitacao.findUnique({ where: { id } });
  if (!s) return null;
  const mensagens: MensagemPronta[] = [];
  if (ppiDecidida(s)) {
    const assunto = assuntoPpi(s);
    for (const publico of PUBLICOS_PPI) {
      const corpo = textoPpi(s, publico);
      if (publico === 'estudante') {
        mensagens.push(mensagemSemCadastro({ chave: 'estudante', titulo: `Estudante: ${s.nomeEstudante}`, destino: 'Estudante (PPI)', nome: s.nomeEstudante, assunto, texto: corpo, tipo: 'ppi' }));
      } else {
        const m = await mensagemAvulsa('canal:CTP', assunto, corpo);
        if (m) mensagens.push({ ...m, chave: 'canal:CTP', tipo: 'ppi' });
      }
    }
  }
  return { solicitacao: s, mensagens };
}

/** Chave do envio no histórico (muda com a decisão). */
export const chaveEnvioPpi = (status: string, chave: string, id: string) => `ppi:${status}:${chave}:${id}`;
