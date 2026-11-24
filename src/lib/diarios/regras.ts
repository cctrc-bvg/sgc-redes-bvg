/**
 * Semáforo de diários e carga horária (RF08, Art. 22, VI e VII). Espelha o que a Coordenação confere
 * no sistema acadêmico: aulas ministradas × previstas e se o diário está em dia.
 */
import { contatoDoUsuario, primeiroNome, type MensagemPronta } from '@/lib/comunicacao/mensagem';
import * as z from 'zod';

export type Semaforo = 'concluida' | 'atrasado' | 'atencao' | 'em-dia';

export const NOME_SEMAFORO: Record<Semaforo, { icone: string; texto: string; classe: string }> = {
  atrasado: { icone: '🔴', texto: 'Diário atrasado', classe: 'bg-if-vermelho-50 text-if-vermelho-700' },
  atencao: { icone: '🟡', texto: 'Carga abaixo do esperado', classe: 'bg-amber-100 text-amber-900' },
  'em-dia': { icone: '🟢', texto: 'Em dia', classe: 'bg-if-verde-50 text-if-verde-800' },
  concluida: { icone: '✔', texto: 'Carga cumprida', classe: 'bg-slate-200 text-slate-800' },
};

/** Ordem de atenção: o que precisa de ação primeiro. */
export const ORDEM_SEMAFORO: Record<Semaforo, number> = { atrasado: 0, atencao: 1, 'em-dia': 2, concluida: 3 };

/** Folga aceita antes de acender o amarelo: 10% das previstas (mínimo 2 aulas). */
export const folga = (previstas: number) => Math.max(2, Math.ceil(previstas * 0.1));

/**
 * Situação de uma oferta. `esperadas`: aulas que já deveriam ter sido dadas até hoje (null quando não há
 * referência de calendário — aí só valem o "diário em dia" e a carga cumprida).
 */
export function semaforo(o: { aulasPrevistas: number; aulasMinistradas: number; diarioEmDia: boolean }, esperadas: number | null): Semaforo {
  if (o.aulasPrevistas > 0 && o.aulasMinistradas >= o.aulasPrevistas) return 'concluida';
  if (!o.diarioEmDia) return 'atrasado';
  if (esperadas !== null && o.aulasMinistradas < esperadas - folga(o.aulasPrevistas)) return 'atencao';
  return 'em-dia';
}

/** Percentual ministrado (0–100), para a barra de progresso. */
export const percentual = (ministradas: number, previstas: number) => (previstas <= 0 ? 0 : Math.min(100, Math.round((ministradas / previstas) * 100)));

/**
 * Aulas esperadas até hoje: previstas × fração do período letivo já decorrida. O período vem da
 * configuração (início/fim); fora dele, 0 (antes) ou todas (depois).
 */
export function aulasEsperadas(previstas: number, inicioISO: string, fimISO: string, hojeISO: string): number {
  if (hojeISO <= inicioISO) return 0;
  if (hojeISO >= fimISO) return previstas;
  const dia = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
  const fracao = (dia(hojeISO) - dia(inicioISO)) / (dia(fimISO) - dia(inicioISO));
  return Math.floor(previstas * fracao);
}

export const DiarioSchema = z.object({
  aulasMinistradas: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, { error: 'Informe o número de aulas (ex.: 24).' })
    .transform(Number),
  diarioEmDia: z.string().optional().transform((v) => v === 'on'),
  observacaoDiario: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(300, { error: 'Use no máximo 300 caracteres.' }).optional(),
  ),
});

/** Ministradas não passam de 150% das previstas (erro de digitação provável). */
export function validarMinistradas(ministradas: number, previstas: number): string | null {
  const limite = Math.max(previstas, 1) * 1.5;
  return ministradas > limite ? `Valor alto demais para ${previstas} aulas previstas. Confira o número.` : null;
}

/** Lembrete ao docente (e-mail ou WhatsApp), sem expor dados de estudantes. */
export function mensagemLembrete(p: { professor: string; disciplina: string; turma: string; ministradas: number; previstas: number }): string {
  return [
    `Olá, ${p.professor}! Aqui é a Coordenação do Curso Técnico em Redes de Computadores.`,
    `Lembrete sobre o diário de *${p.disciplina}* (${p.turma}): constam ${p.ministradas} de ${p.previstas} aulas lançadas.`,
    'Quando puder, atualize o diário no sistema acadêmico. Obrigado!',
  ].join('\n');
}

export { numeroWhatsapp } from '@/lib/comunicacao/mensagem';

/** Lembrete de diário pronto para e-mail ou WhatsApp (o docente escolhe se aceita WhatsApp). */
export function lembreteDoDiario(o: {
  id: string;
  aulasMinistradas: number;
  aulasPrevistas: number;
  turma: { codigo: string };
  disciplina: { nome: string };
  professor: { nome: string; email: string; whatsapp: string | null; usaWhatsapp: boolean };
}): MensagemPronta {
  return {
    chave: `diario:${o.id}`,
    titulo: `Docente: ${o.professor.nome}`,
    canal: null,
    destino: 'Docente (lembrete de diário)',
    ...contatoDoUsuario(o.professor),
    assunto: `[SGC-Redes] Lembrete do diário — ${o.disciplina.nome} (${o.turma.codigo})`,
    texto: mensagemLembrete({
      professor: primeiroNome(o.professor.nome),
      disciplina: o.disciplina.nome,
      turma: o.turma.codigo,
      ministradas: o.aulasMinistradas,
      previstas: o.aulasPrevistas,
    }),
  };
}
