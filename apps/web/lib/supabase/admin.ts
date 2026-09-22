import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente com service_role: ignora RLS. Use apenas em Server Actions e
 * Route Handlers, para o que o usuário logado legitimamente não pode fazer
 * por si (gravar OTP, criar usuários, ler dispositivos confiáveis).
 * NUNCA importe isto de um componente cliente.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
