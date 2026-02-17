import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/auth') // allow backend auth proxy routes
  ) {
    return NextResponse.next();
  }

  // Require session cookie for all other routes
  const hasSession = req.cookies.get('ps_session');
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths except static files and API routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};

