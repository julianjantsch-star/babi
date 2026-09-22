import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { COOKIE_2FA } from '@/lib/auth/token';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();

  const resposta = NextResponse.redirect(new URL('/login', request.url), {
    status: 303,
  });
  // O cookie do dispositivo confiável sobrevive ao logout de propósito:
  // é ele que evita pedir o código a cada entrada no mesmo navegador.
  resposta.cookies.delete(COOKIE_2FA);
  return resposta;
}
