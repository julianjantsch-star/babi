import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus, FileText, Settings2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { moeda, data as fdata } from '@/lib/format';
import type { ContratoView } from '@/lib/types';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Cartao, CartaoTitulo, Vazio, Aviso } from '@/components/ui/cards';
import { Etiqueta } from '@/components/ui/badge';
import { Botao } from '@/components/ui/button';
import { Tabela, Th, Td } from '@/components/ui/tabela';

export const metadata: Metadata = { title: 'Contratos' };
export const dynamic = 'force-dynamic';

export default async function PaginaContratos() {
  const perfil = await exigirPerfil(['ADMIN', 'FINANCEIRO']);
  const supabase = createClient();

  const [{ data }, { data: modelos }] = await Promise.all([
    supabase.from('vw_contratos').select('*')
      .order('numero', { ascending: false }).limit(200),
    supabase.from('modelos_contrato').select('chave, titulo, completo'),
  ]);

  const contratos = (data ?? []) as ContratoView[];
  const incompletos = (modelos ?? []).filter((m) => !m.completo);

  return (
    <>
      <CabecalhoPagina
        titulo="Contratos"
        descricao="Gera o contrato em PDF e lança as parcelas no financeiro"
        acao={
          <div className="flex gap-2">
            {perfil.role === 'ADMIN' && (
              <Link href="/contratos/modelos">
                <Botao variante="secundario"><Settings2 className="h-4 w-4" /> Modelos</Botao>
              </Link>
            )}
            <Link href="/contratos/novo">
              <Botao><Plus className="h-4 w-4" /> Novo contrato</Botao>
            </Link>
          </div>
        }
      />

      <div className="space-y-4">
        {incompletos.length > 0 && (
          <Aviso tom="alerta">
            {incompletos.length === 1
              ? `O modelo "${incompletos[0].titulo}" ainda está incompleto`
              : `${incompletos.length} modelos ainda estão incompletos`}
            {' '}— os contratos gerados saem carimbados como rascunho.
            {perfil.role === 'ADMIN' && (
              <> <Link href="/contratos/modelos" className="font-semibold underline">
                Completar agora
              </Link></>
            )}
          </Aviso>
        )}

        <Cartao>
          <CartaoTitulo titulo={`${contratos.length} contrato(s)`} />
          {contratos.length === 0 ? (
            <Vazio
              titulo="Nenhum contrato emitido"
              descricao="Escolha o modelo, o cliente e a forma de pagamento — o PDF e as parcelas saem juntos."
              acao={
                <Link href="/contratos/novo">
                  <Botao><Plus className="h-4 w-4" /> Novo contrato</Botao>
                </Link>
              }
            />
          ) : (
            <>
              <ul className="divide-y divide-slate-100 lg:hidden">
                {contratos.map((c) => (
                  <li key={c.id} className="px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {c.cliente_nome}
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums">
                        {moeda(Number(c.valor_total))}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Etiqueta tom="azul">nº {c.numero}</Etiqueta>
                      <Etiqueta>{c.modelo_titulo}</Etiqueta>
                      <Etiqueta tom={c.emitente_tipo_pessoa === 'PJ' ? 'azul' : 'neutro'}>
                        {c.emitente_tipo_pessoa}
                      </Etiqueta>
                      {c.rascunho && <Etiqueta tom="ambar">Rascunho</Etiqueta>}
                      {c.cancelado && <Etiqueta tom="vermelho">Cancelado</Etiqueta>}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        {fdata(c.data_contrato)} ·{' '}
                        {c.a_vista ? 'à vista' : `${c.num_parcelas}x`}
                      </span>
                      <a href={`/api/contratos/${c.id}/pdf`} target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-brand-700">
                        Abrir PDF
                      </a>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden lg:block">
                <Tabela>
                  <thead>
                    <tr>
                      <Th alinhar="centro">Nº</Th>
                      <Th>Cliente</Th>
                      <Th>Modelo</Th>
                      <Th>Emitente</Th>
                      <Th>Data</Th>
                      <Th alinhar="direita">Valor</Th>
                      <Th alinhar="centro">Pagamento</Th>
                      <Th alinhar="direita">Documento</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {contratos.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <Td alinhar="centro" className="font-semibold">{c.numero}</Td>
                        <Td className="max-w-[16rem]">
                          <span className="block truncate font-medium text-slate-900">
                            {c.cliente_nome}
                          </span>
                          {(c.rascunho || c.cancelado) && (
                            <span className="mt-1 flex gap-1">
                              {c.rascunho && <Etiqueta tom="ambar">Rascunho</Etiqueta>}
                              {c.cancelado && <Etiqueta tom="vermelho">Cancelado</Etiqueta>}
                            </span>
                          )}
                        </Td>
                        <Td>{c.modelo_titulo}</Td>
                        <Td>
                          <Etiqueta tom={c.emitente_tipo_pessoa === 'PJ' ? 'azul' : 'neutro'}>
                            {c.emitente_tipo_pessoa}
                          </Etiqueta>
                        </Td>
                        <Td className="whitespace-nowrap">{fdata(c.data_contrato)}</Td>
                        <Td alinhar="direita" className="font-semibold text-slate-900">
                          {moeda(Number(c.valor_total))}
                        </Td>
                        <Td alinhar="centro" className="whitespace-nowrap">
                          {c.a_vista ? 'à vista' : `${c.num_parcelas}x`}
                        </Td>
                        <Td alinhar="direita">
                          <a href={`/api/contratos/${c.id}/pdf`} target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold
                              text-brand-700 hover:underline">
                            <FileText className="h-3.5 w-3.5" /> PDF
                          </a>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              </div>
            </>
          )}
        </Cartao>
      </div>
    </>
  );
}
