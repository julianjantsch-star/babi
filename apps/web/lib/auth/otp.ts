import 'server-only';
import { createHash, randomInt, randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const OTP_VALIDADE_MIN = 10;
export const OTP_MAX_TENTATIVAS = 5;
export const DISPOSITIVO_VALIDADE_DIAS = 30;

const pepper = () => process.env.AUTH_SECRET ?? '';

const hash = (valor: string) =>
  createHash('sha256').update(`${valor}${pepper()}`).digest('hex');

/** Gera um código de 6 dígitos e grava só o hash. Devolve o código em claro. */
export async function gerarOtp(userId: string) {
  const admin = createAdminClient();
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');

  // Invalida códigos anteriores ainda abertos: só o mais recente vale.
  await admin
    .from('auth_otp')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('consumed_at', null);

  const { error } = await admin.from('auth_otp').insert({
    user_id: userId,
    code_hash: hash(codigo),
    expires_at: new Date(Date.now() + OTP_VALIDADE_MIN * 60_000).toISOString(),
  });
  if (error) throw new Error(`Falha ao gerar código: ${error.message}`);

  return codigo;
}

type Resultado = { ok: true } | { ok: false; motivo: string };

export async function validarOtp(userId: string, codigo: string): Promise<Resultado> {
  const admin = createAdminClient();
  const { data: registro } = await admin
    .from('auth_otp')
    .select('*')
    .eq('user_id', userId)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!registro) return { ok: false, motivo: 'Nenhum código pendente. Solicite um novo.' };
  if (new Date(registro.expires_at) < new Date())
    return { ok: false, motivo: 'Código expirado. Solicite um novo.' };
  if (registro.attempts >= OTP_MAX_TENTATIVAS) {
    await admin.from('auth_otp')
      .update({ consumed_at: new Date().toISOString() }).eq('id', registro.id);
    return { ok: false, motivo: 'Tentativas esgotadas. Solicite um novo código.' };
  }

  if (registro.code_hash !== hash(codigo.trim())) {
    await admin.from('auth_otp')
      .update({ attempts: registro.attempts + 1 }).eq('id', registro.id);
    const restantes = OTP_MAX_TENTATIVAS - registro.attempts - 1;
    return {
      ok: false,
      motivo: `Código incorreto. ${restantes} tentativa(s) restante(s).`,
    };
  }

  await admin.from('auth_otp')
    .update({ consumed_at: new Date().toISOString() }).eq('id', registro.id);
  return { ok: true };
}

/** Quantos códigos foram pedidos nos últimos 15 minutos (anti-abuso). */
export async function otpsRecentes(userId: string) {
  const admin = createAdminClient();
  const desde = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await admin
    .from('auth_otp')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', desde);
  return count ?? 0;
}

// --------------------------- dispositivos ----------------------------

export async function registrarDispositivo(userId: string, userAgent?: string) {
  const admin = createAdminClient();
  const token = randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + DISPOSITIVO_VALIDADE_DIAS * 86_400_000);

  const { error } = await admin.from('trusted_devices').insert({
    user_id: userId,
    token_hash: hash(token),
    user_agent: userAgent?.slice(0, 300) ?? null,
    expires_at: expira.toISOString(),
  });
  if (error) throw new Error(error.message);

  return { token, expira };
}

export async function dispositivoConfiavel(userId: string, token?: string) {
  if (!token) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from('trusted_devices')
    .select('id, expires_at')
    .eq('user_id', userId)
    .eq('token_hash', hash(token))
    .maybeSingle();

  if (!data || new Date(data.expires_at) < new Date()) return false;
  await admin.from('trusted_devices')
    .update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  return true;
}

export async function revogarDispositivos(userId: string) {
  const admin = createAdminClient();
  await admin.from('trusted_devices').delete().eq('user_id', userId);
}
