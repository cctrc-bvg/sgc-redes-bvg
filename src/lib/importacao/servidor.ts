import 'server-only';
import * as z from 'zod';
import { lerArquivo } from './planilha';
import { LINHAS_MAXIMAS, mapearColunas } from './tabela';

type Colunas<C extends string> = readonly { campo: C; titulo: string; apelidos: readonly string[]; obrigatoria?: boolean }[];

export interface DadosPlanilha<C extends string> {
  registros: { numero: number; valores: Record<C, string> }[];
  presentes: Set<C>;
  desconhecidas: string[];
}

/**
 * Etapa 1 ou 2 da importação. Na análise, lê o arquivo enviado; na confirmação, lê os dados da
 * prévia devolvidos no campo oculto "dados". Em ambos os casos a validação de negócio é refeita depois.
 */
export async function lerEntrada<C extends string>(
  formData: FormData,
  colunas: Colunas<C>,
): Promise<{ confirmar: boolean } & (DadosPlanilha<C> | { erro: string })> {
  const confirmar = formData.get('etapa') === 'confirmar';
  if (confirmar) return { confirmar, ...lerDados(String(formData.get('dados') ?? ''), colunas) };

  const tabela = await lerArquivo(formData.get('arquivo'));
  if ('erro' in tabela) return { confirmar, erro: tabela.erro };
  const m = mapearColunas(tabela, colunas);
  if (m.faltando.length) {
    return { confirmar, erro: `Faltam colunas obrigatórias: ${m.faltando.join(', ')}. Use o modelo desta página como base.` };
  }
  return { confirmar, registros: m.registros, presentes: m.presentes, desconhecidas: m.desconhecidas };
}

/** Serializa a prévia para o campo oculto da confirmação. */
export function serializarDados<C extends string>(d: DadosPlanilha<C>): string {
  return JSON.stringify({ registros: d.registros, presentes: [...d.presentes] });
}

function lerDados<C extends string>(json: string, colunas: Colunas<C>): DadosPlanilha<C> | { erro: string } {
  const campos = colunas.map((c) => c.campo) as [C, ...C[]];
  const Esquema = z.object({
    registros: z
      .array(z.object({ numero: z.number().int().min(2), valores: z.record(z.enum(campos), z.string().max(10_000)) }))
      .min(1)
      .max(LINHAS_MAXIMAS),
    presentes: z.array(z.enum(campos)),
  });
  try {
    const d = Esquema.parse(JSON.parse(json));
    // Completa campos ausentes com vazio, como na leitura da planilha.
    const registros = d.registros.map((r) => ({
      numero: r.numero,
      valores: Object.fromEntries(campos.map((c) => [c, r.valores[c] ?? ''])) as Record<C, string>,
    }));
    return { registros, presentes: new Set(d.presentes), desconhecidas: [] };
  } catch {
    return { erro: 'Os dados da prévia são inválidos. Envie a planilha novamente.' };
  }
}

export function avisoColunasDesconhecidas(desconhecidas: string[]): string[] {
  return desconhecidas.length ? [`Colunas ignoradas (nomes não reconhecidos): ${desconhecidas.join(', ')}.`] : [];
}
