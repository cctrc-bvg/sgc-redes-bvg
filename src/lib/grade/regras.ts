import * as z from 'zod';
import { validarDataISO } from '@/lib/alimentacao-engine';
import { anoLetivoAtual, lerAnoLetivo } from '@/lib/ofertas/regras';

/** Dias com grade própria (1=Segunda … 5=Sexta). Sábado letivo segue um destes (G14). */
export const DIAS_SEMANA = [1, 2, 3, 4, 5] as const;
export const NOME_DIA: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

/** Nome por extenso, em minúsculas, para frases ("segue a grade de terça-feira"). */
export const NOME_DIA_EXTENSO: Record<number, string> = {
  1: 'segunda-feira',
  2: 'terça-feira',
  3: 'quarta-feira',
  4: 'quinta-feira',
  5: 'sexta-feira',
};

/** Semanas letivas de referência para converter carga horária em aulas semanais (blocos de 60 min). */
export const SEMANAS_POR_SEMESTRE = 20;

/** Semestre letivo pelo mês em Fortaleza: janeiro–junho → 1, julho–dezembro → 2. */
export function semestreLetivoAtual(agora: Date = new Date()): 1 | 2 {
  const mes = Number(new Intl.DateTimeFormat('en', { month: 'numeric', timeZone: 'America/Fortaleza' }).format(agora));
  return mes <= 6 ? 1 : 2;
}

export function lerSemestreLetivo(valor: unknown): 1 | 2 | null {
  return valor === '1' ? 1 : valor === '2' ? 2 : null;
}

/** Uma oferta aparece na grade do semestre se for anual ou do próprio semestre. */
export function ofertaValeNoSemestre(semestreLetivoDaOferta: number | null, semestre: number): boolean {
  return semestreLetivoDaOferta === null || semestreLetivoDaOferta === semestre;
}

/**
 * Aulas semanais que a matriz prevê: técnica (semestral) = CH / 20 semanas; anual = CH / 40 semanas.
 * É uma referência para a Coordenação conferir a grade, não uma trava.
 */
export function aulasSemanaisPrevistas(cargaHoraria: number, semestreLetivoDaOferta: number | null): number {
  const semanas = semestreLetivoDaOferta === null ? SEMANAS_POR_SEMESTRE * 2 : SEMANAS_POR_SEMESTRE;
  return Math.round(cargaHoraria / semanas);
}

/** Chave de uma célula da grade: "<dia>:<blocoId>". */
export const chaveCelula = (dia: number, blocoId: string) => `${dia}:${blocoId}`;
export const PREFIXO_CELULA = 'celula:';

export interface OfertaNaGrade {
  professorId: string;
}

export interface PlanoGrade {
  gravar: { chave: string; ofertaId: string }[];
  remover: string[];
  erros: Record<string, string>;
}

/**
 * Compara a grade atual da turma (chave → ofertaId) com a desejada ("" = vago) e devolve o que gravar
 * e o que remover.
 * - Só aceita ofertas da própria turma válidas no semestre (`ofertas`).
 * - Recusa choque de horário: o professor já dá aula em outra turma no mesmo dia e bloco
 *   (`ocupacao`: "<professorId>|<chave>" → nome da outra turma).
 */
export function planejarGrade(params: {
  atuais: ReadonlyMap<string, string | null>;
  desejado: ReadonlyMap<string, string>;
  ofertas: ReadonlyMap<string, OfertaNaGrade>;
  ocupacao: ReadonlyMap<string, string>;
}): PlanoGrade {
  const plano: PlanoGrade = { gravar: [], remover: [], erros: {} };
  for (const [chave, ofertaId] of params.desejado) {
    const atual = params.atuais.get(chave);
    if (ofertaId === '') {
      if (atual !== undefined) plano.remover.push(chave);
      continue;
    }
    const oferta = params.ofertas.get(ofertaId);
    if (!oferta) {
      plano.erros[chave] = 'Disciplina inválida para esta turma neste semestre.';
      continue;
    }
    const outraTurma = params.ocupacao.get(`${oferta.professorId}|${chave}`);
    if (outraTurma) {
      plano.erros[chave] = `Choque de horário: o professor já tem aula na turma ${outraTurma} neste horário.`;
      continue;
    }
    if (atual !== ofertaId) plano.gravar.push({ chave, ofertaId });
  }
  return plano;
}

/**
 * Janelas livres (RF01): blocos vagos num turno em que a turma tem pelo menos uma aula naquele dia.
 * `ocupadas` são as chaves preenchidas; `blocos` traz o turno de cada bloco.
 */
export function janelasLivres(ocupadas: ReadonlySet<string>, blocos: readonly { id: string; turno: string }[]): Set<string> {
  const janelas = new Set<string>();
  for (const dia of DIAS_SEMANA) {
    for (const turno of new Set(blocos.map((b) => b.turno))) {
      const doTurno = blocos.filter((b) => b.turno === turno).map((b) => chaveCelula(dia, b.id));
      if (doTurno.some((c) => ocupadas.has(c))) doTurno.filter((c) => !ocupadas.has(c)).forEach((c) => janelas.add(c));
    }
  }
  return janelas;
}

/**
 * Dia da semana cuja grade vale numa data (G14). Segunda a sexta: o próprio dia. Sábado ou domingo
 * letivo (este, só em situação extraordinária): o dia de referência cadastrado. Fim de semana comum: null (sem aula).
 */
export function diaDaGradeNaData(dataISO: string, sabadosLetivos: ReadonlyMap<string, number>): number | null {
  validarDataISO(dataISO);
  const diaSemana = new Date(`${dataISO}T12:00:00Z`).getUTCDay(); // 0=domingo … 6=sábado
  if (diaSemana >= 1 && diaSemana <= 5) return diaSemana;
  if (diaSemana === 6 || diaSemana === 0) return sabadosLetivos.get(dataISO) ?? null;
  return null;
}

/** Formulário de sábado letivo (ou domingo letivo, em situação extraordinária). */
export const SabadoLetivoSchema = z.object({
  data: z
    .string()
    .trim()
    .min(1, { error: 'Informe a data do sábado ou domingo letivo.' })
    .refine(
      (v) => {
        try {
          validarDataISO(v);
          const dia = new Date(`${v}T12:00:00Z`).getUTCDay();
          return dia === 6 || dia === 0;
        } catch {
          return false;
        }
      },
      { error: 'Escolha uma data que caia num sábado ou domingo.' },
    ),
  diaSemanaReferente: z.enum(['1', '2', '3', '4', '5'], { error: 'Escolha o dia da semana cuja grade vale neste sábado.' }).transform(Number),
  observacao: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(200, { error: 'Use no máximo 200 caracteres.' }).optional(),
  ),
});

/** Período da URL (?ano=&sem=), com o ano e o semestre correntes como padrão. */
export function periodoDaUrl(params: { ano?: string; sem?: string }, agora: Date = new Date()) {
  return {
    anoLetivo: lerAnoLetivo(params.ano) ?? anoLetivoAtual(agora),
    semestreLetivo: lerSemestreLetivo(params.sem) ?? semestreLetivoAtual(agora),
  };
}

/** Anos oferecidos no seletor: o anterior, o corrente, o próximo e o escolhido. */
export function anosDoSeletor(anoEscolhido: number, agora: Date = new Date()): number[] {
  const atual = anoLetivoAtual(agora);
  return [...new Set([atual - 1, atual, atual + 1, anoEscolhido])].sort();
}
