import type { Metadata } from 'next';
import { Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { lerFiltros } from '@/lib/filtros';
import { moeda, mesExtenso } from '@/lib/format';
import type { Totais, ResumoMensal, OrigemFaturamento } from '@/lib/types';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Filtros } from '@/components/filtros/filtros';
import { Cartao, CartaoTitulo, Indicador, Vazio } from '@/components/ui/cards';
import { Tabela, Th, Td } from '@/components/ui/tabela';
import { EtiquetaOrigem } from '@/components/ui/badge';
import { BotaoCsv } from '@/components/relatorios/botao-csv';
import { BotaoEnviarEmail } from '@/components/relatorios/enviar-email';

export const metadata: Metadata = { title: 'Relatórios' };
export const dynamic = 'force-dynamic';

interface RecebidoMensal {
  mes_recebimento: string;
  origem: OrigemFaturamento;
  forma_pagamento: string;
  qtd_parcelas: number;
  recebido: number;
}

const FORMA: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX: 'PIX', CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito', TRANSFERENCIA: 'Transferência',
  BOLETO: 'Boleto', CHEQUE: 'Cheque', OUTRO: 'Outro',
};

export default async function PaginaRelatorios({
  searchParams,
}: { searchParams: Record<string, string | string[] | undefined> }) {
  const perfil = await exigirPerfil(['ADMIN', 'FINANCEIRO']);
  const filtros = lerFiltros(searchParams);
  const supabase = createClient();

  const [totais, porOrigem, porForma, ultimosMeses] = await Promise.all([
    supabase.rpc('totais_periodo', {
      p_inicio: filtros.inicio, p_fim: filtros.fim,
      p_origem: filtros.origem, p_tipo_pessoa: filtros.tipoPessoa,
    }).single<Totais>(),

    supabase.from('vw_resumo_mensal').select('*')
      .eq('mes_vencimento', filtros.inicio).order('origem'),

    supabase.from('vw_recebido_mensal').select('*')
      .eq('mes_recebimento', filtros.inicio),

    // Série dos últimos 12 meses para a comparação mês a mês.
    supabase.from('vw_resumo_mensal').select('*')
      .gte('mes_vencimento', recuarMeses(filtros.inicio, 11))
      .lte('mes_vencimento', filtros.inicio)
      .order('mes_vencimento', { ascending: false }),
  ]);

  const t = totais.data ?? { total: 0, recebido: 0, pendente: 0, vencido: 0, qtd: 0 };
  const origens = (porOrigem.data ?? []) as ResumoMensal[];
  const formas = (porForma.data ?? []) as RecebidoMensal[];
  const serie = agruparPorMes((ultimosMeses.data ?? []) as ResumoMensal[]);

  return (
    <>
      <CabecalhoPagina
        titulo="Relatórios"
        descricao={mesExtenso(filtros.inicio)}
        acao={
          <div className="no-print flex gap-2">
            <BotaoCsv />
            <BotaoEnviarEmail emailPadrao={perfil.email} />
          </div>
        }
      />

      <div className="space-y-4">
        <div className="no-print">
          <Filtros />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador rotulo="Total do mês" valor={Number(t.total)} tom="azul"
            detalhe={`${t.qtd} parcela(s)`} />
          <Indicador rotulo="Recebido" valor={Number(t.recebido)} tom="verde" />
          <Indicador rotulo="Pendente" valor={Number(t.pendente)} tom="ambar" />
          <Indicador rotulo="Vencido" valor={Number(t.vencido)} tom="vermelho" />
        </div>

        <Cartao>
          <CartaoTitulo titulo="Por origem do faturamento"
            descricao="Distribuição do mês entre PF, PJ e Clínica" />
          {origens.length === 0 ? <Vazio titulo="Sem lançamentos no período" /> : (
            <Tabela>
              <thead>
                <tr>
                  <Th>Origem</Th>
                  <Th alinhar="centro">Parcelas</Th>
                  <Th alinhar="direita">Total</Th>
                  <Th alinhar="direita">Recebido</Th>
                  <Th alinhar="direita">Pendente</Th>
                  <Th alinhar="direita">Vencido</Th>
                </tr>
              </thead>
              <tbody>
                {origens.map((o) => (
                  <tr key={o.origem}>
                    <Td><EtiquetaOrigem origem={o.origem} /></Td>
                    <Td alinhar="centro">{o.qtd_parcelas}</Td>
                    <Td alinhar="direita" className="font-semibold text-slate-900">
                      {moeda(Number(o.total))}
                    </Td>
                    <Td alinhar="direita" className="text-emerald-600">
                      {moeda(Number(o.recebido))}
                    </Td>
                    <Td alinhar="direita" className="text-amber-600">
                      {moeda(Number(o.pendente))}
                    </Td>
                    <Td alinhar="direita" className="text-rose-600">
                      {moeda(Number(o.vencido))}
                    </Td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <Td>Total</Td>
                  <Td alinhar="centro">
                    {origens.reduce((s, o) => s + Number(o.qtd_parcelas), 0)}
                  </Td>
                  <Td alinhar="direita">
                    {moeda(origens.reduce((s, o) => s + Number(o.total), 0))}
                  </Td>
                  <Td alinhar="direita" className="text-emerald-700">
                    {moeda(origens.reduce((s, o) => s + Number(o.recebido), 0))}
                  </Td>
                  <Td alinhar="direita" className="text-amber-700">
                    {moeda(origens.reduce((s, o) => s + Number(o.pendente), 0))}
                  </Td>
                  <Td alinhar="direita" className="text-rose-700">
                    {moeda(origens.reduce((s, o) => s + Number(o.vencido), 0))}
                  </Td>
                </tr>
              </tbody>
            </Tabela>
          )}
        </Cartao>

        <Cartao>
          <CartaoTitulo titulo="Recebimentos por forma de pagamento"
            descricao="Caixa realizado no mês" />
          {formas.length === 0 ? <Vazio titulo="Nenhum recebimento no período" /> : (
            <ul className="divide-y divide-slate-100">
              {formas.map((f) => (
                <li key={`${f.origem}-${f.forma_pagamento}`}
                  className="flex items-center justify-between px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-medium text-slate-900">
                      {FORMA[f.forma_pagamento] ?? f.forma_pagamento}
                    </span>
                    <EtiquetaOrigem origem={f.origem} />
                  </div>
                  <span className="text-sm font-bold tabular-nums text-slate-900">
                    {moeda(Number(f.recebido))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <CartaoTitulo titulo="Evolução mensal"
            descricao="Últimos 12 meses por vencimento" />
          {serie.length === 0 ? <Vazio titulo="Sem histórico" /> : (
            <Tabela>
              <thead>
                <tr>
                  <Th>Mês</Th>
                  <Th alinhar="direita">Total</Th>
                  <Th alinhar="direita">Recebido</Th>
                  <Th alinhar="direita">Pendente</Th>
                  <Th alinhar="centro">% recebido</Th>
                </tr>
              </thead>
              <tbody>
                {serie.map((m) => {
                  const pct = m.total > 0 ? Math.round((m.recebido / m.total) * 100) : 0;
                  return (
                    <tr key={m.mes}>
                      <Td className="capitalize">{mesExtenso(m.mes)}</Td>
                      <Td alinhar="direita" className="font-semibold text-slate-900">
                        {moeda(m.total)}
                      </Td>
                      <Td alinhar="direita" className="text-emerald-600">
                        {moeda(m.recebido)}
                      </Td>
                      <Td alinhar="direita" className="text-amber-600">
                        {moeda(m.pendente)}
                      </Td>
                      <Td alinhar="centro">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-full min-w-16 overflow-hidden
                            rounded-full bg-slate-100">
                            <div className="h-full bg-emerald-500"
                              style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="w-9 shrink-0 text-xs tabular-nums text-slate-600">
                            {pct}%
                          </span>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>
          )}
        </Cartao>

        <p className="no-print flex items-center gap-1.5 text-xs text-slate-500">
          <Printer className="h-3.5 w-3.5" />
          Use a impressão do navegador (Ctrl/Cmd + P) para gerar um PDF desta página.
        </p>
      </div>
    </>
  );
}

/** Recua N meses de uma data ISO, preservando o dia 1. */
function recuarMeses(iso: string, n: number) {
  const [ano, mes] = iso.slice(0, 10).split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 - n, 1));
  return d.toISOString().slice(0, 10);
}

function agruparPorMes(linhas: ResumoMensal[]) {
  const mapa = new Map<string, { mes: string; total: number; recebido: number; pendente: number }>();
  for (const l of linhas) {
    const atual = mapa.get(l.mes_vencimento)
      ?? { mes: l.mes_vencimento, total: 0, recebido: 0, pendente: 0 };
    atual.total += Number(l.total);
    atual.recebido += Number(l.recebido);
    atual.pendente += Number(l.pendente);
    mapa.set(l.mes_vencimento, atual);
  }
  return [...mapa.values()].sort((a, b) => b.mes.localeCompare(a.mes));
}
