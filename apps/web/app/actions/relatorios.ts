'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { lerFiltros } from '@/lib/filtros';
import { gerarCsv, resumoHtml } from '@/lib/relatorios';
import { enviarRelatorio } from '@/lib/email/resend';
import { mesExtenso } from '@/lib/format';
import type { ParcelaView, Totais } from '@/lib/types';
import type { EstadoForm } from './auth';

export async function enviarRelatorioPorEmail(
  _estado: EstadoForm, formData: FormData,
): Promise<EstadoForm> {
  const perfil = await exigirPerfil(['ADMIN', 'FINANCEIRO']);

  const destinatarios = String(formData.get('destinatarios') ?? '')
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  if (destinatarios.length === 0) return { erro: 'Informe ao menos um e-mail.' };
  if (destinatarios.length > 10) return { erro: 'No máximo 10 destinatários por envio.' };

  const invalido = destinatarios.find(
    (e) => !z.string().email().safeParse(e).success,
  );
  if (invalido) return { erro: `E-mail inválido: ${invalido}` };

  const filtros = lerFiltros({
    mes: String(formData.get('mes') ?? ''),
    origem: String(formData.get('origem') ?? ''),
    pessoa: String(formData.get('pessoa') ?? ''),
  });

  const supabase = createClient();
  const origemEfetiva = perfil.role === 'BALCAO' ? 'CLINICA' : filtros.origem;

  let query = supabase
    .from('vw_parcelas').select('*')
    .eq('cancelado', false)
    .gte('vencimento', filtros.inicio)
    .lte('vencimento', filtros.fim)
    .order('vencimento');

  if (origemEfetiva) query = query.eq('origem', origemEfetiva);
  if (filtros.tipoPessoa) query = query.eq('cliente_tipo_pessoa', filtros.tipoPessoa);

  const [{ data, error }, totais] = await Promise.all([
    query,
    supabase.rpc('totais_periodo', {
      p_inicio: filtros.inicio,
      p_fim: filtros.fim,
      p_origem: origemEfetiva,
      p_tipo_pessoa: filtros.tipoPessoa,
    }).single<Totais>(),
  ]);

  if (error) return { erro: error.message };

  const parcelas = (data ?? []) as ParcelaView[];
  if (parcelas.length === 0) {
    return { erro: 'Não há parcelas no período selecionado.' };
  }

  const periodo = mesExtenso(filtros.inicio);

  try {
    await enviarRelatorio(
      destinatarios,
      `Contas a receber — ${periodo}`,
      resumoHtml(`Resumo de ${periodo}, com os filtros aplicados no sistema.`,
        totais.data ?? { total: 0, recebido: 0, pendente: 0, vencido: 0, qtd: 0 }),
      {
        filename: `contas-a-receber-${filtros.mes}.csv`,
        content: gerarCsv(parcelas),
      },
    );
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Falha no envio.' };
  }

  return { ok: `Relatório enviado para ${destinatarios.join(', ')}.` };
}
