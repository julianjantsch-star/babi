import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { nfseDisponivel } from '@/lib/nfse/cliente';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Cartao, CartaoTitulo, Aviso } from '@/components/ui/cards';
import { FormConfig, BotaoEsquecerDispositivos } from '@/components/config/form-config';

export const metadata: Metadata = { title: 'Configurações' };
export const dynamic = 'force-dynamic';

export default async function PaginaConfiguracoes() {
  await exigirPerfil(['ADMIN']);
  const supabase = createClient();

  const { data: config } = await supabase
    .from('configuracoes').select('*').eq('id', true).maybeSingle();

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
