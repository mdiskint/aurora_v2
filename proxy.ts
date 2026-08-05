import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Explicit public-route allowlist.
 *
 * Everything NOT listed here is protected and requires a valid NextAuth
 * session (JWT). The legacy `aurora-auth` password cookie is intentionally
 * absent: it no longer grants access to any route.
 *
 * Public routes are limited to auth plumbing, the join/beta-signup flow,
 * static assets, and health checks so OAuth callbacks and onboarding are not
 * locked out.
 */
const PUBLIC_PREFIXES = [
  // NextAuth sign-in page and its assets
  '/auth/signin',
  // Public join / beta signup page
  '/join',
  // NextAuth API (login, callback, session, providers, csrf)
  '/api/auth',
  // Public beta signup API
  '/api/beta-signup',
  // Health check
  '/api/health',
] as const;

// Static assets (matched defensively; the matcher already excludes common ones)
const PUBLIC_FILE_RE = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|txt)$/i;

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_FILE_RE.test(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Authenticated users pass through. Uses the same JWT session token that
  // NextAuth issues (session strategy: "jwt").
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (token) {
    return NextResponse.next();
  }

  // Anonymous API callers are rejected with 401; anonymous pages are
  // redirected to the sign-in page.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/auth/signin';
  url.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and image optimization.
     * The public-route allowlist above still lets matching paths through.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};