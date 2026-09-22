'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { enviarConvite } from '@/lib/email/resend';
import { revogarDispositivos } from '@/lib/auth/otp';
import type { EstadoForm } from './auth';

const esquema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome').max(120),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['ADMIN', 'FINANCEIRO', 'BALCAO']),
  telefone: z.string().max(30).optional(),
});

const ROTULO = { ADMIN: 'Administrador', FINANCEIRO: 'Financeiro', BALCAO: 'Balcão' };

export async function convidarUsuario(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  await exigirPerfil(['ADMIN']);

  const parsed = esquema.safeParse({
    nome: String(formData.get('nome') ?? ''),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    role: formData.get('role'),
    telefone: String(formData.get('telefone') ?? ''),
  });
  if (!parsed.success) return { erro: parsed.error.errors[0].message };

  const admin = createAdminClient();
  const destino = `${process.env.NEXT_PUBLIC_SITE_URL}/definir-senha`;

  // Cria o usuário já confirmado e gera o link de definição de senha.
  // O e-mail sai pelo Resend, e não pelo SMTP limitado do plano gratuito.
  const { data: criado, error: erroCriacao } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    email_confirm: true,
    user_metadata: { nome: parsed.data.nome, role: parsed.data.role },
  });

  if (erroCriacao) {
    if (/already/i.test(erroCriacao.message))
      return { erro: 'Já existe um usuário com este e-mail.' };
    return { erro: erroCriacao.message };
  }

  if (parsed.data.telefone && criado.user) {
    await admin.from('profiles')
      .update({ telefone: parsed.data.telefone }).eq('id', criado.user.id);
  }

  const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: parsed.data.email,
    options: { redirectTo: destino },
  });

  if (erroLink || !link?.properties?.action_link) {
    return {
      erro: 'Usuário criado, mas o link de acesso falhou. '
        + 'Use "Reenviar convite" na lista.',
    };
  }

  try {
    await enviarConvite(
      parsed.data.email, parsed.data.nome,
      link.properties.action_link, ROTULO[parsed.data.role],
    );
  } catch (e) {
    return {
      erro: `Usuário criado, mas o e-mail falhou: ${
        e instanceof Error ? e.message : 'erro desconhecido'}`,
    };
  }

  revalidatePath('/usuarios');
  return { ok: `Convite enviado para ${parsed.data.email}.` };
}

export async function reenviarConvite(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  await exigirPerfil(['ADMIN']);

  const email = String(formData.get('email') ?? '');
  const nome = String(formData.get('nome') ?? 'usuário');
  const role = String(formData.get('role') ?? 'BALCAO') as keyof typeof ROTULO;

  const admin = createAdminClient();
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/definir-senha` },
  });

  if (error || !link?.properties?.action_link) {
    return { erro: error?.message ?? 'Não foi possível gerar o link.' };
  }

  await enviarConvite(email, nome, link.properties.action_link, ROTULO[role]);
  return { ok: `Novo link enviado para ${email}.` };
}

export async function alterarPapel(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  const eu = await exigirPerfil(['ADMIN']);
  const id = String(formData.get('id') ?? '');
  const role = String(formData.get('role') ?? '');

  if (id === eu.id) return { erro: 'Você não pode alterar o próprio perfil.' };
  if (!['ADMIN', 'FINANCEIRO', 'BALCAO'].includes(role))
    return { erro: 'Perfil inválido.' };

  const supabase = createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  if (error) return { erro: error.message };

  // Papel novo, sessões antigas não devem sobreviver ao 2FA lembrado.
  await revogarDispositivos(id);

  revalidatePath('/usuarios');
  return { ok: 'Perfil atualizado.' };
}

export async function alternarAtivoUsuario(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  const eu = await exigirPerfil(['ADMIN']);
  const id = String(formData.get('id') ?? '');
  const ativo = formData.get('ativo') === 'true';

  if (id === eu.id) return { erro: 'Você não pode desativar a si mesmo.' };

  const supabase = createClient();
  const { error } = await supabase.from('profiles').update({ ativo: !ativo }).eq('id', id);
  if (error) return { erro: error.message };

  if (ativo) await revogarDispositivos(id);

  revalidatePath('/usuarios');
  return { ok: ativo ? 'Usuário desativado.' : 'Usuário reativado.' };
}
