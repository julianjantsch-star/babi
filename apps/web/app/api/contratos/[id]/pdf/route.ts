import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { perfilAtual, podeVerFinanceiroCompleto } from '@/lib/auth/session';
import { gerarPdfContrato } from '@/lib/contratos/pdf';

/**
 * Gera o PDF a partir do texto guardado no contrato, e não do modelo atual.
 * Um ajuste posterior na redação não pode reescrever o que já foi assinado.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const perfil = await perfilAtual();
  if (!perfil) return new NextResponse('Não autenticado', { status: 401 });
  if (!podeVerFinanceiroCompleto(perfil.role)) {
    return new NextResponse('Sem permissão', { status: 403 });
  }

  const supabase = createClient();
  const { data: contrato, error } = await supabase
    .from('contratos')
    .select('numero, corpo_gerado, rascunho, data_contrato, clientes(nome), modelos_contrato(titulo)')
    .eq('id', params.id)
    .maybeSingle();

  if (error) return new NextResponse(error.message, { status: 500 });
  if (!contrato) return new NextResponse('Contrato não encontrado', { status: 404 });

  const cliente = (contrato.clientes as { nome?: string } | null)?.nome ?? '';
  const titulo = (contrato.modelos_contrato as { titulo?: string } | null)?.titulo
    ?? 'Contrato';

  const pdf = await gerarPdfContrato({
    corpo: contrato.corpo_gerado,
    titulo,
    numero: contrato.numero,
    rascunho: contrato.rascunho,
    rodape: [`Contrato nº ${contrato.numero}`, cliente].filter(Boolean).join(' - '),
  });

  const arquivo = `contrato-${contrato.numero}-`
    + `${cliente.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente'}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${arquivo}"`,
      'cache-control': 'no-store',
    },
  });
}
