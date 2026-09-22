import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { lerFiltros } from '@/lib/filtros';
import { moeda, mesExtenso, capitalizar } from '@/lib/format';
import type { ParcelaView, Totais } from '@/lib/types';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Filtros } from '@/components/filtros/filtros';
import { CampoBusca } from '@/components/filtros/busca';
import { Cartao, CartaoTitulo } from '@/components/ui/cards';
import { Botao } from '@/components/ui/button';
import { ListaParcelas } from '@/components/parcelas/lista';
import { SeletorVisao } from '@/components/parcelas/seletor-visao';

export const metadata: Metadata = { title: 'Contas a receber' };
export const dynamic = 'force-dynamic';

const POR_PAGINA = 50;

export default async function PaginaRecebiveis({
  searchParams,
}: { searchParams: Record<string, string | string[] | undefined> }) {
  const perfil = await exigirPerfil();
  const filtros = lerFiltros(searchParams, { permitirTodos: true });
  const supabase = createClient();

  const origemEfetiva = perfil.role === 'BALCAO' ? 'CLINICA' : filtros.origem;

  let query = supabase
    .from('vw_parcelas')
    .select('*', { count: 'exact' })
    .eq('cancelado', false)
    .order('vencimento', { ascending: true })
    .range((filtros.pagina - 1) * POR_PAGINA, filtros.pagina * POR_PAGINA - 1);

  // Com o período aberto, não há recorte de data: a consulta varre tudo.
  if (!filtros.todosOsMeses) {
    query = query
      .gte('vencimento', filtros.inicio)
      .lte('vencimento', filtros.fim);
  }

  if (origemEfetiva) query = query.eq('origem', origemEfetiva);
  if (filtros.tipoPessoa) query = query.eq('cliente_tipo_pessoa', filtros.tipoPessoa);
  if (filtros.busca) query = query.ilike('cliente_nome', `%${filtros.busca}%`);

  if (filtros.status === 'VENCIDA') query = query.eq('vencida', true);
  else if (filtros.status) query = query.eq('status', filtros.status);
  else query = query.neq('status', 'CANCELADA');

  const [{ data, count, error }, totais] = await Promise.all([
    query,
    supabase.rpc('totais_periodo', {
      p_inicio: filtros.inicio,
      p_fim: filtros.fim,
      p_origem: origemEfetiva,
      p_tipo_pessoa: filtros.tipoPessoa,
    }).single<Totais>(),
  ]);

  const parcelas = (data ?? []) as ParcelaView[];
  const t = totais.data ?? { total: 0, recebido: 0, pendente: 0, vencido: 0, qtd: 0 };
  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
  const periodo = filtros.todosOsMeses
    ? 'Todos os meses' : capitalizar(mesExtenso(filtros.inicio));

  return (
    <>
      <CabecalhoPagina
        titulo="Contas a receber"
        descricao={periodo}
        acao={
          <Link href="/recebiveis/novo">
            <Botao><Plus className="h-4 w-4" /> Lançar conta</Botao>
          </Link>
        }
      />

      <div className="space-y-4">
        <Filtros
          mostrarStatus
          permitirTodosOsMeses
          travadoEmClinica={perfil.role === 'BALCAO'}
        />
        <CampoBusca />

        {/* Totais do recorte atual, sempre visíveis acima da lista. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [filtros.todosOsMeses ? 'Total geral' : 'Total do mês',
              Number(t.total), 'text-slate-900'],
            ['Recebido', Number(t.recebido), 'text-emerald-600'],
            ['Pendente', Number(t.pendente), 'text-amber-600'],
            ['Vencido', Number(t.vencido), 'text-rose-600'],
          ].map(([rotulo, valor, cor]) => (
            <div key={rotulo as string} className="cartao px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {rotulo as string}
              </p>
              <p className={`mt-1 text-base font-bold tabular-nums ${cor} sm:text-lg`}>
                {moeda(valor as number)}
              </p>
            </div>
          ))}
        </div>

        <Cartao>
          <CartaoTitulo
            titulo={`${count ?? 0} parcela(s)`}
            descricao={periodo}
            acao={<SeletorVisao visao={filtros.visao} />}
          />
          {error ? (
            <p className="px-5 py-8 text-sm text-rose-600">
              Não foi possível carregar: {error.message}
            </p>
          ) : (
            <ListaParcelas
              parcelas={parcelas}
              podeEstornar={perfil.role !== 'BALCAO'}
              visao={filtros.visao}
            />
          )}
        </Cartao>

        {totalPaginas > 1 && (
          <Paginacao
            pagina={filtros.pagina}
            total={totalPaginas}
            params={searchParams}
          />
        )}
      </div>
    </>
  );
}

function Paginacao({
  pagina, total, params,
}: {
  pagina: number;
  total: number;
  params: Record<string, string | string[] | undefined>;
}) {
  const link = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'string' && k !== 'pagina') q.set(k, v);
    }
    q.set('pagina', String(p));
    return `/recebiveis?${q.toString()}`;
  };

  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Paginação">
      {pagina > 1
        ? <Link href={link(pagina - 1)}><Botao variante="secundario">Anterior</Botao></Link>
        : <span />}
      <span className="text-sm text-slate-500">Página {pagina} de {total}</span>
      {pagina < total
        ? <Link href={link(pagina + 1)}><Botao variante="secundario">Próxima</Botao></Link>
        : <span />}
    </nav>
  );
}
