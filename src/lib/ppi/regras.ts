/**
 * Prática Profissional Integrada — 40 horas (RF07, Manual 2022). Só a Coordenação lança e audita (G11).
 *
 * Os tetos valem por CATEGORIA somando todas as atividades da solicitação: quantidade máxima e
 * pontuação máxima da linha do Manual. As horas de cada atividade são distribuídas em ordem de data;
 * a que estourar o teto recebe só o que sobrou (as seguintes, zero).
 */
import type { StatusPpi } from '@prisma/client';
import * as z from 'zod';
import { validarDataISO } from '@/lib/alimentacao-engine';

export interface RegraPpi {
  id: string;
  horasPorUnidade: number;
  qtdMaxima: number;
  pontuacaoMaxima: number;
}

export interface AtividadeParaCalculo {
  id: string;
  regraId: string;
  quantidadeInformada: number;
  dataRealizacao: string; // AAAA-MM-DD
  aprovada: boolean;
}

/** Horas validadas de cada atividade (id → horas), respeitando os tetos acumulados da categoria. */
export function distribuirHoras(atividades: readonly AtividadeParaCalculo[], regras: ReadonlyMap<string, RegraPpi>): Map<string, number> {
  const horas = new Map<string, number>();
  const porRegra = new Map<string, AtividadeParaCalculo[]>();
  for (const a of atividades) porRegra.set(a.regraId, [...(porRegra.get(a.regraId) ?? []), a]);
  for (const [regraId, lista] of porRegra) {
    const regra = regras.get(regraId);
    let qtdRestante = regra?.qtdMaxima ?? 0;
    let horasRestantes = regra?.pontuacaoMaxima ?? 0;
    const ordenadas = [...lista].sort((x, y) => x.dataRealizacao.localeCompare(y.dataRealizacao) || x.id.localeCompare(y.id));
    for (const a of ordenadas) {
      if (!regra || !a.aprovada) {
        horas.set(a.id, 0);
        continue;
      }
      const qtd = Math.max(0, Math.min(a.quantidadeInformada, qtdRestante));
      const h = Math.min(qtd * regra.horasPorUnidade, horasRestantes);
      qtdRestante -= qtd;
      horasRestantes -= h;
      horas.set(a.id, Math.round(h * 10) / 10);
    }
  }
  return horas;
}

export const META_PPI = 40;

/** Total por grupo (I a VI) e geral. */
export function totaisPorGrupo(atividades: readonly { regraId: string; horas: number }[], grupoDaRegra: ReadonlyMap<string, number>) {
  const grupos = new Map<number, number>();
  for (const a of atividades) {
    const g = grupoDaRegra.get(a.regraId) ?? 0;
    grupos.set(g, (grupos.get(g) ?? 0) + a.horas);
  }
  const total = [...grupos.values()].reduce((s, h) => s + h, 0);
  return { grupos, total: Math.round(total * 10) / 10 };
}

export const NOME_GRUPO_ROMANO = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

const vazio = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const dataValida = (v: string) => {
  try {
    validarDataISO(v);
    return true;
  } catch {
    return false;
  }
};

/** Matrícula do IFCE: só dígitos (10 a 20). */
export const SolicitacaoSchema = z.object({
  nomeEstudante: z.string().trim().min(5, { error: 'Informe o nome completo do estudante.' }).max(120, { error: 'Use no máximo 120 caracteres.' }),
  matricula: z.string().trim().regex(/^\d{8,20}$/, { error: 'Informe a matrícula (só números).' }),
  turmaAtual: z.string().trim().min(1, { error: 'Escolha a turma.' }).max(40),
});

export function criarAtividadeSchema(hojeISO: string) {
  return z.object({
    regraId: z.string().trim().min(1, { error: 'Escolha a categoria do Manual.' }),
    descricaoComprovante: z.string().trim().min(5, { error: 'Descreva o comprovante (ex.: Certificado de monitoria 2026.1).' }).max(300),
    // Identificador do certificado: impede usar o mesmo comprovante em duas categorias.
    codigoCertificado: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, { error: 'Informe o código ou número do certificado.' })
      .max(80),
    dataRealizacao: z
      .string()
      .trim()
      .refine(dataValida, { error: 'Informe uma data válida.' })
      .refine((v) => !dataValida(v) || v <= hojeISO, { error: 'A data não pode ser futura.' }),
    quantidadeInformada: z
      .string()
      .trim()
      .regex(/^\d{1,3}([.,]\d)?$/, { error: 'Informe a quantidade (ex.: 1 ou 2,5).' })
      .transform((v) => Number(v.replace(',', '.')))
      .pipe(z.number().positive({ error: 'A quantidade deve ser maior que zero.' })),
    orientadorId: z.preprocess(vazio, z.string().trim().optional()),
    orientadorExterno: z.preprocess(vazio, z.string().trim().max(120).optional()),
  });
}

/** Formata horas com vírgula: 7.5 → "7,5". */
export const formatarHoras = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1).replace('.', ','));

export const NOME_STATUS_PPI: Record<StatusPpi, string> = {
  RASCUNHO: 'Rascunho',
  EM_ANALISE: 'Em análise',
  DEFERIDA: 'Deferida',
  INDEFERIDA: 'Indeferida',
};
