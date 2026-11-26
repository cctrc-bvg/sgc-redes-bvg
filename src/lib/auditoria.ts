import 'server-only';
import type { Prisma } from '@prisma/client';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { ipDeOrigem } from '@/lib/ip';

/** IP de origem, conforme o proxy reverso (ver `src/lib/ip.ts`). */
export async function ipDaRequisicao(): Promise<string | null> {
  const h = await headers();
  return ipDeOrigem(h.get('x-forwarded-for'), h.get('x-real-ip'), Number(process.env.PROXY_SALTOS ?? 1));
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
