/**
 * Kanban de processos SEI e atendimentos (RF09). Itens sigilosos só aparecem para quem tem
 * `kanban:ver-sigiloso` (Coordenação — Art. 22, VIII); a regra vale nas telas e nas ações.
 */
import type { ColunaKanban, TipoProcesso } from '@prisma/client';
import * as z from 'zod';
import { validarDataISO } from '@/lib/alimentacao-engine';

export const COLUNAS: readonly ColunaKanban[] = ['NOVO', 'COM_PROFESSOR', 'AGUARDANDO_RETORNO', 'CONCLUIDO'];

export const NOME_COLUNA: Record<ColunaKanban, string> = {
  NOVO: 'Novo',
  COM_PROFESSOR: 'Com professor',
  AGUARDANDO_RETORNO: 'Aguardando retorno',
  CONCLUIDO: 'Concluído',
};

export const TIPOS: readonly TipoProcesso[] = ['APROVEITAMENTO_DISCIPLINA', 'GRADUADO_TRANSFERIDO', 'ESTAGIO', 'ORIENTACAO_MEDIACAO', 'OUTRO_SEI'];

export const NOME_TIPO: Record<TipoProcesso, string> = {
  APROVEITAMENTO_DISCIPLINA: 'Aproveitamento de disciplina',
  GRADUADO_TRANSFERIDO: 'Graduado/Transferido',
  ESTAGIO: 'Estágio',
  ORIENTACAO_MEDIACAO: 'Orientação/Mediação',
  OUTRO_SEI: 'Outro SEI',
};

/** Número SEI no formato do processo eletrônico federal: 23255.000123/2026-45 (dígitos e pontuação). */
const FORMATO_SEI = /^\d{5}\.\d{6}\/\d{4}-\d{2}$/;

const vazioParaUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const ProcessoSchema = z.object({
  titulo: z.string().trim().min(3, { error: 'Informe um título curto (ex.: Aproveitamento — matrícula 2026xxxx).' }).max(120, { error: 'Use no máximo 120 caracteres.' }),
  tipo: z.enum(TIPOS, { error: 'Escolha a etiqueta.' }),
  coluna: z.enum(COLUNAS, { error: 'Escolha a etapa.' }),
  numeroSei: z.preprocess(
    vazioParaUndefined,
    z.string().trim().regex(FORMATO_SEI, { error: 'Use o formato do SEI: 23255.000123/2026-45.' }).optional(),
  ),
  prazo: z.preprocess(
    vazioParaUndefined,
    z
      .string()
      .refine(
        (v) => {
          try {
            validarDataISO(v);
            return true;
          } catch {
            return false;
          }
        },
        { error: 'Informe uma data válida.' },
      )
      .optional(),
  ),
  descricao: z.preprocess(vazioParaUndefined, z.string().trim().max(2000, { error: 'Use no máximo 2.000 caracteres.' }).optional()),
  sigiloso: z.string().optional().transform((v) => v === 'on'),
});

export type DadosProcesso = z.infer<typeof ProcessoSchema>;

/** Situação do prazo em relação a hoje (datas ISO no fuso de Fortaleza). */
export function situacaoPrazo(prazoISO: string | null, hojeISO: string, coluna: ColunaKanban): 'sem-prazo' | 'concluido' | 'vencido' | 'hoje' | 'proximo' | 'ok' {
  if (coluna === 'CONCLUIDO') return 'concluido';
  if (!prazoISO) return 'sem-prazo';
  if (prazoISO < hojeISO) return 'vencido';
  if (prazoISO === hojeISO) return 'hoje';
  const dias = (Date.parse(`${prazoISO}T12:00:00Z`) - Date.parse(`${hojeISO}T12:00:00Z`)) / 86_400_000;
  return dias <= 3 ? 'proximo' : 'ok';
}

/** Próxima e anterior etapa para os botões de mover (funcionam sem JavaScript). */
export function vizinhas(coluna: ColunaKanban): { anterior: ColunaKanban | null; proxima: ColunaKanban | null } {
  const i = COLUNAS.indexOf(coluna);
  return { anterior: i > 0 ? COLUNAS[i - 1] : null, proxima: i < COLUNAS.length - 1 ? COLUNAS[i + 1] : null };
}

/** Filtro de visibilidade: sem permissão de sigilo, itens sigilosos não existem para o usuário. */
export const filtroSigilo = (podeVerSigiloso: boolean) => (podeVerSigiloso ? {} : { sigiloso: false });
