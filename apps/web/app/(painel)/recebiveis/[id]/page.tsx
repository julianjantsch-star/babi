import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { moeda, data as fdata, documento } from '@/lib/format';
import type { ParcelaView, NotaFiscal } from '@/lib/types';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Cartao, CartaoTitulo, Indicador } from '@/components/ui/cards';
import { EtiquetaOrigem, EtiquetaNfse } from '@/components/ui/badge';
import { ListaParcelas } from '@/components/parcelas/lista';
import { BotaoEmitirNota } from '@/components/nfse/botao-emitir';

export const metadata: Metadata = { title: 'Detalhe da conta' };
export const dynamic = 'force-dynamic';

export default async function PaginaRecebivel({
  params,
}: { params: { id: string } }) {
  const perfil = await exigirPerfil();
  const supabase = createClient();

  const { data: recebivel } = await supabase
    .from('recebiveis')
    .select('*, clientes(*)')
    .eq('id', params.id)
    .maybeSingle();

  if (!recebivel) notFound();

  const [{ data: parcelasData }, { data: notasData }] = await Promise.all([
    supabase.from('vw_parcelas').select('*')
      .eq('recebivel_id', params.id).order('numero'),
    supabase.from('notas_fiscais').select('*')
      .eq('recebivel_id', params.id).order('created_at', { ascending: false }),
  ]);

  const parcelas = (parcelasData ?? []) as ParcelaView[];
  const notas = (notasData ?? []) as NotaFiscal[];
  const cliente = recebivel.clientes as Record<string, string>;

  const recebido = parcelas
    .filter((p) => p.status === 'PAGA')
    .reduce((s, p) => s + Number(p.valor_pago ?? p.valor), 0);
  const pendente = parcelas
    .filter((p) => p.status === 'PENDENTE')
    .reduce((s, p) => s + Number(p.valor), 0);

  const podeEmitir = perfil.role === 'ADMIN' && recebivel.origem === 'PJ';

  return (
    <>
      <Link href="/recebiveis"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium
          text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Contas a receber
      </Link>

      <CabecalhoPagina
        titulo={cliente.nome}
        descricao={recebivel.descricao}
        acao={podeEmitir ? (
          <BotaoEmitirNota
            recebivelId={recebivel.id}
            valorTotal={Number(recebivel.valor_total)}
            parcelas={parcelas.map((p) => ({
              id: p.id, numero: p.numero,
              valor: Number(p.valor), vencimento: p.vencimento,
            }))}
          />
        ) : undefined}
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <EtiquetaOrigem origem={recebivel.origem} />
          <span className="text-sm text-slate-500">
            {documento(cliente.documento, (cliente.tipo_pessoa as 'PF' | 'PJ') ?? 'PF')}
          </span>
          <span className="text-sm text-slate-400">·</span>
          <span className="text-sm text-slate-500">
            Competência {fdata(recebivel.data_competencia)}
          </span>
          {recebivel.cancelado && (
            <span className="text-sm font-semibold text-rose-600">Cancelada</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Indicador rotulo="Valor total" valor={Number(recebivel.valor_total)} />
          <Indicador rotulo="Recebido" valor={recebido} tom="verde" />
          <Indicador rotulo="Em aberto" valor={pendente} tom="ambar" />
        </div>

        {recebivel.observacoes && (
          <Cartao className="p-4 sm:p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Observações
            </p>
            <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700">
              {recebivel.observacoes}
            </p>
          </Cartao>
        )}

        <Cartao>
          <CartaoTitulo
            titulo="Parcelas"
            descricao={`${parcelas.length} parcela(s) · total ${moeda(Number(recebivel.valor_total))}`}
          />
          <ListaParcelas parcelas={parcelas} podeEstornar={perfil.role !== 'BALCAO'} />
        </Cartao>

        {notas.length > 0 && (
          <Cartao>
            <CartaoTitulo titulo="Notas fiscais emitidas" />
            <ul className="divide-y divide-slate-100">
              {notas.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3
                  px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {n.numero_nfse ? `NFS-e ${n.numero_nfse}` : `RPS ${n.rps_numero}`}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {moeda(Number(n.valor))} · {fdata(n.competencia)}
                      {n.erro && <span className="text-rose-600"> · {n.erro}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <EtiquetaNfse status={n.status} />
                    {n.pdf_url && (
                      <a href={n.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-semibold text-brand-700 hover:underline">
                        PDF
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Cartao>
        )}
      </div>
    </>
  );
}
