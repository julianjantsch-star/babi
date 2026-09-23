'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { soDigitos, validaCPF, validaCNPJ } from '@/lib/utils';
import { montarCampos, preencherModelo, type DadosParte } from '@/lib/contratos/campos';
import type { EstadoForm } from './auth';

/** Converte "1.234,56" ou "1234.56" em número. */
function paraNumero(valor: string) {
  const limpo = valor.trim().replace(/\s/g, '');
  return Number(limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo);
}

const esquema = z.object({
  cliente_id: z.string().uuid('Selecione o cliente'),
  emitente_id: z.string().uuid('Selecione quem presta o serviço'),
  modelo: z.enum(['ORTODONTICO', 'ALINHADOR']),
  paciente_nome: z.string().trim().max(200).optional(),
  valor_total: z.number().positive('Informe um valor maior que zero'),
  a_vista: z.boolean(),
  num_parcelas: z.number().int().min(1).max(120),
  primeiro_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  data_contrato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  cidade: z.string().trim().min(2).max(80),
  observacoes: z.string().trim().max(1000).optional(),
});

/** Mapeia a linha do banco para o formato que o preenchedor espera. */
const parteDoCliente = (c: Record<string, unknown>): DadosParte => ({
  nome: String(c.nome ?? ''),
  documento: (c.documento as string) ?? null,
  tipoPessoa: (c.tipo_pessoa as 'PF' | 'PJ') ?? 'PF',
  telefone: (c.telefone as string) ?? null,
  email: (c.email as string) ?? null,
  cep: (c.cep as string) ?? null,
  logradouro: (c.logradouro as string) ?? null,
  numero: (c.numero as string) ?? null,
  complemento: (c.complemento as string) ?? null,
  bairro: (c.bairro as string) ?? null,
  municipio: (c.municipio as string) ?? null,
  uf: (c.uf as string) ?? null,
});

const parteDoEmitente = (e: Record<string, unknown>): DadosParte => ({
  ...parteDoCliente(e),
  qualificacao: (e.qualificacao as string) ?? null,
  rg: (e.rg as string) ?? null,
  cro: (e.cro as string) ?? null,
  representante: (e.representante as string) ?? null,
  representanteDoc: (e.representante_doc as string) ?? null,
});

/**
 * EstadoForm já carrega o `undefined` do estado inicial, então intersectar
 * com ele produziria um tipo que o useFormState recusa. Declarado à parte.
 */
export type EstadoContrato =
  | { erro?: string; ok?: string; contratoId?: string }
  | undefined;

export async function emitirContrato(
  _estado: EstadoContrato, formData: FormData,
): Promise<EstadoContrato> {
  await exigirPerfil(['ADMIN', 'FINANCEIRO']);

  const aVista = formData.get('a_vista') === 'true';
  const parsed = esquema.safeParse({
    cliente_id: formData.get('cliente_id'),
    emitente_id: formData.get('emitente_id'),
    modelo: formData.get('modelo'),
    paciente_nome: String(formData.get('paciente_nome') ?? ''),
    valor_total: paraNumero(String(formData.get('valor_total') ?? '')),
    a_vista: aVista,
    num_parcelas: aVista ? 1 : Number(formData.get('num_parcelas') ?? 1),
    primeiro_vencimento: String(formData.get('primeiro_vencimento') ?? ''),
    data_contrato: String(formData.get('data_contrato') ?? ''),
    cidade: String(formData.get('cidade') ?? 'Blumenau'),
    observacoes: String(formData.get('observacoes') ?? ''),
  });

  if (!parsed.success) return { erro: parsed.error.errors[0].message };
  const d = parsed.data;

  const supabase = createClient();

  const [{ data: cliente }, { data: emitente }, { data: modelo }] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', d.cliente_id).maybeSingle(),
    supabase.from('emitentes').select('*').eq('id', d.emitente_id).maybeSingle(),
    supabase.from('modelos_contrato').select('*').eq('chave', d.modelo).maybeSingle(),
  ]);

  if (!cliente) return { erro: 'Cliente não encontrado.' };
  if (!emitente) return { erro: 'Emitente não encontrado.' };
  if (!modelo) return { erro: `Modelo ${d.modelo} não cadastrado.` };
  if (!modelo.ativo) return { erro: `O modelo ${modelo.titulo} está desativado.` };

  const campos = montarCampos({
    contratado: parteDoEmitente(emitente),
    contratante: parteDoCliente(cliente),
    pacienteNome: d.paciente_nome || null,
    valorTotal: d.valor_total,
    aVista: d.a_vista,
    numParcelas: d.num_parcelas,
    primeiroVencimento: d.primeiro_vencimento,
    dataContrato: d.data_contrato,
    cidade: d.cidade,
  });

  const { texto, desconhecidos } = preencherModelo(modelo.corpo, campos);

  // Marcador que o sistema não sabe preencher ficaria visível no contrato
  // assinado. Melhor barrar aqui do que descobrir na frente do paciente.
  if (desconhecidos.length) {
    return {
      erro: `O modelo usa campos que o sistema não conhece: `
        + `${desconhecidos.map((c) => `{{${c}}}`).join(', ')}. `
        + 'Corrija o modelo em Contratos → Modelos.',
    };
  }

  const { data: contrato, error } = await supabase
    .rpc('emitir_contrato', {
      p_cliente_id: d.cliente_id,
      p_emitente_id: d.emitente_id,
      p_modelo_chave: d.modelo,
      p_valor_total: d.valor_total,
      p_a_vista: d.a_vista,
      p_num_parcelas: d.num_parcelas,
      p_primeiro_vencimento: d.primeiro_vencimento,
      p_data_contrato: d.data_contrato,
      p_corpo_gerado: texto,
      p_paciente_nome: d.paciente_nome || null,
      p_cidade: d.cidade,
      p_observacoes: d.observacoes || null,
    })
    .single<{ id: string; numero: number }>();

  if (error) return { erro: error.message };

  revalidatePath('/contratos');
  revalidatePath('/recebiveis');
  revalidatePath('/');

  return {
    ok: `Contrato nº ${contrato.numero} emitido e lançado no contas a receber.`,
    contratoId: contrato.id,
  };
}

export async function cancelarContrato(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  await exigirPerfil(['ADMIN', 'FINANCEIRO']);
  const id = String(formData.get('contrato_id') ?? '');

  const supabase = createClient();
  const { data: contrato, error } = await supabase
    .from('contratos')
    .update({ cancelado: true })
    .eq('id', id)
    .select('recebivel_id')
    .maybeSingle();

  if (error) return { erro: error.message };

  // O contrato some do fluxo junto com o que ele mandava cobrar.
  if (contrato?.recebivel_id) {
    await supabase.from('recebiveis')
      .update({ cancelado: true }).eq('id', contrato.recebivel_id);
    await supabase.from('parcelas')
      .update({ status: 'CANCELADA' })
      .eq('recebivel_id', contrato.recebivel_id)
      .eq('status', 'PENDENTE');
  }

  revalidatePath('/contratos');
  revalidatePath('/recebiveis');
  return { ok: 'Contrato cancelado, junto com as parcelas em aberto.' };
}

// ------------------------------ modelos -------------------------------

export async function salvarModelo(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  const perfil = await exigirPerfil(['ADMIN']);

  const chave = String(formData.get('chave') ?? '');
  const titulo = String(formData.get('titulo') ?? '').trim();
  const corpo = String(formData.get('corpo') ?? '').trim();
  const completo = formData.get('completo') === 'on';

  if (!['ORTODONTICO', 'ALINHADOR'].includes(chave)) return { erro: 'Modelo inválido.' };
  if (titulo.length < 3) return { erro: 'Informe o título do contrato.' };
  if (corpo.length < 50) return { erro: 'O corpo do contrato está curto demais.' };

  const supabase = createClient();
  const { data: atual } = await supabase
    .from('modelos_contrato').select('versao, corpo').eq('chave', chave).maybeSingle();

  // A versão só sobe quando o texto muda: é ela que identifica, no contrato
  // já emitido, qual redação foi assinada.
  const versao = (atual?.versao ?? 0) + (atual && atual.corpo !== corpo ? 1 : 0);

  const { error } = await supabase.from('modelos_contrato').update({
    titulo, corpo, completo,
    versao: Math.max(versao, 1),
    atualizado_por: perfil.id,
  }).eq('chave', chave);

  if (error) return { erro: error.message };

  revalidatePath('/contratos/modelos');
  revalidatePath('/contratos/novo');
  return { ok: `Modelo ${titulo} salvo.` };
}

// ----------------------------- emitentes ------------------------------

const esquemaEmitente = z.object({
  tipo_pessoa: z.enum(['PF', 'PJ']),
  nome: z.string().trim().min(3, 'Informe o nome').max(200),
  documento: z.string().min(1, 'Informe o CPF ou CNPJ'),
  qualificacao: z.string().trim().max(200).optional(),
  rg: z.string().trim().max(30).optional(),
  cro: z.string().trim().max(30).optional(),
  representante: z.string().trim().max(200).optional(),
  representante_doc: z.string().trim().max(30).optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  telefone: z.string().max(30).optional(),
  cep: z.string().max(12).optional(),
  logradouro: z.string().max(200).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(120).optional(),
  municipio: z.string().max(120).optional(),
  uf: z.string().max(2).optional(),
});

export async function salvarEmitente(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  await exigirPerfil(['ADMIN']);

  const bruto: Record<string, string> = {};
  for (const k of [
    'tipo_pessoa', 'nome', 'documento', 'qualificacao', 'rg', 'cro',
    'representante', 'representante_doc', 'email', 'telefone', 'cep',
    'logradouro', 'numero', 'complemento', 'bairro', 'municipio', 'uf',
  ]) bruto[k] = String(formData.get(k) ?? '').trim();

  const parsed = esquemaEmitente.safeParse(bruto);
  if (!parsed.success) return { erro: parsed.error.errors[0].message };

  const doc = soDigitos(parsed.data.documento);
  const valido = parsed.data.tipo_pessoa === 'PF' ? validaCPF(doc) : validaCNPJ(doc);
  if (!valido) {
    return { erro: parsed.data.tipo_pessoa === 'PF' ? 'CPF inválido.' : 'CNPJ inválido.' };
  }

  const registro = {
    ...parsed.data,
    documento: doc,
    email: parsed.data.email || null,
    uf: parsed.data.uf ? parsed.data.uf.toUpperCase() : null,
    cep: soDigitos(parsed.data.cep ?? '') || null,
    padrao: formData.get('padrao') === 'on',
  };

  const id = String(formData.get('id') ?? '');
  const supabase = createClient();

  // Só pode haver um padrão por tipo; o anterior cede o lugar.
  if (registro.padrao) {
    await supabase.from('emitentes')
      .update({ padrao: false })
      .eq('tipo_pessoa', registro.tipo_pessoa)
      .neq('id', id || '00000000-0000-0000-0000-000000000000');
  }

  const { error } = id
    ? await supabase.from('emitentes').update(registro).eq('id', id)
    : await supabase.from('emitentes').insert(registro);

  if (error) {
    if (error.code === '23505') return { erro: 'Já existe um emitente com este documento.' };
    return { erro: error.message };
  }

  revalidatePath('/configuracoes');
  revalidatePath('/contratos/novo');
  return { ok: id ? 'Emitente atualizado.' : 'Emitente cadastrado.' };
}
