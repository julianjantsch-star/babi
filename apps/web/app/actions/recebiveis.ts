'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import type { EstadoForm } from './auth';

const esquemaRecebivel = z.object({
  cliente_id: z.string().uuid('Selecione o cliente'),
  origem: z.enum(['PF', 'PJ', 'CLINICA']),
  descricao: z.string().trim().min(3, 'Descreva o serviço').max(300),
  valor_total: z.number().positive('Valor deve ser maior que zero'),
  num_parcelas: z.number().int().min(1).max(120),
  primeiro_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  data_competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  observacoes: z.string().trim().max(1000).optional().or(z.literal('')),
});

/** Converte "1.234,56" ou "1234.56" em número. */
function paraNumero(valor: string) {
  const limpo = valor.trim().replace(/\s/g, '');
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;
  return Number(normalizado);
}

export async function criarRecebivel(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  const perfil = await exigirPerfil();

  const parsed = esquemaRecebivel.safeParse({
    cliente_id: formData.get('cliente_id'),
    origem: formData.get('origem'),
    descricao: String(formData.get('descricao') ?? ''),
    valor_total: paraNumero(String(formData.get('valor_total') ?? '')),
    num_parcelas: Number(formData.get('num_parcelas') ?? 1),
    primeiro_vencimento: String(formData.get('primeiro_vencimento') ?? ''),
    data_competencia: String(formData.get('data_competencia') ?? '') || undefined,
    observacoes: String(formData.get('observacoes') ?? ''),
  });

  if (!parsed.success) return { erro: parsed.error.errors[0].message };

  // O RLS já rejeitaria, mas aqui a mensagem é compreensível.
  if (perfil.role === 'BALCAO' && parsed.data.origem !== 'CLINICA') {
    return { erro: 'O perfil Balcão só pode lançar contas da origem Clínica.' };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc('criar_recebivel', {
    p_cliente_id: parsed.data.cliente_id,
    p_origem: parsed.data.origem,
    p_descricao: parsed.data.descricao,
    p_valor_total: parsed.data.valor_total,
    p_num_parcelas: parsed.data.num_parcelas,
    p_primeiro_vencimento: parsed.data.primeiro_vencimento,
    p_data_competencia: parsed.data.data_competencia ?? parsed.data.primeiro_vencimento,
    p_observacoes: parsed.data.observacoes || null,
  });

  if (error) return { erro: error.message };

  revalidatePath('/recebiveis');
  revalidatePath('/');
  return { ok: 'Conta a receber lançada com sucesso.' };
}

export async function quitarParcela(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  await exigirPerfil();

  const id = String(formData.get('parcela_id') ?? '');
  const dataPagamento = String(formData.get('data_pagamento') ?? '');
  const forma = String(formData.get('forma_pagamento') ?? '');

  if (!id) return { erro: 'Parcela não informada.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento))
    return { erro: 'Informe a data do pagamento.' };
  if (!forma) return { erro: 'Informe a forma de pagamento.' };

  const supabase = createClient();
  const { error } = await supabase.rpc('quitar_parcela', {
    p_parcela_id: id,
    p_data_pagamento: dataPagamento,
    p_forma: forma,
    p_observacoes: String(formData.get('observacoes') ?? '') || null,
  });

  if (error) return { erro: error.message };

  revalidatePath('/recebiveis');
  revalidatePath('/');
  return { ok: 'Parcela quitada.' };
}

export async function estornarParcela(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  // Estorno mexe em caixa já fechado: fica restrito ao financeiro.
  await exigirPerfil(['ADMIN', 'FINANCEIRO']);

  const supabase = createClient();
  const { error } = await supabase.rpc('estornar_parcela', {
    p_parcela_id: String(formData.get('parcela_id') ?? ''),
  });

  if (error) return { erro: error.message };

  revalidatePath('/recebiveis');
  revalidatePath('/');
  return { ok: 'Baixa estornada.' };
}

export async function cancelarRecebivel(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  await exigirPerfil(['ADMIN', 'FINANCEIRO']);
  const id = String(formData.get('recebivel_id') ?? '');
  const supabase = createClient();

  const { error } = await supabase
    .from('recebiveis').update({ cancelado: true }).eq('id', id);
  if (error) return { erro: error.message };

  // Parcelas já pagas continuam no caixa; só as abertas são canceladas.
  await supabase
    .from('parcelas')
    .update({ status: 'CANCELADA' })
    .eq('recebivel_id', id)
    .eq('status', 'PENDENTE');

  revalidatePath('/recebiveis');
  revalidatePath('/');
  return { ok: 'Conta cancelada.' };
}
