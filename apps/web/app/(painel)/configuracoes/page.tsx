import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { nfseDisponivel } from '@/lib/nfse/cliente';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Cartao, CartaoTitulo, Aviso } from '@/components/ui/cards';
import { FormConfig, BotaoEsquecerDispositivos } from '@/components/config/form-config';
import { FormEmitente } from '@/components/contratos/form-emitente';
import { Etiqueta } from '@/components/ui/badge';
import { documento as fdoc } from '@/lib/format';
import type { Emitente } from '@/lib/types';

export const metadata: Metadata = { title: 'Configurações' };
export const dynamic = 'force-dynamic';

export default async function PaginaConfiguracoes() {
  await exigirPerfil(['ADMIN']);
  const supabase = createClient();

  const [{ data: config }, { data: emitentesData }] = await Promise.all([
    supabase.from('configuracoes').select('*').eq('id', true).maybeSingle(),
    supabase.from('emitentes').select('*').order('tipo_pessoa'),
  ]);
  const emitentes = (emitentesData ?? []) as Emitente[];

  return (
    <>
      <CabecalhoPagina
        titulo="Configurações"
        descricao="Dados fiscais do prestador e segurança da conta"
      />

      <div className="space-y-4">
        {config?.ambiente_nfse === 'PRODUCAO' && (
          <Aviso tom="alerta">
            Ambiente de <strong>produção</strong>: as notas emitidas têm valor
            fiscal e geram obrigação tributária.
          </Aviso>
        )}

        <FormConfig config={config ?? {}} />

        <Cartao>
          <CartaoTitulo
            titulo="Emitentes de contrato"
            descricao="Seus dados no lado da contratada — define também a origem do recebível"
            acao={<FormEmitente />}
          />
          {emitentes.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
              Nenhum emitente cadastrado. Sem ele não é possível emitir contrato.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {emitentes.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3
                  px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {e.nome}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {fdoc(e.documento, e.tipo_pessoa)}
                      {e.cro && ` · CRO ${e.cro}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Etiqueta tom={e.tipo_pessoa === 'PJ' ? 'azul' : 'neutro'}>
                      {e.tipo_pessoa}
                    </Etiqueta>
                    {e.padrao && <Etiqueta tom="verde">Padrão</Etiqueta>}
                    {!e.ativo && <Etiqueta tom="vermelho">Inativo</Etiqueta>}
                    <FormEmitente emitente={e} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <CartaoTitulo
            titulo="Segurança"
            descricao="Verificação em duas etapas por e-mail"
          />
          <div className="space-y-4 p-4 sm:p-5">
            <p className="text-sm text-slate-600">
              Dispositivos marcados como confiáveis dispensam o código por 30
              dias. Se um celular ou computador foi perdido, remova todos e
              o código volta a ser exigido em cada entrada.
            </p>
            <BotaoEsquecerDispositivos />
          </div>
        </Cartao>

        <Cartao>
          <CartaoTitulo titulo="Emissor de NFS-e" />
          <div className="p-4 text-sm sm:p-5">
            {nfseDisponivel() ? (
              <p className="text-emerald-700">
                Serviço de emissão configurado e acessível pela aplicação.
              </p>
            ) : (
              <p className="text-amber-700">
                Serviço de emissão não configurado. Suba o microserviço de{' '}
                <code className="font-mono text-xs">services/nfse</code> com o
                certificado A1 e preencha as variáveis{' '}
                <code className="font-mono text-xs">NFSE_SERVICE_URL</code> e{' '}
                <code className="font-mono text-xs">NFSE_SERVICE_TOKEN</code>.
              </p>
            )}
          </div>
        </Cartao>
      </div>
    </>
  );
}
