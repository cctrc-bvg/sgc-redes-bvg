'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirPermissao } from '@/lib/auth/dal';
import { ModeloSchema } from '@/lib/comunicacao/modelos';
import { restaurarModelosIniciais } from '@/lib/comunicacao/servidor';

type Campo = 'tipo' | 'rotulo' | 'assunto' | 'texto' | 'destinos';
export type EstadoModelo = { mensagem?: string; sucesso?: boolean; erros?: Partial<Record<Campo, string>>; valores?: Record<string, string | string[]> };

function lerFormulario(formData: FormData) {
  const bruto = {
    tipo: String(formData.get('tipo') ?? ''),
    rotulo: String(formData.get('rotulo') ?? ''),
    assunto: String(formData.get('assunto') ?? ''),
    texto: String(formData.get('texto') ?? ''),
    destinos: [...new Set(formData.getAll('destinos').map(String))],
  };
  const r = ModeloSchema.safeParse(bruto);
  if (r.success) return { dados: r.data, valores: bruto } as const;
  const erros: EstadoModelo['erros'] = {};
  for (const i of r.error.issues) {
    const campo = i.path[0] as Campo;
    erros[campo] ??= i.message;
  }
  return { erros, valores: bruto } as const;
}

/** Novo texto-padrão. */
export async function criarModelo(_e: EstadoModelo | undefined, formData: FormData): Promise<EstadoModelo> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const lido = lerFormulario(formData);
  if ('erros' in lido) return { erros: lido.erros, valores: lido.valores };
  const ordem = (await prisma.modeloMensagem.aggregate({ _max: { ordem: true } }))._max.ordem ?? 0;
  const criado = await prisma.modeloMensagem.create({ data: { ...lido.dados, ordem: ordem + 1 } });
  await registrarAuditoria({ userId: usuario.id, acao: 'CRIOU_MODELO_MENSAGEM', entidade: 'ModeloMensagem', entidadeId: criado.id, detalhes: { tipo: criado.tipo } });
  revalidatePath('/comunicacao');
  redirect('/comunicacao/modelos?aviso=criado');
}

/** Edição de um texto-padrão. */
export async function atualizarModelo(_e: EstadoModelo | undefined, formData: FormData): Promise<EstadoModelo> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const id = String(formData.get('modeloId') ?? '');
  const atual = await prisma.modeloMensagem.findUnique({ where: { id }, select: { id: true } });
  if (!atual) return { mensagem: 'Texto-padrão não encontrado. Ele pode ter sido removido.' };
  const lido = lerFormulario(formData);
  if ('erros' in lido) return { erros: lido.erros, valores: lido.valores };
  await prisma.modeloMensagem.update({ where: { id }, data: lido.dados });
  await registrarAuditoria({ userId: usuario.id, acao: 'EDITOU_MODELO_MENSAGEM', entidade: 'ModeloMensagem', entidadeId: id, detalhes: { tipo: lido.dados.tipo } });
  revalidatePath('/comunicacao');
  return { sucesso: true, mensagem: 'Texto-padrão salvo.', valores: lido.valores };
}

export type EstadoRemocao = { mensagem?: string };

/** Remove um texto-padrão (o histórico de envios guarda o texto enviado, não o modelo). */
export async function removerModelo(_e: EstadoRemocao | undefined, formData: FormData): Promise<EstadoRemocao> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const id = String(formData.get('modeloId') ?? '');
  if (formData.get('confirmo') !== 'on') return { mensagem: 'Marque a confirmação para remover.' };
  const atual = await prisma.modeloMensagem.findUnique({ where: { id }, select: { id: true, tipo: true } });
  if (!atual) return { mensagem: 'Texto-padrão não encontrado.' };
  await prisma.modeloMensagem.delete({ where: { id } });
  await registrarAuditoria({ userId: usuario.id, acao: 'REMOVEU_MODELO_MENSAGEM', entidade: 'ModeloMensagem', entidadeId: id, detalhes: { tipo: atual.tipo } });
  revalidatePath('/comunicacao');
  redirect('/comunicacao/modelos?aviso=removido');
}

/** Repõe os textos-padrão originais que foram removidos. */
export async function restaurarModelos(): Promise<void> {
  const { usuario } = await exigirPermissao('comunicacao:enviar');
  const n = await restaurarModelosIniciais();
  if (n > 0) await registrarAuditoria({ userId: usuario.id, acao: 'RESTAUROU_MODELOS_MENSAGEM', entidade: 'ModeloMensagem', entidadeId: '-', detalhes: { quantidade: n } });
  revalidatePath('/comunicacao');
  redirect(`/comunicacao/modelos?aviso=restaurados-${n}`);
}
