import { prisma } from '@/lib/db';
import { obterSessao } from '@/lib/auth/dal';
import { temPermissao } from '@/lib/auth/rbac';

/**
 * Baixa o formulário de reposição anexado. Pode conter assinaturas de estudantes: só a Coordenação e o docente da
 * ausência baixam. Sempre como download, nunca exibido na página (nosniff e CSP já protegem; aqui reforçamos).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessao();
  if (!sessao || sessao.usuario.deveTrocarSenha) return new Response('Não autenticado.', { status: 401 });
  const { id } = await params;
  const anexo = await prisma.anexoReposicao.findUnique({
    where: { id },
    select: { nome: true, tipoMime: true, conteudo: true, ausencia: { select: { professorAusenteId: true } } },
  });
  const permitido =
    anexo && (temPermissao(sessao.usuario, 'ausencias:registrar') || (temPermissao(sessao.usuario, 'ausencias:informar') && anexo.ausencia.professorAusenteId === sessao.usuario.id));
  if (!anexo || !permitido) return new Response('Arquivo não encontrado.', { status: 404 });
  return new Response(new Uint8Array(anexo.conteudo), {
    headers: {
      'Content-Type': anexo.tipoMime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(anexo.nome)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
