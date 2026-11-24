'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { exigirUsuario } from '@/lib/auth/dal';
import { UsuarioSchema } from '@/lib/usuarios/regras';

export type EstadoContato = { mensagem?: string; sucesso?: boolean; erros?: { whatsapp?: string }; valores?: { whatsapp: string; usaWhatsapp: boolean } };

/**
 * A própria pessoa decide se o WhatsApp dela é usado no sistema. Desligado: as mensagens para ela só
 * oferecem e-mail, e ela não vê botões de WhatsApp. O e-mail institucional continua sendo o canal principal.
 */
export async function salvarContato(_estado: EstadoContato | undefined, formData: FormData): Promise<EstadoContato> {
  const { usuario } = await exigirUsuario();
  const bruto = String(formData.get('whatsapp') ?? '');
  const usaWhatsapp = formData.get('usaWhatsapp') === 'on';
  const valores = { whatsapp: bruto, usaWhatsapp };
  const lido = UsuarioSchema.shape.whatsapp.safeParse(bruto);
  if (!lido.success) return { erros: { whatsapp: lido.error.issues[0]?.message ?? 'Número inválido.' }, valores };
  const whatsapp = lido.data ?? null;
  const atual = await prisma.user.findUnique({ where: { id: usuario.id }, select: { whatsapp: true, usaWhatsapp: true } });
  await prisma.user.update({ where: { id: usuario.id }, data: { whatsapp, usaWhatsapp } });
  await registrarAuditoria({
    userId: usuario.id,
    acao: 'ALTEROU_PREFERENCIA_CONTATO',
    entidade: 'User',
    entidadeId: usuario.id,
    detalhes: { usaWhatsapp, numeroAlterado: (atual?.whatsapp ?? null) !== whatsapp },
  });
  revalidatePath('/', 'layout');
  return { sucesso: true, mensagem: usaWhatsapp ? 'Preferência salva: e-mail e WhatsApp.' : 'Preferência salva: só e-mail institucional.' };
}
