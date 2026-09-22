import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { COOKIE_2FA, verificarToken } from '@/lib/auth/token';

const PUBLICAS = ['/login', '/verificar', '/definir-senha', '/auth/callback'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  // Revalida o token do Supabase e renova os cookies na resposta.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const publica = PUBLICAS.some((p) => pathname.startsWith(p));

  if (!user) {
    if (publica) return response;
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('proximo', pathname);
    return NextResponse.redirect(url);
  }

  // Autenticado: falta confirmar o segundo fator deste navegador.
  const doisFatoresOk =
    (await verificarToken(request.cookies.get(COOKIE_2FA)?.value)) === user.id;

  if (!doisFatoresOk && !pathname.startsWith('/verificar')
      && !pathname.startsWith('/definir-senha')) {
    const url = request.nextUrl.clone();
    url.pathname = '/verificar';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (doisFatoresOk && (pathname === '/login' || pathname === '/verificar')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)'],
};
