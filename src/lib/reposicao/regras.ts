/**
 * Reposição de aulas dispensadas (ROD, Art. 37). O docente pode informar que repôs (com o formulário, se quiser) e a
 * Coordenação dá ciência; ou a Coordenação registra direto. Nada é obrigatório: o formulário também pode ir pelo
 * e-mail institucional. Funções puras.
 */
import * as z from 'zod';

/** E-mail institucional da Coordenação, para onde o docente pode enviar o formulário de reposição. */
export const COORDENACAO_CURSO = { sigla: 'CCTRC', email: 'cctrc.boaviagem@ifce.edu.br' } as const;

export const ORIENTACAO_FORMULARIO = `O formulário de reposição de aula (com a data, o conteúdo e o registro assinado pela turma) deve ser encaminhado à Coordenação. Você pode enviá-lo pelo seu e-mail institucional para ${COORDENACAO_CURSO.email} ou anexá-lo aqui, pelo sistema. Os dois caminhos valem; o anexo não é obrigatório.`;

export type SituacaoReposicao = 'pendente' | 'agendada' | 'aguarda-ciencia' | 'reposta';

export const NOME_SITUACAO_REPOSICAO: Record<SituacaoReposicao, { icone: string; texto: string }> = {
  pendente: { icone: '⏳', texto: 'Reposição pendente' },
  agendada: { icone: '📅', texto: 'Reposição agendada' },
  'aguarda-ciencia': { icone: '📨', texto: 'Informada pelo docente, aguarda ciência' },
  reposta: { icone: '✔', texto: 'Reposta' },
};

export function situacaoReposicao(a: { status: string; reposicaoEm: string | null; reposicaoCienteEm: Date | null }): SituacaoReposicao {
  if (a.reposicaoEm) return a.reposicaoCienteEm ? 'reposta' : 'aguarda-ciencia';
  return a.status === 'REPOSICAO_AGENDADA' ? 'agendada' : 'pendente';
}

/** A aula ainda deve ser reposta: sem reposição informada. Reposições informadas deixam de ser pendência de prazo. */
export const reposicaoEmAberto = (a: { status: string; reposicaoEm: unknown }) =>
  (a.status === 'TURMA_DISPENSADA' || a.status === 'REPOSICAO_AGENDADA') && !a.reposicaoEm;

export const ReposicaoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Informe a data em que a aula foi reposta.' }),
  observacao: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(300, { error: 'Use no máximo 300 caracteres.' }).optional(),
  ),
});

/** A reposição não é anterior à aula perdida nem posterior a hoje. */
export function validarDataReposicao(data: string, dataAula: string, hojeISO: string): string | null {
  if (Number.isNaN(Date.parse(`${data}T12:00:00Z`))) return 'Data inválida.';
  if (data < dataAula) return 'A reposição não pode ser anterior à aula perdida.';
  if (data > hojeISO) return 'Informe uma data que já passou. Para uma reposição futura, a Coordenação marca "reposição agendada".';
  return null;
}

export const MAX_ANEXO_BYTES = 5 * 1024 * 1024;
export const MAX_ANEXOS_POR_AUSENCIA = 3;

const ASSINATURAS: { mime: string; ext: string; inicio: number[] }[] = [
  { mime: 'application/pdf', ext: 'pdf', inicio: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/jpeg', ext: 'jpg', inicio: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: 'png', inicio: [0x89, 0x50, 0x4e, 0x47] },
];

/** Confere o conteúdo pelos primeiros bytes (a extensão e o tipo enviados pelo navegador não valem). */
export function tipoDoAnexo(bytes: Uint8Array): { mime: string; ext: string } | null {
  const achado = ASSINATURAS.find((a) => a.inicio.every((b, i) => bytes[i] === b));
  return achado ? { mime: achado.mime, ext: achado.ext } : null;
}

export function validarAnexo(bytes: Uint8Array, anexosExistentes: number): { erro: string } | { mime: string; ext: string } {
  if (anexosExistentes >= MAX_ANEXOS_POR_AUSENCIA) return { erro: `Já há ${MAX_ANEXOS_POR_AUSENCIA} arquivos anexados a esta ausência.` };
  if (bytes.length === 0) return { erro: 'O arquivo está vazio.' };
  if (bytes.length > MAX_ANEXO_BYTES) return { erro: 'O arquivo passa de 5 MB. Reduza-o ou envie pelo e-mail institucional.' };
  const tipo = tipoDoAnexo(bytes);
  return tipo ?? { erro: 'Envie um arquivo PDF, JPG ou PNG.' };
}

/** Nome de arquivo seguro para guardar e baixar: sem caminho, sem caracteres de controle, com a extensão verdadeira. */
export function nomeSeguroDoAnexo(nome: string, ext: string): string {
  const base = nome.replace(/\.[^.]*$/, '').normalize('NFC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'formulario-reposicao';
  return `${base}.${ext}`;
}
