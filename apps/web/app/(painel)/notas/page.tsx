import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { nfseDisponivel } from '@/lib/nfse/cliente';
import { moeda, data as fdata, documento as fdoc } from '@/lib/format';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Cartao, CartaoTitulo, Vazio, Aviso, Indicador } from '@/components/ui/cards';
import { EtiquetaNfse } from '@/components/ui/badge';
import { Tabela, Th, Td } from '@/components/ui/tabela';

export const metadata: Metadata = { title: 'Notas fiscais' };
export const dynamic = 'force-dynamic';

interface NotaListada {
  id: string;
  status: 'PENDENTE' | 'PROCESSANDO' | 'AUTORIZADA' | 'REJEITADA' | 'CANCELADA';
  valor: number;
  competencia: string;
  serie: string;
  rps_numero: number;
  numero_nfse: string | null;
  data_emissao: string | null;
  pdf_url: string | null;
  erro: string | null;
  recebivel_id: string | null;
  cliente_nome: string;
  cliente_documento: string | null;
  cliente_tipo_pessoa: 'PF' | 'PJ';
  recebivel_descricao: string | null;
}

export default async function PaginaNotas() {
  await exigirPerfil(['ADMIN', 'FINANCEIRO']);
  const supabase = createClient();

  const { data } = await supabase
    .from('vw_notas_fiscais')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const notas = (data ?? []) as NotaListada[];
  const autorizadas = notas.filter((n) => n.status === 'AUTORIZADA');
  const totalAutorizado = autorizadas.reduce((s, n) => s + Number(n.valor), 0);
  const rejeitadas = notas.filter((n) => n.status === 'REJEITADA').length;

  return (
    <>
      <CabecalhoPagina
        titulo="Notas fiscais"
        descricao="NFS-e Nacional — emitidas a partir das contas da origem PJ"
      />

      <div className="space-y-4">
        {!nfseDisponivel() && (
          <Aviso tom="alerta">
            O serviço de emissão ainda não está configurado. Defina{' '}
            <code className="font-mono text-xs">NFSE_SERVICE_URL</code> e{' '}
            <code className="font-mono text-xs">NFSE_SERVICE_TOKEN</code> no
            ambiente e suba o microserviço de <code className="font-mono text-xs">
            services/nfse</code>, que é quem guarda o certificado A1.
          </Aviso>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Indicador rotulo="Autorizadas" valor={String(autorizadas.length)} tom="verde" />
          <Indicador rotulo="Valor emitido" valor={totalAutorizado} />
          <Indicador rotulo="Rejeitadas" valor={String(rejeitadas)}
            tom={rejeitadas > 0 ? 'vermelho' : 'neutro'} />
        </div>

        <Cartao>
          <CartaoTitulo
            titulo="Emissões"
            descricao="Para emitir, abra a conta a receber de origem PJ"
          />
          {notas.length === 0 ? (
            <Vazio
              titulo="Nenhuma nota emitida"
              descricao="Abra uma conta a receber da origem Pessoa Jurídica e use
                'Emitir NFS-e'."
            />
          ) : (
            <>
              {/* celular */}
              <ul className="divide-y divide-slate-100 lg:hidden">
                {notas.map((n) => (
                  <li key={n.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {n.cliente_nome}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {n.numero_nfse ? `NFS-e ${n.numero_nfse}` : `RPS ${n.serie}/${n.rps_numero}`}
                          {' · '}{fdata(n.competencia)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums">
                        {moeda(Number(n.valor))}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <EtiquetaNfse status={n.status} />
                      {n.pdf_url && (
                        <a href={n.pdf_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-semibold text-brand-700">PDF</a>
                      )}
                    </div>
                    {n.erro && <p className="mt-1.5 text-xs text-rose-600">{n.erro}</p>}
                  </li>
                ))}
              </ul>

              {/* desktop */}
              <div className="hidden lg:block">
                <Tabela>
                  <thead>
                    <tr>
                      <Th>Número</Th>
                      <Th>Tomador</Th>
                      <Th>Serviço</Th>
                      <Th>Competência</Th>
                      <Th alinhar="direita">Valor</Th>
                      <Th>Situação</Th>
                      <Th alinhar="direita">Documento</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {notas.map((n) => (
                      <tr key={n.id} className="hover:bg-slate-50">
                        <Td className="font-medium text-slate-900">
                          {n.numero_nfse ?? `RPS ${n.serie}/${n.rps_numero}`}
                        </Td>
                        <Td>
                          {n.recebivel_id ? (
                            <Link href={`/recebiveis/${n.recebivel_id}`}
                              className="font-medium hover:text-brand-700">
                              {n.cliente_nome}
                            </Link>
                          ) : n.cliente_nome}
                          <span className="block text-xs text-slate-400">
                            {fdoc(n.cliente_documento, n.cliente_tipo_pessoa)}
                          </span>
                        </Td>
                        <Td className="max-w-xs truncate">{n.recebivel_descricao ?? '—'}</Td>
                        <Td>{fdata(n.competencia)}</Td>
                        <Td alinhar="direita" className="font-semibold">
                          {moeda(Number(n.valor))}
                        </Td>
                        <Td>
                          <EtiquetaNfse status={n.status} />
                          {n.erro && (
                            <span className="mt-1 block max-w-xs text-xs text-rose-600">
                              {n.erro}
                            </span>
                          )}
                        </Td>
                        <Td alinhar="direita">
                          {n.pdf_url ? (
                            <a href={n.pdf_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-semibold text-brand-700 hover:underline">
                              Baixar PDF
                            </a>
                          ) : '—'}
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
