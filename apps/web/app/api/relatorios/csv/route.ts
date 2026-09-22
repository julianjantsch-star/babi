import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { perfilAtual } from '@/lib/auth/session';
import { lerFiltros } from '@/lib/filtros';
import { gerarCsv } from '@/lib/relatorios';
import type { ParcelaView } from '@/lib/types';

export async function GET(request: NextRequest) {
  const perfil = await perfilAtual();
  if (!perfil) return new NextResponse('Não autenticado', { status: 401 });

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filtros = lerFiltros(params);
  const supabase = createClient();

  const origemEfetiva = perfil.role === 'BALCAO' ? 'CLINICA' : filtros.origem;

  let query = supabase
    .from('vw_parcelas')
    .select('*')
    .eq('cancelado', false)
    .gte('vencimento', filtros.inicio)
    .lte('vencimento', filtros.fim)
    .order('vencimento');

  if (origemEfetiva) query = query.eq('origem', origemEfetiva);
  if (filtros.tipoPessoa) query = query.eq('cliente_tipo_pessoa', filtros.tipoPessoa);
  if (filtros.status === 'VENCIDA') query = query.eq('vencida', true);
  else if (filtros.status) query = query.eq('status', filtros.status);

  const { data, error } = await query;
  if (error) return new NextResponse(error.message, { status: 500 });

  const csv = gerarCsv((data ?? []) as ParcelaView[]);

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition':
        `attachment; filename="contas-a-receber-${filtros.mes}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
