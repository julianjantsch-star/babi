'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { soDigitos, validaCPF, validaCNPJ } from '@/lib/utils';
import type { EstadoForm } from './auth';

const esquema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo').max(200),
  tipo_pessoa: z.enum(['PF', 'PJ']),
  documento: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  telefone: z.string().max(30).optional(),
  cep: z.string().optional(),
  logradouro: z.string().max(200).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(120).optional(),
  municipio: z.string().max(120).optional(),
  cod_municipio: z.string().max(10).optional(),
  uf: z.string().max(2).optional(),
  observacoes: z.string().max(1000).optional(),
});

function extrair(formData: FormData) {
  const obj: Record<string, string> = {};
  for (const chave of [
    'nome', 'tipo_pessoa', 'documento', 'email', 'telefone', 'cep', 'logradouro',
    'numero', 'complemento', 'bairro', 'municipio', 'cod_municipio', 'uf', 'observacoes',
  ]) {
    obj[chave] = String(formData.get(chave) ?? '').trim();
  }
  return obj;
}

export async function salvarCliente(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  await exigirPerfil();
  const bruto = extrair(formData);
  const id = String(formData.get('id') ?? '');

  const parsed = esquema.safeParse(bruto);
  if (!parsed.success) return { erro: parsed.error.errors[0].message };

  const doc = soDigitos(parsed.data.documento ?? '');
  if (doc) {
    const valido = parsed.data.tipo_pessoa === 'PF' ? validaCPF(doc) : validaCNPJ(doc);
    if (!valido) {
      return {
        erro: parsed.data.tipo_pessoa === 'PF'
          ? 'CPF inválido.' : 'CNPJ inválido.',
      };
    }
  }

  const registro = {
    ...parsed.data,
    documento: doc || null,
    email: parsed.data.email || null,
    uf: parsed.data.uf ? parsed.data.uf.toUpperCase() : null,
    cep: soDigitos(parsed.data.cep ?? '') || null,
  };

  const supabase = createClient();
  const { error } = id
    ? await supabase.from('clientes').update(registro).eq('id', id)
    : await supabase.from('clientes').insert(registro);

  if (error) {
    if (error.code === '23505') return { erro: 'Já existe um cliente com este documento.' };
    return { erro: error.message };
  }

  revalidatePath('/clientes');
  return { ok: id ? 'Cliente atualizado.' : 'Cliente cadastrado.' };
}

export async function alternarAtivoCliente(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  await exigirPerfil(['ADMIN', 'FINANCEIRO']);
  const id = String(formData.get('id') ?? '');
  const ativo = formData.get('ativo') === 'true';

  const supabase = createClient();
  const { error } = await supabase.from('clientes').update({ ativo: !ativo }).eq('id', id);
  if (error) return { erro: error.message };

  revalidatePath('/clientes');
  return { ok: ativo ? 'Cliente desativado.' : 'Cliente reativado.' };
}
