'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exigirPerfil } from '@/lib/auth/session';
import { emitirNfse, cancelarNfse } from '@/lib/nfse/cliente';
import type { EstadoForm } from './auth';

/**
 * Emite a nota de um recebível (ou de uma parcela específica).
 * Só a origem PJ emite NFS-e: atendimento como PF é RPA e o repasse da
 * clínica é faturado pela própria clínica.
 */
export async function emitirNotaFiscal(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  const perfil = await exigirPerfil(['ADMIN']);
  const supabase = createClient();
  const admin = createAdminClient();

  const recebivelId = String(formData.get('recebivel_id') ?? '');
  const parcelaId = String(formData.get('parcela_id') ?? '') || null;

  const { data: recebivel, error: erroReceb } = await supabase
    .from('recebiveis')
    .select('*, clientes(*)')
    .eq('id', recebivelId)
    .maybeSingle();

  if (erroReceb || !recebivel) return { erro: 'Conta a receber não encontrada.' };
  if (recebivel.origem !== 'PJ') {
    return { erro: 'Somente contas da origem Pessoa Jurídica emitem NFS-e.' };
  }

  const cliente = recebivel.clientes as Record<string, string | null>;
  if (!cliente?.documento) {
    return { erro: `Cadastre o CPF/CNPJ de ${cliente?.nome} antes de emitir a nota.` };
  }
  if (!cliente.cod_municipio) {
    return { erro: 'O cliente precisa do código IBGE do município para a NFS-e.' };
  }

  const { data: config } = await supabase.from('configuracoes').select('*').maybeSingle();
  if (!config?.cnpj || !config?.cod_municipio) {
    return { erro: 'Complete os dados do prestador em Configurações antes de emitir.' };
  }

  // Valor: da parcela quando informada, senão o total do contrato.
  let valor = Number(recebivel.valor_total);
  let competencia = recebivel.data_competencia as string;
  if (parcelaId) {
    const { data: parcela } = await supabase
      .from('parcelas').select('valor, vencimento').eq('id', parcelaId).maybeSingle();
    if (!parcela) return { erro: 'Parcela não encontrada.' };
    valor = Number(parcela.valor);
    competencia = parcela.vencimento as string;
  }

  // Numeração sequencial do RPS: a sequência do banco garante unicidade
  // mesmo com duas emissões simultâneas.
  const { data: seq, error: erroSeq } = await admin
    .rpc('nextval_rps' as never)
    .single<number>();
  if (erroSeq) return { erro: `Falha ao numerar o RPS: ${erroSeq.message}` };
  const rpsNumero = Number(seq);

  const { data: nota, error: erroNota } = await supabase
    .from('notas_fiscais')
    .insert({
      recebivel_id: recebivelId,
      parcela_id: parcelaId,
      cliente_id: recebivel.cliente_id,
      status: 'PROCESSANDO',
      valor,
      discriminacao: recebivel.descricao,
      competencia,
      serie: String(config.serie_rps ?? '1'),
      rps_numero: rpsNumero,
      created_by: perfil.id,
    })
    .select()
    .single();

  if (erroNota) return { erro: erroNota.message };

  try {
    const resposta = await emitirNfse({
      referencia: nota.id,
      competencia,
      valor,
      discriminacao: recebivel.descricao,
      serie: nota.serie,
      rpsNumero,
      prestador: {
        cnpj: config.cnpj,
        inscricaoMunicipal: config.inscricao_municipal,
        codMunicipio: config.cod_municipio,
        itemListaServico: config.item_lista_servico ?? '0412',
        aliquotaIss: Number(config.aliquota_iss ?? 0.02),
        issRetido: !!config.iss_retido,
        optanteSimples: !!config.optante_simples,
      },
      tomador: {
        tipoPessoa: (cliente.tipo_pessoa as 'PF' | 'PJ') ?? 'PF',
        documento: cliente.documento,
        nome: cliente.nome ?? '',
        email: cliente.email,
        cep: cliente.cep,
        logradouro: cliente.logradouro,
        numero: cliente.numero,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        codMunicipio: cliente.cod_municipio,
        uf: cliente.uf,
      },
    });

    await supabase.from('notas_fiscais').update({
      status: resposta.status,
      chave_acesso: resposta.chaveAcesso ?? null,
      numero_nfse: resposta.numeroNfse ?? null,
      codigo_verificacao: resposta.codigoVerificacao ?? null,
      data_emissao: resposta.dataEmissao ?? new Date().toISOString(),
      xml_dps: resposta.xmlDps ?? null,
      xml_nfse: resposta.xmlNfse ?? null,
      pdf_url: resposta.pdfUrl ?? null,
      erro: resposta.erro ?? null,
    }).eq('id', nota.id);

    revalidatePath('/notas');

    if (resposta.status === 'REJEITADA') {
      return { erro: `Nota rejeitada pela SEFIN: ${resposta.erro ?? 'motivo não informado'}` };
    }
    return { ok: `Nota ${resposta.numeroNfse ?? ''} emitida com sucesso.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    await supabase.from('notas_fiscais')
      .update({ status: 'REJEITADA', erro: msg }).eq('id', nota.id);
    revalidatePath('/notas');
    return { erro: msg };
  }
}

export async function cancelarNotaFiscal(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  await exigirPerfil(['ADMIN']);

  const id = String(formData.get('nota_id') ?? '');
  const motivo = String(formData.get('motivo') ?? '').trim();
  if (motivo.length < 15) {
    return { erro: 'A SEFIN exige um motivo com pelo menos 15 caracteres.' };
  }

  const supabase = createClient();
  const { data: nota } = await supabase
    .from('notas_fiscais').select('chave_acesso, status').eq('id', id).maybeSingle();

  if (!nota?.chave_acesso) return { erro: 'Nota sem chave de acesso.' };
  if (nota.status !== 'AUTORIZADA') return { erro: 'Só notas autorizadas podem ser canceladas.' };

  try {
    await cancelarNfse(nota.chave_acesso, motivo);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Falha no cancelamento.' };
  }

  await supabase.from('notas_fiscais').update({
    status: 'CANCELADA',
    cancelada_em: new Date().toISOString(),
    motivo_cancelamento: motivo,
  }).eq('id', id);

  revalidatePath('/notas');
  return { ok: 'Nota cancelada.' };
}
