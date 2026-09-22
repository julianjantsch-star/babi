/**
 * Token HMAC curto usado para marcar "este navegador já passou pelo 2FA".
 * Implementado com Web Crypto para rodar também no middleware (edge).
 */

const enc = new TextEncoder();

async function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET não configurada');
  return crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify'],
  );
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Assina `<userId>.<expEpoch>` e devolve `payload.assinatura`. */
export async function assinarToken(userId: string, ttlSegundos: number) {
  const exp = Math.floor(Date.now() / 1000) + ttlSegundos;
  const payload = `${userId}.${exp}`;
  const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

/** Devolve o userId se o token for válido e não expirado, senão null. */
export async function verificarToken(token: string | undefined | null) {
  if (!token) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [userId, exp, sig] = partes;
  if (!userId || !/^\d+$/.test(exp)) return null;
  if (Number(exp) * 1000 < Date.now()) return null;

  const esperado = await crypto.subtle.sign(
    'HMAC', await key(), enc.encode(`${userId}.${exp}`),
  );
  // Comparação de tamanho fixo; strings b64url do mesmo HMAC têm mesmo tamanho.
  const a = b64url(esperado);
  if (a.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? userId : null;
}

export const COOKIE_2FA = 'odo_2fa';
export const COOKIE_DISPOSITIVO = 'odo_device';
