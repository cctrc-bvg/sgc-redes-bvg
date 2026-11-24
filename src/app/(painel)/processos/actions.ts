'use server';

import * as z from 'zod';
import type { ColunaKanban } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';
import { dataParaBanco } from '@/lib/ausencias/regras';
import { COLUNAS, filtroSigilo, ProcessoSchema } from '@/lib/processos/regras';

// Ids chegam por campo oculto, nunca por `acao.bind(null, id)` (ver usuarios/actions.ts).
// Auditoria guarda só ids, etapa e etiqueta: título e descrição podem citar estudantes.

const CAMPOS = ['titulo', 'tipo', 'coluna', 'numeroSei', 'prazo', 'descricao', 'sigiloso'] as const;

export type EstadoProcesso = {
  erros?: Partial<Record<(typeof CAMPOS)[number], string[]>>;
  mensagem?: string;
  sucesso?: boolean;
  valores?: Record<string, string>;
};

const ler = (formData: FormData) => Object.fromEntries(CAMPOS.map((c) => [c, String(formData.get(c) ?? '')])) as Record<(typeof CAMPOS)[number], string>;

const paraBanco = (d: z.infer<typeof ProcessoSchema>) => ({
  titulo: d.titulo,
  tipo: d.tipo,
  coluna: d.coluna,
  numeroSei: d.numeroSei ?? null,
  prazo: d.prazo ? dataParaBanco(d.prazo) : null,
  descricao: d.descricao ?? null,
  sigiloso: d.sigiloso,
});

export async function criarProcesso(_estado: EstadoProcesso | undefined, formData: FormData): Promise<EstadoProcesso> {
  const { usuario } = await exigirPermissao('kanban:gerenciar');
  const valores = ler(formData);
  const validacao = ProcessoSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };
  if (validacao.data.sigiloso && !temPermissao(usuario.role, 'kanban:ver-sigiloso')) {
    return { erros: { sigiloso: ['Só a Coordenação registra itens sigilosos.'] }, valores };
  }
  const criado = await prisma.processoKanban.create({ data: { ...paraBanco(validacao.data), criadoPorId: usuario.id } });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'CRIOU_PROCESSO',
    entidade: 'ProcessoKanban',
    entidadeId: criado.id,
    detalhes: { tipo: criado.tipo, coluna: criado.coluna, sigiloso: criado.sigiloso },
  });
  revalidatePath('/processos');
  redirect('/processos?aviso=criado');
}

/** Busca o processo respeitando o sigilo: sem permissão, um item sigiloso "não existe". */
async function buscarVisivel(id: string, role: Parameters<typeof temPermissao>[0]) {
  return prisma.processoKanban.findFirst({ where: { id, ...filtroSigilo(temPermissao(role, 'kanban:ver-sigiloso')) } });
}

export async function atualizarProcesso(_estado: EstadoProcesso | undefined, formData: FormData): Promise<EstadoProcesso> {
  const { usuario } = await exigirPermissao('kanban:gerenciar');
  const atual = await buscarVisivel(String(formData.get('processoId') ?? ''), usuario.role);
  if (!atual) return { mensagem: 'Processo não encontrado.' };
  const valores = ler(formData);
  const validacao = ProcessoSchema.safeParse(valores);
  if (!validacao.success) return { erros: z.flattenError(validacao.error).fieldErrors, valores };
  if (validacao.data.sigiloso && !temPermissao(usuario.role, 'kanban:ver-sigiloso')) {
    return { erros: { sigiloso: ['Só a Coordenação registra itens sigilosos.'] }, valores };
  }
  const dados = paraBanco(validacao.data);
  const alterados = (Object.keys(dados) as (keyof typeof dados)[]).filter((k) =>
    k === 'prazo' ? (dados.prazo?.getTime() ?? null) !== (atual.prazo?.getTime() ?? null) : dados[k] !== atual[k],
  );
  if (alterados.length === 0) return { sucesso: true, mensagem: 'Nenhuma alteração para salvar.', valores };
  await prisma.processoKanban.update({ where: { id: atual.id }, data: dados });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'EDITOU_PROCESSO',
    entidade: 'ProcessoKanban',
    entidadeId: atual.id,
    detalhes: { camposAlterados: alterados, coluna: dados.coluna, sigiloso: dados.sigiloso },
  });
  revalidatePath('/processos');
  return { sucesso: true, mensagem: 'Alterações salvas.', valores };
}

export type EstadoMovimento = { mensagem?: string };

/** Botões "← etapa anterior" / "próxima etapa →" do quadro (sem JavaScript). */
export async function moverProcesso(_estado: EstadoMovimento | undefined, formData: FormData): Promise<EstadoMovimento> {
  const { usuario } = await exigirPermissao('kanban:gerenciar');
  const atual = await buscarVisivel(String(formData.get('processoId') ?? ''), usuario.role);
  const destino = String(formData.get('coluna') ?? '') as ColunaKanban;
  if (!atual) return { mensagem: 'Processo não encontrado.' };
  if (!COLUNAS.includes(destino)) return { mensagem: 'Etapa inválida.' };
  if (destino === atual.coluna) return {};
  await prisma.processoKanban.update({ where: { id: atual.id }, data: { coluna: destino } });
  await registrarAuditoria({ userId: usuario.id, acao: 'MOVEU_PROCESSO', entidade: 'ProcessoKanban', entidadeId: atual.id, detalhes: { de: atual.coluna, para: destino } });
  revalidatePath('/processos');
  return {};
}

export async function excluirProcesso(_estado: EstadoMovimento | undefined, formData: FormData): Promise<EstadoMovimento> {
  const { usuario } = await exigirPermissao('kanban:gerenciar');
  if (formData.get('confirmo') !== 'on') return { mensagem: 'Marque a confirmação para excluir.' };
  const atual = await buscarVisivel(String(formData.get('processoId') ?? ''), usuario.role);
  if (!atual) return { mensagem: 'Processo não encontrado.' };
  await prisma.processoKanban.delete({ where: { id: atual.id } });
  await registrarAuditoria({ userId: usuario.id, acao: 'EXCLUIU_PROCESSO', entidade: 'ProcessoKanban', entidadeId: atual.id, detalhes: { tipo: atual.tipo } });
  revalidatePath('/processos');
  redirect('/processos?aviso=excluido');
}
