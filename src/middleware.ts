import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware volontairement minimal : il n'authentifie RIEN, il expose
 * seulement le chemin demandé sous forme d'en-tête.
 *
 * L'authentification reste dans le layout `(app)`, en Server Component : le
 * provider credentials dépend de bcrypt et du client Prisma, incompatibles avec
 * le runtime edge sur lequel s'exécute un middleware. Sans cet en-tête, la
 * garde ne saurait pas vers quelle page revenir après connexion, puisqu'un
 * layout n'a pas accès à l'URL courante.
 */
export const PATHNAME_HEADER = 'x-ceil-pathname';

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
