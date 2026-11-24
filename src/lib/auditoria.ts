import 'server-only';
import type { Prisma } from '@prisma/client';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

/** IP de origem (primeiro da cadeia X-Forwarded-For, preenchida pelo proxy reverso do campus). */
export async function ipDaRequisicao(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
}

/** Registro de auditoria (ARQUITETURA_LGPD.md, item 4). Nunca inclua senhas ou dados sensíveis em `detalhes`. */
export async function registrarAuditoria(evento: {
  userId: string | null;
  acao: string;
  entidade: string;
  entidadeId: string;
  detalhes?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: { ...evento, ipAddress: await ipDaRequisicao() },
  });
}
