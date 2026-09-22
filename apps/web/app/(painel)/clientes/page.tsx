import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { lerFiltros } from '@/lib/filtros';
import { documento as fdoc } from '@/lib/format';
import type { Cliente } from '@/lib/types';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { CampoBusca } from '@/components/filtros/busca';
import { Cartao, CartaoTitulo, Vazio } from '@/components/ui/cards';
import { Etiqueta } from '@/components/ui/badge';
import { FormCliente } from '@/components/clientes/form-cliente';

export const metadata: Metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

export default async function PaginaClientes({
  searchParams,
}: { searchParams: Record<string, string | string[] | undefined> }) {
  await exigirPerfil();
  const filtros = lerFiltros(searchParams);
  const supabase = createClient();

  let query = supabase.from('clientes').select('*').order('nome').limit(200);
  if (filtros.busca) {
    query = query.or(`nome.ilike.%${filtros.busca}%,documento.ilike.%${filtros.busca}%`);
  }
  const { data } = await query;
  const clientes = (data ?? []) as Cliente[];

  return (
    <>
      <CabecalhoPagina
        titulo="Clientes"
        descricao="Pacientes e convênios atendidos"
        acao={<FormCliente />}
      />

      <div className="space-y-4">
        <CampoBusca placeholder="Buscar por nome ou documento…" />

        <Cartao>
          <CartaoTitulo titulo={`${clientes.length} cliente(s)`} />
          {clientes.length === 0 ? (
            <Vazio
              titulo="Nenhum cliente encontrado"
              descricao="Cadastre o primeiro paciente para começar a lançar contas."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {clientes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3
                  px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {c.nome}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {fdoc(c.documento, c.tipo_pessoa)}
                      {c.telefone && ` · ${c.telefone}`}
                      {c.email && ` · ${c.email}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Etiqueta tom={c.tipo_pessoa === 'PJ' ? 'azul' : 'neutro'}>
                      {c.tipo_pessoa}
                    </Etiqueta>
                    {!c.ativo && <Etiqueta tom="vermelho">Inativo</Etiqueta>}
                    <FormCliente cliente={c} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
