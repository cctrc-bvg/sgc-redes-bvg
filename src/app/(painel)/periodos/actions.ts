'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as z from 'zod';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { dataDoBanco, dataParaBanco, periodoDaData } from '@/lib/ausencias/regras';
import { lerModoEnvio, NOME_MODO } from '@/lib/comunicacao/mensagem';
import { mensagemPlanoAlimentar, PeriodoSchema, validarPresentes } from '@/lib/periodos/regras';
import { carregarPeriodo } from '@/lib/periodos/servidor';
import { mensagemAvulsa } from '@/lib/comunicacao/servidor';

export type EstadoPeriodo = { mensagem?: string; sucesso?: boolean; erros?: Partial<Record<'nome' | 'tipo' | 'inicio' | 'fim' | 'observacao', string[]>>; valores?: Record<string, string> };

const lerPeriodo = (f: FormData) => ({
  nome: String(f.get('nome') ?? ''),
  tipo: String(f.get('tipo') ?? ''),
  inicio: String(f.get('inicio') ?? ''),
  fim: String(f.get('fim') ?? ''),
  observacao: String(f.get('observacao') ?? ''),
});

export async function criarPeriodo(_e: EstadoPeriodo | undefined, formData: FormData): Promise<EstadoPeriodo> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const valores = lerPeriodo(formData);
  const r = PeriodoSchema.safeParse(valores);
  if (!r.success) return { erros: z.flattenError(r.error).fieldErrors, valores };
  const criado = await prisma.periodoEspecial.create({
    data: { nome: r.data.nome, tipo: r.data.tipo, inicio: dataParaBanco(r.data.inicio), fim: dataParaBanco(r.data.fim), observacao: r.data.observacao ?? null },
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'CRIOU_PERIODO_ESPECIAL', entidade: 'PeriodoEspecial', entidadeId: criado.id, detalhes: { tipo: r.data.tipo, inicio: r.data.inicio, fim: r.data.fim } });
  revalidatePath('/periodos');
  redirect(`/periodos/${criado.id}`);
}

export async function excluirPeriodo(formData: FormData): Promise<void> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const id = String(formData.get('periodoId') ?? '');
  const p = await prisma.periodoEspecial.findUnique({ where: { id }, select: { id: true } });
  if (!p) return;
  await prisma.periodoEspecial.delete({ where: { id } }); // grades e presenças saem em cascata
  await registrarAuditoria({ userId: usuario.id, acao: 'EXCLUIU_PERIODO_ESPECIAL', entidade: 'PeriodoEspecial', entidadeId: id });
  revalidatePath('/periodos');
  redirect('/periodos');
}

/** Copia a grade normal da turma (semestre da data inicial) como ponto de partida da grade especial. */
export async function copiarGradeNormal(formData: FormData): Promise<void> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const periodoId = String(formData.get('periodoId') ?? '');
  const turmaId = String(formData.get('turmaId') ?? '');
  const p = await prisma.periodoEspecial.findUnique({ where: { id: periodoId } });
  if (!p) return;
  const { anoLetivo, semestreLetivo } = periodoDaData(dataDoBanco(p.inicio));
  const normais = await prisma.gradeHorario.findMany({ where: { turmaId, anoLetivo, semestreLetivo } });
  await prisma.$transaction([
    prisma.gradeEspecial.deleteMany({ where: { periodoId, turmaId } }),
    prisma.gradeEspecial.createMany({ data: normais.map((c) => ({ periodoId, turmaId, diaSemana: c.diaSemana, blocoId: c.blocoId, ofertaId: c.ofertaId, sala: c.sala })) }),
  ]);
  await registrarAuditoria({ userId: usuario.id, acao: 'COPIOU_GRADE_ESPECIAL', entidade: 'PeriodoEspecial', entidadeId: periodoId, detalhes: { turmaId, celulas: normais.length } });
  revalidatePath(`/periodos/${periodoId}`);
}

/** Volta a turma para a grade normal nos dias do período. */
export async function removerGradeEspecial(formData: FormData): Promise<void> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const periodoId = String(formData.get('periodoId') ?? '');
  const turmaId = String(formData.get('turmaId') ?? '');
  await prisma.gradeEspecial.deleteMany({ where: { periodoId, turmaId } });
  await registrarAuditoria({ userId: usuario.id, acao: 'REMOVEU_GRADE_ESPECIAL', entidade: 'PeriodoEspecial', entidadeId: periodoId, detalhes: { turmaId } });
  revalidatePath(`/periodos/${periodoId}`);
}

export type EstadoGrade = { mensagem?: string; sucesso?: boolean };

/** Grava a grade especial da turma: campos `celula:<dia>:<blocoId>` = id da oferta ou vazio (janela). */
export async function salvarGradeEspecial(_e: EstadoGrade | undefined, formData: FormData): Promise<EstadoGrade> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const periodoId = String(formData.get('periodoId') ?? '');
  const turmaId = String(formData.get('turmaId') ?? '');
  const p = await prisma.periodoEspecial.findUnique({ where: { id: periodoId } });
  if (!p) return { mensagem: 'Período não encontrado.' };
  const { anoLetivo, semestreLetivo } = periodoDaData(dataDoBanco(p.inicio));
  const [blocos, ofertas] = await Promise.all([
    prisma.blocoHorario.findMany({ select: { id: true } }),
    prisma.disciplinaOferta.findMany({ where: { turmaId, anoLetivo, OR: [{ semestreLetivo: null }, { semestreLetivo }] }, select: { id: true, professorId: true } }),
  ]);
  const blocosValidos = new Set(blocos.map((b) => b.id));
  const ofertasValidas = new Map(ofertas.map((o) => [o.id, o.professorId]));
  const celulas: { diaSemana: number; blocoId: string; ofertaId: string | null }[] = [];
  for (const [chave, valor] of formData.entries()) {
    const m = /^celula:([1-5]):(.+)$/.exec(chave);
    if (!m || !blocosValidos.has(m[2]!)) continue;
    const ofertaId = String(valor);
    if (ofertaId && !ofertasValidas.has(ofertaId)) return { mensagem: 'Há uma disciplina que não pertence a esta turma. Recarregue a página.' };
    celulas.push({ diaSemana: Number(m[1]), blocoId: m[2]!, ofertaId: ofertaId || null });
  }
  // Um professor não pode estar em duas turmas no mesmo horário (a Coordenação decide, mas avisamos antes de gravar).
  const outras = await prisma.gradeEspecial.findMany({ where: { periodoId, turmaId: { not: turmaId }, ofertaId: { not: null } }, select: { diaSemana: true, blocoId: true, oferta: { select: { professorId: true } } } });
  const ocupados = new Set(outras.map((o) => `${o.oferta!.professorId}|${o.diaSemana}|${o.blocoId}`));
  const conflito = celulas.find((c) => c.ofertaId && ocupados.has(`${ofertasValidas.get(c.ofertaId)}|${c.diaSemana}|${c.blocoId}`));
  if (conflito) return { mensagem: 'Um professor já está em outra turma no mesmo horário da grade especial. Ajuste o horário e salve de novo.' };
  await prisma.$transaction([
    prisma.gradeEspecial.deleteMany({ where: { periodoId, turmaId } }),
    prisma.gradeEspecial.createMany({ data: celulas.map((c) => ({ periodoId, turmaId, ...c })) }),
  ]);
  await registrarAuditoria({ userId: usuario.id, acao: 'EDITOU_GRADE_ESPECIAL', entidade: 'PeriodoEspecial', entidadeId: periodoId, detalhes: { turmaId, celulas: celulas.filter((c) => c.ofertaId).length } });
  revalidatePath(`/periodos/${periodoId}`);
  return { sucesso: true, mensagem: 'Grade especial salva.' };
}

/** Grava os estudantes presentes por turma e dia: campos `presenca:<turmaId>:<data>`; vazio = todos os ativos. */
export async function salvarPresencas(_e: EstadoGrade | undefined, formData: FormData): Promise<EstadoGrade> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const periodoId = String(formData.get('periodoId') ?? '');
  const p = await prisma.periodoEspecial.findUnique({ where: { id: periodoId } });
  if (!p) return { mensagem: 'Período não encontrado.' };
  const turmas = new Map((await prisma.turma.findMany({ where: { ativa: true }, select: { id: true, codigo: true, qtdAlunosAtivos: true } })).map((t) => [t.id, t]));
  const inicio = dataDoBanco(p.inicio);
  const fim = dataDoBanco(p.fim);
  const linhas: { turmaId: string; data: string; qtdAlunos: number }[] = [];
  for (const [chave, valor] of formData.entries()) {
    const m = /^presenca:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(chave);
    if (!m) continue;
    const turma = turmas.get(m[1]!);
    const texto = String(valor).trim();
    if (!turma || m[2]! < inicio || m[2]! > fim || texto === '') continue;
    const v = validarPresentes(texto, turma.qtdAlunosAtivos);
    if ('erro' in v) return { mensagem: `${turma.codigo}, ${m[2]!.split('-').reverse().join('/')}: ${v.erro}` };
    linhas.push({ turmaId: turma.id, data: m[2]!, qtdAlunos: v.valor });
  }
  await prisma.$transaction([
    prisma.presencaEspecial.deleteMany({ where: { periodoId } }),
    prisma.presencaEspecial.createMany({ data: linhas.map((l) => ({ periodoId, turmaId: l.turmaId, data: dataParaBanco(l.data), qtdAlunos: l.qtdAlunos })) }),
  ]);
  await registrarAuditoria({ userId: usuario.id, acao: 'DEFINIU_PRESENCAS_PERIODO', entidade: 'PeriodoEspecial', entidadeId: periodoId, detalhes: { registros: linhas.length } });
  revalidatePath(`/periodos/${periodoId}`);
  return { sucesso: true, mensagem: 'Estudantes presentes salvos.' };
}

export type EstadoEnvioPeriodo = { mensagem?: string; sucesso?: boolean };

/** Registra o envio do resumo alimentar ao setor (CAE ou nutricionista); o texto é regenerado no servidor. */
export async function registrarResumoAlimentar(_e: EstadoEnvioPeriodo | undefined, formData: FormData): Promise<EstadoEnvioPeriodo> {
  const { usuario } = await exigirPermissao('calendario:gerenciar');
  const periodoId = String(formData.get('periodoId') ?? '');
  const canal = String(formData.get('canal') ?? '');
  const modo = lerModoEnvio(formData.get('modo'));
  if (!modo) return { mensagem: 'Escolha por onde o resumo foi enviado.' };
  if (canal !== 'ASSISTENCIA_ESTUDANTIL' && canal !== 'NUTRICIONISTA') return { mensagem: 'Destino inválido.' };
  const dados = await carregarPeriodo(periodoId);
  if (!dados) return { mensagem: 'Período não encontrado.' };
  const texto = mensagemPlanoAlimentar({ nome: dados.periodo.nome, inicio: dados.periodo.inicio, fim: dados.periodo.fim, plano: dados.plano });
  const m = await mensagemAvulsa(`canal:${canal}`, `[SGC-Redes] Refeições — ${dados.periodo.nome}`, texto);
  if (!m) return { mensagem: 'O contato deste setor não está ativo em Comunicação.' };
  await prisma.logComunicacao.create({
    data: { canal: m.canal, destino: m.destino, chave: `periodo:${periodoId}:${canal}`, assunto: m.assunto, mensagem: m.texto, modoEnvio: modo, sucesso: true, userId: usuario.id },
  });
  await registrarAuditoria({ userId: usuario.id, acao: 'REGISTROU_ENVIO_MENSAGEM', entidade: 'PeriodoEspecial', entidadeId: periodoId, detalhes: { origem: 'resumo_periodo', canal, modo } });
  revalidatePath(`/periodos/${periodoId}`);
  revalidatePath('/comunicacao');
  return { sucesso: true, mensagem: `Envio registrado (${NOME_MODO[modo].toLowerCase()}).` };
}
