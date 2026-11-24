/**
 * Progressão Parcial de Estudos (RF06, ROD Arts. 115–128). Funções puras.
 *
 * - Art. 115: até 2 componentes em PPE por semestre; 3 ou mais → alerta de retenção.
 * - Arts. 117/118: o docente define PEI (até 30% da CH, §1º) ou Dependência (100%, §2º; EaD se o PPC prevê, Art. 120).
 * - Art. 121: disciplina com prática exige horas práticas no PEI.
 * - Art. 123: aprovação (inclusive antecipada); Art. 124: prorrogação; Art. 125: lançamento no sistema acadêmico.
 * - G09: um PEI por estudante, com cópia do cronograma de outro PEI da mesma disciplina e semestre.
 */
import type { ModalidadePPE, StatusPPE } from '@prisma/client';
import * as z from 'zod';
import { validarDataISO } from '@/lib/alimentacao-engine';
import { validarLimitePei } from '@/lib/ppi-ppe-engines';

export const LIMITE_COMPONENTES_PPE = 2;

export const NOME_MODALIDADE: Record<ModalidadePPE, string> = {
  A_DEFINIR: 'A definir pelo docente',
  PEI: 'PEI — Plano de Estudo Individual (até 30%)',
  DEPENDENCIA: 'Dependência presencial (100%)',
  DEPENDENCIA_EAD: 'Dependência a distância (100%)',
};

export const NOME_STATUS_PPE: Record<StatusPPE, string> = {
  AGUARDANDO_PROFESSOR: 'Aguardando o docente',
  EM_ANDAMENTO: 'Em andamento',
  PRORROGADO: 'Prorrogado (Art. 124)',
  APROVADO: 'Aprovado (Art. 123)',
  REPROVADO: 'Reprovado',
  LANCADO_ACADEMICO: 'Lançado no sistema acadêmico (Art. 125)',
};

/** Semestre "AAAA.S" corrente em Fortaleza. */
export function semestreAtual(agora: Date = new Date()): string {
  const [ano, mes] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit' }).format(agora).split('-').map(Number);
  return `${ano}.${mes <= 6 ? 1 : 2}`;
}

export const FORMATO_SEMESTRE = /^20\d{2}\.[12]$/;
export const anoDoSemestre = (s: string) => Number(s.slice(0, 4));

/** Art. 115: retenção quando o estudante tem 3 ou mais componentes em PPE no semestre. */
export const excedeLimitePpe = (componentesNoSemestre: number) => componentesNoSemestre > LIMITE_COMPONENTES_PPE;

export const RegistroPpeSchema = z.object({
  nomeEstudante: z.string().trim().min(5, { error: 'Informe o nome completo do estudante.' }).max(120),
  matricula: z.string().trim().regex(/^\d{8,20}$/, { error: 'Informe a matrícula (só números).' }),
  disciplinaId: z.string().trim().min(1, { error: 'Escolha o componente curricular.' }),
  semestre: z.string().trim().regex(FORMATO_SEMESTRE, { error: 'Use o formato 2026.1 ou 2026.2.' }),
});

export const MODALIDADES_DEFINIVEIS = ['PEI', 'DEPENDENCIA', 'DEPENDENCIA_EAD'] as const;

/** Transições permitidas a partir de cada situação (além de definir a modalidade). */
export const TRANSICOES: Record<StatusPPE, readonly StatusPPE[]> = {
  AGUARDANDO_PROFESSOR: [],
  EM_ANDAMENTO: ['PRORROGADO', 'APROVADO', 'REPROVADO'],
  PRORROGADO: ['APROVADO', 'REPROVADO'],
  APROVADO: ['LANCADO_ACADEMICO'],
  REPROVADO: ['LANCADO_ACADEMICO'],
  LANCADO_ACADEMICO: [],
};

/** Só a Coordenação marca o lançamento no sistema acadêmico (Art. 125). */
export const exigeCoordenacao = (destino: StatusPPE) => destino === 'LANCADO_ACADEMICO';

const inteiro = (rotulo: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, { error: `Informe ${rotulo} em horas inteiras.` })
    .transform(Number);

export const PeiSchema = z.object({
  cargaHorariaPei: inteiro('a carga horária do PEI'),
  horasPresenciais: inteiro('as horas presenciais'),
  horasPraticas: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? '0' : v), inteiro('as horas práticas')),
  objetivos: z.string().trim().min(10, { error: 'Descreva os objetivos de aprendizagem.' }).max(3000),
  conteudos: z.string().trim().min(10, { error: 'Liste os conteúdos a recuperar.' }).max(3000),
  criteriosAval: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(2000).optional()),
});

export type DadosPei = z.infer<typeof PeiSchema>;

/** Travas do ROD sobre os dados do PEI (Arts. 117 §1º e 121). Retorna erros por campo. */
export function travasPei(d: Pick<DadosPei, 'cargaHorariaPei' | 'horasPresenciais' | 'horasPraticas'>, disciplina: { cargaHoraria: number; exigePratica: boolean }) {
  const r = validarLimitePei({
    cargaHorariaDisciplina: disciplina.cargaHoraria,
    cargaHorariaPeiInformada: d.cargaHorariaPei,
    horasPresenciais: d.horasPresenciais,
    horasPraticas: d.horasPraticas,
    exigePratica: disciplina.exigePratica,
  });
  const erros: Partial<Record<'cargaHorariaPei' | 'horasPresenciais' | 'horasPraticas', string>> = {};
  for (const msg of r.erros) {
    if (msg.includes('Art. 121')) erros.horasPraticas = msg;
    else if (msg.includes('presenciais')) erros.horasPresenciais = msg;
    else erros.cargaHorariaPei = msg;
  }
  if (d.horasPraticas > d.cargaHorariaPei) erros.horasPraticas = 'As horas práticas não podem passar da carga horária do PEI.';
  return { erros, teto: r.teto30Porcento };
}

export interface EncontroLido {
  data: string;
  conteudo: string;
  metodologiaAvaliacao: string;
}

export const LINHAS_EXTRAS_CRONOGRAMA = 3;
export const MAXIMO_ENCONTROS = 30;

/**
 * Lê o cronograma do formulário (`encontro:<i>:data|conteudo|metodologia`). Linhas totalmente vazias são
 * ignoradas; linha incompleta ou com data inválida vira erro na posição. Ordena por data.
 */
export function lerCronograma(campos: (nome: string) => string, linhas: number): { encontros: EncontroLido[]; erros: Record<number, string> } {
  const encontros: EncontroLido[] = [];
  const erros: Record<number, string> = {};
  for (let i = 0; i < Math.min(linhas, MAXIMO_ENCONTROS + LINHAS_EXTRAS_CRONOGRAMA); i++) {
    const data = campos(`encontro:${i}:data`).trim();
    const conteudo = campos(`encontro:${i}:conteudo`).trim();
    const metodologiaAvaliacao = campos(`encontro:${i}:metodologia`).trim();
    if (!data && !conteudo && !metodologiaAvaliacao) continue;
    if (!data || !conteudo || !metodologiaAvaliacao) {
      erros[i] = 'Preencha data, conteúdo e metodologia/avaliação (ou deixe a linha toda em branco).';
      continue;
    }
    try {
      validarDataISO(data);
    } catch {
      erros[i] = 'Data inválida.';
      continue;
    }
    if (conteudo.length > 500 || metodologiaAvaliacao.length > 500) {
      erros[i] = 'Use no máximo 500 caracteres em cada campo.';
      continue;
    }
    encontros.push({ data, conteudo, metodologiaAvaliacao });
  }
  if (encontros.length > MAXIMO_ENCONTROS) erros[-1] = `Use no máximo ${MAXIMO_ENCONTROS} encontros.`;
  encontros.sort((a, b) => a.data.localeCompare(b.data));
  return { encontros, erros };
}

/** Prorrogação (Art. 124): nova data depois de hoje e justificativa. */
export const ProrrogacaoSchema = z.object({
  prorrogadoAte: z
    .string()
    .trim()
    .refine(
      (v) => {
        try {
          validarDataISO(v);
          return true;
        } catch {
          return false;
        }
      },
      { error: 'Informe a nova data-limite.' },
    ),
  justificativaProrrogacao: z.string().trim().min(10, { error: 'Justifique a prorrogação (mín. 10 caracteres).' }).max(1000),
});
