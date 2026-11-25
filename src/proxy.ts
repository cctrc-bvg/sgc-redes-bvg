import { NextResponse, type NextRequest } from 'next/server';

/**
 * Checagem otimista: sem cookie de sessão, qualquer página (exceto /login) vai para o login.
 * Não consulta o banco — a validação real da sessão acontece no DAL (src/lib/auth/dal.ts).
 */
const COOKIE_SESSAO = 'sgc_sessao'; // mesmo nome de src/lib/auth/sessao.ts
// /api/saude: healthcheck do Docker e do monitoramento (não expõe dados).
const ROTAS_PUBLICAS = ['/login', '/api/saude'];

export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (ROTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return NextResponse.next();
  }
  if (!req.cookies.has(COOKIE_SESSAO)) {
    const url = new URL('/login', req.nextUrl);
    if (pathname !== '/' && pathname !== '/painel') url.searchParams.set('proximo', pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Não intercepta arquivos estáticos nem imagens otimizadas.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)'],
};
