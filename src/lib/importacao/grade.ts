import type { Turno } from '@prisma/client';
import { NOME_DIA } from '@/lib/grade/regras';
import type { LinhaResultado } from './estado';
import { lerDiaSemana, OPCOES_DIA_PLANILHA } from './sabados';
import { normalizarCabecalho } from './tabela';

/**
 * Planilha da grade horária de um semestre: uma linha por aula (turma, dia, horário, disciplina).
 * Mesmo formato da exportação, para baixar, editar no Excel e enviar de volta.
 */
export const COLUNAS_GRADE = [
  { campo: 'turma', titulo: 'Turma', apelidos: ['codigo_da_turma', 'codigo_turma'], obrigatoria: true, largura: 12 },
  { campo: 'dia', titulo: 'Dia', apelidos: ['dia_da_semana'], obrigatoria: true, largura: 12 },
  { campo: 'turno', titulo: 'Turno', apelidos: [], largura: 10 },
  { campo: 'bloco', titulo: 'Bloco', apelidos: ['aula', 'horario_letra'], largura: 8 },
  { campo: 'inicio', titulo: 'Início', apelidos: ['hora_inicio', 'horario', 'hora'], largura: 8 },
  { campo: 'fim', titulo: 'Fim', apelidos: ['hora_fim', 'termino'], largura: 8 },
  { campo: 'disciplina', titulo: 'Disciplina', apelidos: ['componente', 'componente_curricular'], obrigatoria: true, largura: 40 },
  { campo: 'professor', titulo: 'Professor', apelidos: ['docente', 'professor_a', 'e_mail_do_professor', 'email_do_professor'], largura: 30 },
] as const;

export type CampoGrade = (typeof COLUNAS_GRADE)[number]['campo'];
export type RegistroGrade = Record<CampoGrade, string>;

export const NOME_TURNO: Record<Turno, string> = { MANHA: 'Manhã', TARDE: 'Tarde' };
export const LETRAS_BLOCO = 'ABCDEFGH';
export const OPCOES_GRADE: Partial<Record<CampoGrade, readonly string[]>> = {
  dia: OPCOES_DIA_PLANILHA,
  turno: Object.values(NOME_TURNO),
  bloco: ['A', 'B', 'C', 'D'],
};

export interface BlocoImportacao {
  id: string;
  turno: Turno;
  ordem: number;
  horaInicio: string;
}
export interface OfertaImportacao {
  id: string;
  turmaId: string;
  disciplina: string;
  codigo: string | null;
  professorId: string;
  professorNome: string;
  professorEmail: string;
}
export interface CelulaAtual {
  turmaId: string;
  diaSemana: number;
  blocoId: string;
  ofertaId: string | null;
}

export interface PlanoImportacaoGrade {
  linhas: LinhaResultado[];
  gravar: { turmaId: string; diaSemana: number; blocoId: string; ofertaId: string }[];
  remover: { turmaId: string; diaSemana: number; blocoId: string }[];
  temErros: boolean;
}

/** "7:30", "07h30", "7h", "07:30:00" → "07:30"; outro formato → null. */
export function lerHora(v: string): string | null {
  const m = /^(\d{1,2})\s*[:hH]\s*(\d{2})?(?::\d{2})?\s*$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
}

/** Bloco pela hora de início ou, sem ela, por turno + letra (A–D). */
export function lerBloco(valores: Pick<RegistroGrade, 'inicio' | 'turno' | 'bloco'>, blocos: readonly BlocoImportacao[]): BlocoImportacao | null | 'invalido' {
  if (valores.inicio.trim()) {
    const hora = lerHora(valores.inicio);
    return (hora && blocos.find((b) => b.horaInicio === hora)) || 'invalido';
  }
  const turno = normalizarCabecalho(valores.turno);
  const letra = valores.bloco.trim().toUpperCase();
  if (!turno && !letra) return null;
  const t: Turno | null = turno.startsWith('man') ? 'MANHA' : turno.startsWith('tar') ? 'TARDE' : null;
  const ordem = LETRAS_BLOCO.indexOf(letra) + 1 || Number(letra) || 0;
  return (t && blocos.find((b) => b.turno === t && b.ordem === ordem)) || 'invalido';
}

const norm = (v: string) => normalizarCabecalho(v);

/**
 * Compara a planilha com a grade cadastrada do semestre.
 * - `substituir`: as turmas presentes na planilha ficam exatamente como nela (horários ausentes são liberados);
 *   sem isso, só as células listadas mudam.
 * - Disciplina vazia libera o horário; linha sem dia e sem horário é ignorada (modelo com aulas a distribuir).
 * - Recusa choque de horário do professor entre turmas, considerando a planilha e o que já está cadastrado.
 */
export function planejarImportacaoGrade(params: {
  registros: { numero: number; valores: RegistroGrade }[];
  turmas: readonly { id: string; codigo: string }[];
  blocos: readonly BlocoImportacao[];
  ofertas: readonly OfertaImportacao[];
  atuais: readonly CelulaAtual[];
  substituir: boolean;
}): PlanoImportacaoGrade {
  const plano: PlanoImportacaoGrade = { linhas: [], gravar: [], remover: [], temErros: false };
  const erro = (numero: number, descricao: string, detalhe: string) => {
    plano.linhas.push({ numero, descricao, situacao: 'erro', detalhe });
    plano.temErros = true;
  };
  const turmaPorCodigo = new Map(params.turmas.map((t) => [norm(t.codigo), t]));
  const ofertaPorId = new Map(params.ofertas.map((o) => [o.id, o]));
  const chave = (turmaId: string, dia: number, blocoId: string) => `${turmaId}|${dia}|${blocoId}`;
  const atuais = new Map(params.atuais.map((c) => [chave(c.turmaId, c.diaSemana, c.blocoId), c.ofertaId]));

  // Estado final: começa pelo cadastrado; as turmas da planilha são zeradas no modo substituir.
  const final = new Map(atuais);
  const linhaDaCelula = new Map<string, number>();
  const turmasDaPlanilha = new Set<string>();
  const validas: { numero: number; descricao: string; k: string; ofertaId: string | null }[] = [];

  for (const { numero, valores } of params.registros) {
    const descricao = [valores.turma, valores.dia, valores.inicio || [valores.turno, valores.bloco].filter(Boolean).join(' '), valores.disciplina]
      .map((x) => x.trim())
      .filter(Boolean)
      .join(' · ') || '(linha vazia)';
    const turma = turmaPorCodigo.get(norm(valores.turma));
    if (!turma) {
      erro(numero, descricao, `Turma "${valores.turma.trim()}" não encontrada (use o código, ex.: REDES-1).`);
      continue;
    }
    turmasDaPlanilha.add(turma.id);
    const bloco = lerBloco(valores, params.blocos);
    if (!valores.dia.trim() && bloco === null) {
      plano.linhas.push({ numero, descricao, situacao: 'ignorar', detalhe: 'Sem dia e horário: linha ignorada.' });
      continue;
    }
    const dia = lerDiaSemana(valores.dia);
    const msgs: string[] = [];
    if (dia === null) msgs.push('Dia: use Segunda, Terça, Quarta, Quinta ou Sexta.');
    if (bloco === null || bloco === 'invalido') msgs.push(`Horário não reconhecido: informe o Início (${params.blocos.map((b) => b.horaInicio).join(', ')}) ou Turno e Bloco (A–D).`);
    let ofertaId: string | null = null;
    if (valores.disciplina.trim()) {
      const candidatas = params.ofertas.filter((o) => o.turmaId === turma.id && (norm(o.disciplina) === norm(valores.disciplina) || (o.codigo && norm(o.codigo) === norm(valores.disciplina))));
      const prof = norm(valores.professor);
      const oferta = candidatas.length > 1 && prof ? candidatas.find((o) => norm(o.professorNome) === prof || norm(o.professorEmail) === prof) : candidatas[0];
      if (!oferta) msgs.push(`"${valores.disciplina.trim()}" não tem oferta na turma ${turma.codigo} neste semestre (cadastre em Ofertas).`);
      else if (prof && norm(oferta.professorNome) !== prof && norm(oferta.professorEmail) !== prof) msgs.push(`Professor diferente da oferta: ${oferta.professorNome}. Corrija a planilha ou a oferta.`);
      else ofertaId = oferta.id;
    }
    if (msgs.length || dia === null || bloco === null || bloco === 'invalido') {
      erro(numero, descricao, msgs.join(' '));
      continue;
    }
    const k = chave(turma.id, dia, bloco.id);
    const repetida = linhaDaCelula.get(k);
    if (repetida) {
      erro(numero, descricao, `Mesmo horário da linha ${repetida}.`);
      continue;
    }
    linhaDaCelula.set(k, numero);
    validas.push({ numero, descricao, k, ofertaId });
  }

  if (params.substituir) for (const k of final.keys()) if (turmasDaPlanilha.has(k.split('|')[0])) final.set(k, null);
  for (const v of validas) final.set(v.k, v.ofertaId);

  // Choque de horário: o mesmo professor em duas turmas no mesmo dia e bloco.
  const porProfessor = new Map<string, string[]>();
  for (const [k, ofertaId] of final) {
    const o = ofertaId ? ofertaPorId.get(ofertaId) : undefined;
    if (!o) continue;
    const [, dia, blocoId] = k.split('|');
    const pk = `${o.professorId}|${dia}|${blocoId}`;
    porProfessor.set(pk, [...(porProfessor.get(pk) ?? []), k]);
  }
  const codigo = new Map(params.turmas.map((t) => [t.id, t.codigo]));
  const choques = new Map<string, string>();
  for (const ks of porProfessor.values()) {
    if (ks.length < 2) continue;
    for (const k of ks) {
      const outras = ks.filter((x) => x !== k).map((x) => codigo.get(x.split('|')[0]) ?? '?');
      choques.set(k, `Choque de horário: ${ofertaPorId.get(final.get(k)!)!.professorNome} também tem aula na turma ${outras.join(', ')} neste horário.`);
    }
  }

  for (const v of validas) {
    const choque = choques.get(v.k);
    if (choque) {
      erro(v.numero, v.descricao, choque);
      continue;
    }
    const atual = atuais.get(v.k);
    const situacao = v.ofertaId === null ? (atual ? 'atualizar' : 'igual') : atual === v.ofertaId ? 'igual' : atual ? 'atualizar' : 'criar';
    plano.linhas.push({ numero: v.numero, descricao: v.descricao, situacao, detalhe: v.ofertaId === null && atual ? 'Horário liberado.' : undefined });
  }
  plano.linhas.sort((a, b) => a.numero - b.numero);

  for (const [k, ofertaId] of final) {
    const [turmaId, dia, blocoId] = k.split('|');
    const atual = atuais.get(k);
    if (ofertaId && ofertaId !== atual) plano.gravar.push({ turmaId, diaSemana: Number(dia), blocoId, ofertaId });
    if (!ofertaId && atual) plano.remover.push({ turmaId, diaSemana: Number(dia), blocoId });
  }
  return plano;
}

/** Linha da planilha de uma célula (exportação e modelo). */
export function linhaDaGrade(c: { turma: string; diaSemana: number | null; bloco: { turno: Turno; ordem: number; horaInicio: string; horaFim: string } | null; disciplina: string; professor: string }): string[] {
  return [
    c.turma,
    c.diaSemana ? (NOME_DIA[c.diaSemana] ?? String(c.diaSemana)) : '',
    c.bloco ? NOME_TURNO[c.bloco.turno] : '',
    c.bloco ? (LETRAS_BLOCO[c.bloco.ordem - 1] ?? String(c.bloco.ordem)) : '',
    c.bloco?.horaInicio ?? '',
    c.bloco?.horaFim ?? '',
    c.disciplina,
    c.professor,
  ];
}

export const instrucoesGrade = (ano: number, semestre: number, horarios: string) => [
  'Grade horária — SGC-Redes',
  `Grade do ${semestre}º semestre de ${ano}. Uma linha por aula. Envie em Grade › Importar planilha; antes de gravar, o sistema mostra a prévia e confere choques de horário.`,
  'Turma: código (ex.: REDES-1). Dia: Segunda, Terça, Quarta, Quinta ou Sexta.',
  `Horário: preencha o Início (${horarios}) ou Turno (Manhã/Tarde) e Bloco (A, B, C, D). A coluna Fim é só informativa.`,
  'Disciplina: nome ou código, como cadastrado em Ofertas para a turma (anuais e técnicas do semestre). Vazia = libera o horário.',
  'Professor: opcional; se preenchido (nome ou e-mail), precisa ser o da oferta.',
  'Linhas sem dia e sem horário são ignoradas: o modelo de uma grade vazia traz uma linha por aula semanal prevista de cada disciplina, para você só preencher dia e horário.',
  'Modo "completar": só os horários da planilha mudam. Modo "substituir": as turmas presentes na planilha ficam exatamente como nela (os outros horários delas são liberados).',
];
