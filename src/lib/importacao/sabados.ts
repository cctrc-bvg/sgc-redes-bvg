import { SabadoLetivoSchema, NOME_DIA } from '@/lib/grade/regras';
import type { LinhaResultado as LinhaAnalisada } from './estado';
import { normalizarCabecalho } from './tabela';

/** Colunas da planilha de sábados letivos (G14). */
export const COLUNAS_SABADO = [
  { campo: 'data', titulo: 'Data', apelidos: ['sabado', 'dia_letivo'], obrigatoria: true, largura: 14 },
  { campo: 'diaSemanaReferente', titulo: 'Segue a grade de', apelidos: ['grade_de', 'dia_da_semana', 'dia', 'grade'], obrigatoria: true, largura: 18 },
  { campo: 'observacao', titulo: 'Observação', apelidos: ['obs', 'motivo'], largura: 40 },
] as const;

export type CampoSabado = (typeof COLUNAS_SABADO)[number]['campo'];
export type RegistroSabado = Record<CampoSabado, string>;

export const OPCOES_DIA_PLANILHA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

export interface SabadoExistente {
  id: string;
  data: string; // AAAA-MM-DD
  diaSemanaReferente: number;
  observacao: string | null;
}

export interface PlanoImportacaoSabados {
  linhas: LinhaAnalisada[];
  criar: { data: string; diaSemanaReferente: number; observacao: string | null }[];
  atualizar: { id: string; diaSemanaReferente: number; observacao: string | null }[];
  temErros: boolean;
}

/** "26/09/2026" ou "2026-09-26" → ISO; outro formato volta como veio (o schema acusa o erro). */
export function lerDataPlanilha(v: string): string {
  const t = v.trim();
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return t.slice(0, 10);
}

/**
 * "Segunda", "segunda-feira", "2ª" → 1 … "Sexta", "6ª" → 5. Números puros são recusados de propósito:
 * "2" pode ser "segunda" (2ª-feira) ou "terça" (dia 2 da semana).
 */
export function lerDiaSemana(v: string): number | null {
  const n = normalizarCabecalho(v).replace(/_feira$/, '');
  const nomes: Record<string, number> = { seg: 1, ter: 2, qua: 3, qui: 4, sex: 5 };
  const prefixo = n.slice(0, 3);
  if (prefixo in nomes && n.length >= 3) return nomes[prefixo];
  const ordinal = /^([2-6])(a|º|ª)$/.exec(v.trim().toLowerCase().replace(/\s/g, ''));
  return ordinal ? Number(ordinal[1]) - 1 : null;
}

export function planejarImportacaoSabados(params: {
  registros: { numero: number; valores: RegistroSabado }[];
  presentes: ReadonlySet<CampoSabado>;
  existentes: readonly SabadoExistente[];
}): PlanoImportacaoSabados {
  const plano: PlanoImportacaoSabados = { linhas: [], criar: [], atualizar: [], temErros: false };
  const porData = new Map(params.existentes.map((e) => [e.data, e]));
  const vistos = new Map<string, number>();
  for (const { numero, valores } of params.registros) {
    const data = lerDataPlanilha(valores.data);
    const descricao = valores.data || '(sem data)';
    const dia = lerDiaSemana(valores.diaSemanaReferente);
    const r = SabadoLetivoSchema.safeParse({ data, diaSemanaReferente: dia ? String(dia) : '', observacao: valores.observacao });
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      if (dia === null) msgs.splice(0, msgs.length, ...msgs.filter((m) => !m.includes('dia da semana')), 'Segue a grade de: use Segunda, Terça, Quarta, Quinta ou Sexta.');
      plano.linhas.push({ numero, descricao, situacao: 'erro', detalhe: [...new Set(msgs)].join(' ') });
      plano.temErros = true;
      continue;
    }
    const d = r.data;
    const repetida = vistos.get(d.data);
    if (repetida) {
      plano.linhas.push({ numero, descricao, situacao: 'erro', detalhe: `Repete a data da linha ${repetida}.` });
      plano.temErros = true;
      continue;
    }
    vistos.set(d.data, numero);
    const descricaoOk = `${descricao} → grade de ${NOME_DIA[d.diaSemanaReferente].toLowerCase()}`;
    const observacao = params.presentes.has('observacao') ? (d.observacao ?? null) : undefined;
    const existente = porData.get(d.data);
    if (!existente) {
      plano.criar.push({ data: d.data, diaSemanaReferente: d.diaSemanaReferente, observacao: observacao ?? null });
      plano.linhas.push({ numero, descricao: descricaoOk, situacao: 'criar' });
      continue;
    }
    const novaObs = observacao === undefined ? existente.observacao : observacao;
    if (existente.diaSemanaReferente === d.diaSemanaReferente && existente.observacao === novaObs) {
      plano.linhas.push({ numero, descricao: descricaoOk, situacao: 'igual' });
    } else {
      plano.atualizar.push({ id: existente.id, diaSemanaReferente: d.diaSemanaReferente, observacao: novaObs });
      plano.linhas.push({ numero, descricao: descricaoOk, situacao: 'atualizar' });
    }
  }
  return plano;
}

export const INSTRUCOES_SABADOS = [
  'Importação de sábados letivos — SGC-Redes',
  'Preencha a aba "Dados", um sábado por linha, conforme o calendário acadêmico, e envie em Grade › Sábados letivos › Importar planilha. Antes de gravar, o sistema mostra a prévia.',
  'Data: o sábado letivo (dd/mm/aaaa). Datas que não caem em sábado são recusadas.',
  'Segue a grade de: Segunda, Terça, Quarta, Quinta ou Sexta (a grade desse dia vale no sábado — G14). Não use números.',
  'Observação: opcional (ex.: reposição do feriado de 12/10).',
  'Uma data já cadastrada é atualizada; nenhuma é excluída pela planilha. Máximo de 500 linhas.',
];
