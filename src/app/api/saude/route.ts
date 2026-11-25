import { prisma } from '@/lib/db';

/**
 * Verificação de saúde para o Docker (healthcheck), o script de atualização e o monitoramento: o app responde e
 * alcança o banco. Pública e sem dados: só "ok" ou "indisponível", sem detalhes do erro.
 */
export async function GET() {
  const semCache = { 'Cache-Control': 'no-store' };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok' }, { headers: semCache });
  } catch {
    return Response.json({ status: 'indisponivel' }, { status: 503, headers: semCache });
  }
}
