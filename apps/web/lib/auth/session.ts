import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppRole, Profile } from '@/lib/types';

/** Perfil do usuário logado, ou null. */
export async function perfilAtual(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return (data as Profile) ?? null;
}

/**
 * Exige sessão e, opcionalmente, um dos papéis informados.
 * O RLS já barra no banco — isto existe para dar uma resposta decente na UI
 * em vez de uma lista vazia.
 */
export async function exigirPerfil(papeis?: AppRole[]): Promise<Profile> {
  const perfil = await perfilAtual();
  if (!perfil) redirect('/login');
  if (!perfil.ativo) redirect('/login?erro=inativo');
  if (papeis && !papeis.includes(perfil.role)) redirect('/?erro=sem-permissao');
  return perfil;
}

export const podeVerFinanceiroCompleto = (r: AppRole) =>
  r === 'ADMIN' || r === 'FINANCEIRO';

export const podeEmitirNota = (r: AppRole) => r === 'ADMIN';

export const podeGerenciarUsuarios = (r: AppRole) => r === 'ADMIN';
