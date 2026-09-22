'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { soDigitos, validaCNPJ } from '@/lib/utils';
import type { EstadoForm } from './auth';

const esquema = z.object({
  razao_social: z.string().trim().max(200).optional(),
  nome_fantasia: z.string().trim().max(200).optional(),
  cnpj: z.string().optional(),
  inscricao_municipal: z.string().trim().max(30).optional(),
  cod_municipio: z.string().trim().max(10).optional(),
  item_lista_servico: z.string().trim().max(10).optional(),
  cnae: z.string().trim().max(10).optional(),
  serie_rps: z.string().trim().max(5).optional(),
  ambiente_nfse: z.enum(['HOMOLOGACAO', 'PRODUCAO']),
  regime_tributario: z.string().trim().max(40).optional(),
});

export async function salvarConfiguracoes(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  await exigirPerfil(['ADMIN']);

  const bruto: Record<string, string> = {};
  for (const k of [
    'razao_social', 'nome_fantasia', 'cnpj', 'inscricao_municipal',
    'cod_municipio', 'item_lista_servico', 'cnae', 'serie_rps',
    'ambiente_nfse', 'regime_tributario',
  ]) {
    bruto[k] = String(formData.get(k) ?? '').trim();
  }

  const parsed = esquema.safeParse(bruto);
  if (!parsed.success) return { erro: parsed.error.errors[0].message };

  const cnpj = soDigitos(parsed.data.cnpj ?? '');
  if (cnpj && !validaCNPJ(cnpj)) return { erro: 'CNPJ inválido.' };

  // Alíquota chega como percentual (2,5) e é guardada como fração (0,025).
  const aliquotaBruta = String(formData.get('aliquota_iss') ?? '').replace(',', '.');
  const aliquota = aliquotaBruta ? Number(aliquotaBruta) / 100 : null;
  if (aliquota !== null && (!Number.isFinite(aliquota) || aliquota < 0 || aliquota > 1)) {
    return { erro: 'Alíquota de ISS inválida.' };
  }

  const supabase = createClient();
  const { error } = await supabase.from('configuracoes').update({
    ...parsed.data,
    cnpj: cnpj || null,
    aliquota_iss: aliquota,
    iss_retido: formData.get('iss_retido') === 'on',
    optante_simples: formData.get('optante_simples') === 'on',
  }).eq('id', true);

  if (error) return { erro: error.message };

  revalidatePath('/configuracoes');
  return { ok: 'Configurações salvas.' };
}
