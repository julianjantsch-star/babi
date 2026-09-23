import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import type { ModeloContratoRegistro } from '@/lib/types';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Aviso } from '@/components/ui/cards';
import { EditorModelo } from '@/components/contratos/editor-modelo';

export const metadata: Metadata = { title: 'Modelos de contrato' };
export const dynamic = 'force-dynamic';

export default async function PaginaModelos() {
  await exigirPerfil(['ADMIN']);
  const supabase = createClient();

  const { data } = await supabase
    .from('modelos_contrato').select('*').order('chave');
  const modelos = (data ?? []) as ModeloContratoRegistro[];

  return (
    <>
      <Link href="/contratos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium
          text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Contratos
      </Link>

      <CabecalhoPagina
        titulo="Modelos de contrato"
        descricao="O texto fica aqui, não no código — alterar não exige nova publicação"
      />

      <div className="space-y-4">
        <Aviso tom="info">
          Contrato já emitido guarda o texto do dia da assinatura. Editar um
          modelo muda apenas os próximos.
        </Aviso>

        {modelos.map((m) => <EditorModelo key={m.id} modelo={m} />)}
      </div>
    </>
  );
}
