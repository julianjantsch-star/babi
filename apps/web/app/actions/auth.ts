'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  assinarToken, verificarToken, COOKIE_2FA, COOKIE_DISPOSITIVO,
} from '@/lib/auth/token';
import {
  gerarOtp, validarOtp, otpsRecentes, registrarDispositivo,
  dispositivoConfiavel, revogarDispositivos,
  OTP_VALIDADE_MIN, DISPOSITIVO_VALIDADE_DIAS,
} from '@/lib/auth/otp';
import { enviarCodigoOtp } from '@/lib/email/resend';

/** Sessão de 12h por navegador; depois disso o 2FA é pedido de novo. */
const SESSAO_2FA_SEGUNDOS = 12 * 60 * 60;
const MAX_OTP_POR_JANELA = 5;

export type EstadoForm = { erro?: string; ok?: string } | undefined;

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

async function marcarVerificado(userId: string) {
  cookies().set({
    ...cookieBase,
    name: COOKIE_2FA,
    value: await assinarToken(userId, SESSAO_2FA_SEGUNDOS),
    maxAge: SESSAO_2FA_SEGUNDOS,
  });
}

// ----------------------------- login ---------------------------------

const esquemaLogin = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
});

export async function entrar(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  const parsed = esquemaLogin.safeParse({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    senha: String(formData.get('senha') ?? ''),
  });
  if (!parsed.success) {
    return { erro: parsed.error.errors[0].message };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.senha,
  });

  // Mensagem genérica de propósito: não revela se o e-mail existe.
  if (error || !data.user) return { erro: 'E-mail ou senha incorretos.' };

  const { data: perfil } = await supabase
    .from('profiles').select('nome, ativo').eq('id', data.user.id).maybeSingle();

  if (!perfil?.ativo) {
    await supabase.auth.signOut();
    return { erro: 'Este acesso está desativado. Procure o administrador.' };
  }

  // Navegador já confiável: pula o código, mas mantém a sessão de 12h.
  const tokenDispositivo = cookies().get(COOKIE_DISPOSITIVO)?.value;
  if (await dispositivoConfiavel(data.user.id, tokenDispositivo)) {
    await marcarVerificado(data.user.id);
    redirect('/');
  }

  try {
    await dispararCodigo(data.user.id, data.user.email!, perfil.nome);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Falha ao enviar o código.' };
  }

  redirect('/verificar');
}

async function dispararCodigo(userId: string, email: string, nome: string) {
  if ((await otpsRecentes(userId)) >= MAX_OTP_POR_JANELA) {
    throw new Error('Muitas tentativas. Aguarde 15 minutos e tente de novo.');
  }
  const codigo = await gerarOtp(userId);
  await enviarCodigoOtp(email, nome, codigo, OTP_VALIDADE_MIN);
}

// --------------------------- verificação -----------------------------

export async function reenviarCodigo(): Promise<EstadoForm> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: perfil } = await supabase
    .from('profiles').select('nome').eq('id', user.id).maybeSingle();

  try {
    await dispararCodigo(user.id, user.email!, perfil?.nome ?? 'usuário');
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Falha ao reenviar.' };
  }
  return { ok: 'Enviamos um novo código para o seu e-mail.' };
}

export async function verificarCodigo(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  const codigo = String(formData.get('codigo') ?? '').replace(/\D/g, '');
  const lembrar = formData.get('lembrar') === 'on';

  if (codigo.length !== 6) return { erro: 'Digite os 6 dígitos do código.' };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const resultado = await validarOtp(user.id, codigo);
  if (!resultado.ok) return { erro: resultado.motivo };

  await marcarVerificado(user.id);

  if (lembrar) {
    const ua = headers().get('user-agent') ?? undefined;
    const { token } = await registrarDispositivo(user.id, ua);
    cookies().set({
      ...cookieBase,
      name: COOKIE_DISPOSITIVO,
      value: token,
      maxAge: DISPOSITIVO_VALIDADE_DIAS * 86_400,
    });
  }

  redirect('/');
}

export async function sair() {
  const supabase = createClient();
  await supabase.auth.signOut();
  cookies().delete(COOKIE_2FA);
  redirect('/login');
}

/** Desconecta todos os dispositivos lembrados do usuário logado. */
export async function esquecerDispositivos(): Promise<EstadoForm> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await revogarDispositivos(user.id);
  cookies().delete(COOKIE_DISPOSITIVO);
  return { ok: 'Todos os dispositivos lembrados foram removidos.' };
}

// ------------------------- definição de senha -------------------------

export async function definirSenha(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  const senha = String(formData.get('senha') ?? '');
  const confirmacao = String(formData.get('confirmacao') ?? '');

  if (senha.length < 8) return { erro: 'A senha precisa de ao menos 8 caracteres.' };
  if (senha !== confirmacao) return { erro: 'As senhas não conferem.' };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: 'Link expirado. Peça um novo convite ao administrador.' };

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: error.message };

  // Senha definida pelo próprio usuário via link do e-mail já comprova posse
  // da caixa postal, que é exatamente o que o segundo fator verifica.
  await marcarVerificado(user.id);
  redirect('/');
}

/** Usado pelo layout para saber se o 2FA desta sessão ainda vale. */
export async function sessaoVerificada(userId: string) {
  return (await verificarToken(cookies().get(COOKIE_2FA)?.value)) === userId;
}

/** Envia o e-mail de redefinição de senha (fluxo "esqueci minha senha"). */
export async function pedirResetSenha(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return { erro: 'Informe um e-mail válido.' };
  }

  const admin = createAdminClient();
  await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/definir-senha`,
  });

  // Resposta idêntica exista ou não a conta.
  return { ok: 'Se este e-mail estiver cadastrado, enviamos as instruções.' };
}
