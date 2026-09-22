import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus, TrendingUp, Wallet, Clock, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { lerFiltros } from '@/lib/filtros';
import { moeda, data as fdata, mesExtenso } from '@/lib/format';
import type { ParcelaView, Totais, ResumoMensal, OrigemFaturamento } from '@/lib/types';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Filtros } from '@/components/filtros/filtros';
import { Cartao, CartaoTitulo, Indicador, Vazio } from '@/components/ui/cards';
import { EtiquetaOrigem, EtiquetaStatus } from '@/components/ui/badge';
import { Botao } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Painel' };
export const dynamic = 'force-dynamic';

const ROTULO_ORIGEM: Record<OrigemFaturamento, string> = {
  PF: 'Pessoa Física', PJ: 'Pessoa Jurídica', CLINICA: 'Clínica',
};

export default async function PaginaPainel({
  searchParams,
}: { searchParams: Record<string, string | string[] | undefined> }) {
  const perfil = await exigirPerfil();
  const filtros = lerFiltros(searchParams);
  const supabase = createClient();

  // Balcão enxerga só a origem Clínica — o RLS garante isso no banco, o
  // filtro apenas evita mostrar um seletor que não teria efeito.
  const origemEfetiva = perfil.role === 'BALCAO' ? 'CLINICA' : filtros.origem;

  const argsComuns = {
    p_origem: origemEfetiva,
    p_tipo_pessoa: filtros.tipoPessoa,
  };

  const [mesAtual, geral, porOrigem, atrasadas, proximas] = await Promise.all([
    supabase.rpc('totais_periodo', {
      p_inicio: filtros.inicio, p_fim: filtros.fim, ...argsComuns,
    }).single<Totais>(),

    // "Total geral" = tudo que já foi lançado, sem recorte de mês.
    supabase.rpc('totais_periodo', {
      p_inicio: '1900-01-01', p_fim: '2999-12-31', ...argsComuns,
    }).single<Totais>(),

    supabase.from('vw_resumo_mensal')
      .select('*')
      .eq('mes_vencimento', filtros.inicio)
      .order('origem'),

    supabase.from('vw_parcelas')
      .select('*')
      .eq('vencida', true)
      .eq('cancelado', false)
      .order('vencimento', { ascending: true })
      .limit(6),

    supabase.from('vw_parcelas')
      .select('*')
      .eq('status', 'PENDENTE')
      .eq('cancelado', false)
      .gte('vencimento', new Date().toISOString().slice(0, 10))
      .order('vencimento', { ascending: true })
      .limit(6),
  ]);

  const t = mesAtual.data ?? { total: 0, recebido: 0, pendente: 0, vencido: 0, qtd: 0 };
  const g = geral.data ?? { total: 0, recebido: 0, pendente: 0, vencido: 0, qtd: 0 };
  const resumo = (porOrigem.data ?? []) as ResumoMensal[];
  const listaAtrasadas = (atrasadas.data ?? []) as ParcelaView[];
  const listaProximas = (proximas.data ?? []) as ParcelaView[];

  const percentual = Number(t.total) > 0
    ? Math.round((Number(t.recebido) / Number(t.total)) * 100) : 0;

  return (
    <>
      <CabecalhoPagina
        titulo={`Olá, ${perfil.nome.split(' ')[0]}`}
        descricao={`Resumo de ${mesExtenso(filtros.inicio)}`}
        acao={
          <Link href="/recebiveis/novo">
            <Botao tamanho="md">
              <Plus className="h-4 w-4" /> Lançar conta
            </Botao>
          </Link>
        }
      />

      <div className="space-y-5">
        <Filtros travadoEmClinica={perfil.role === 'BALCAO'} />

        {/* Quatro indicadores do mês: 2x2 no celular, 4 colunas no desktop. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <Indicador
            rotulo="A receber no mês"
            valor={Number(t.total)}
            detalhe={`${t.qtd} parcela(s)`}
            tom="azul"
            icone={<TrendingUp className="h-4 w-4" />}
          />
          <Indicador
            rotulo="Recebido"
            valor={Number(t.recebido)}
            detalhe={`${percentual}% do mês`}
            tom="verde"
            icone={<Wallet className="h-4 w-4" />}
          />
          <Indicador
            rotulo="Pendente"
            valor={Number(t.pendente)}
            tom="ambar"
            icone={<Clock className="h-4 w-4" />}
          />
          <Indicador
            rotulo="Vencido"
            valor={Number(t.vencido)}
            detalhe={Number(t.vencido) > 0 ? 'Requer cobrança' : 'Nada em atraso'}
            tom={Number(t.vencido) > 0 ? 'vermelho' : 'neutro'}
            icone={<AlertTriangle className="h-4 w-4" />}
          />
        </div>

        {/* Barra de progresso do mês */}
        <Cartao className="p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">Recebimento do mês</p>
            <p className="text-sm font-bold tabular-nums text-slate-900">{percentual}%</p>
          </div>
          <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(percentual, 100)}%` }}
            />
          </div>
          <div className="mt-2.5 flex justify-between text-xs text-slate-500">
            <span>{moeda(Number(t.recebido))} recebidos</span>
            <span>{moeda(Number(t.pendente))} a receber</span>
          </div>
        </Cartao>

        {/* Total geral acumulado */}
        <Cartao>
          <CartaoTitulo
            titulo="Total geral"
            descricao="Acumulado de todos os períodos, com os filtros aplicados"
          />
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            {[
              ['Lançado', Number(g.total), 'text-slate-900'],
              ['Recebido', Number(g.recebido), 'text-emerald-600'],
              ['Em aberto', Number(g.pendente), 'text-amber-600'],
            ].map(([rotulo, valor, cor]) => (
              <div key={rotulo as string} className="px-3 py-4 text-center sm:px-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {rotulo as string}
                </p>
                <p className={`mt-1 text-base font-bold tabular-nums sm:text-lg ${cor}`}>
                  {moeda(valor as number)}
                </p>
              </div>
            ))}
          </div>
        </Cartao>

        {/* Quebra por origem — a razão de ser do toggle PF/PJ/Clínica */}
        {perfil.role !== 'BALCAO' && (
          <Cartao>
            <CartaoTitulo
              titulo="Por origem do faturamento"
              descricao={mesExtenso(filtros.inicio)}
            />
            {resumo.length === 0 ? (
              <Vazio titulo="Nenhum lançamento neste mês" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {resumo.map((linha) => {
                  const pct = Number(linha.total) > 0
                    ? Math.round((Number(linha.recebido) / Number(linha.total)) * 100) : 0;
                  return (
                    <li key={linha.origem} className="px-4 py-3.5 sm:px-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <EtiquetaOrigem origem={linha.origem} />
                          <span className="text-xs text-slate-500">
                            {linha.qtd_parcelas} parcela(s)
                          </span>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-slate-900">
                          {moeda(Number(linha.total))}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-emerald-500"
                          style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs text-slate-500">
                        <span>Recebido {moeda(Number(linha.recebido))}</span>
                        <span>Pendente {moeda(Number(linha.pendente))}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Cartao>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <ListaParcelas
            titulo="Em atraso"
            descricao="Parcelas vencidas e ainda não quitadas"
            parcelas={listaAtrasadas}
            vazio="Nenhuma parcela em atraso."
          />
          <ListaParcelas
            titulo="Próximos vencimentos"
            parcelas={listaProximas}
            vazio="Nada a vencer no momento."
          />
        </div>
      </div>
    </>
  );
}

function ListaParcelas({
  titulo, descricao, parcelas, vazio,
}: {
  titulo: string;
  descricao?: string;
  parcelas: ParcelaView[];
  vazio: string;
}) {
  return (
    <Cartao>
      <CartaoTitulo
        titulo={titulo}
        descricao={descricao}
        acao={
          <Link href="/recebiveis"
            className="text-xs font-semibold text-brand-700 hover:underline">
            Ver todas
          </Link>
        }
      />
      {parcelas.length === 0 ? (
        <Vazio titulo={vazio} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {parcelas.map((p) => (
            <li key={p.id}>
              <Link href={`/recebiveis/${p.recebivel_id}`}
                className="flex items-center justify-between gap-3 px-4 py-3
                  hover:bg-slate-50 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {p.cliente_nome}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {p.descricao} · {p.numero}/{p.num_parcelas} · venc. {fdata(p.vencimento)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-bold tabular-nums text-slate-900">
                    {moeda(Number(p.valor))}
                  </span>
                  <EtiquetaStatus status={p.status} vencida={p.vencida} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}
