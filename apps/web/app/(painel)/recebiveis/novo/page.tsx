import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { FormRecebivel } from '@/components/parcelas/form-recebivel';
import { Aviso } from '@/components/ui/cards';

export const metadata: Metadata = { title: 'Nova conta a receber' };
export const dynamic = 'force-dynamic';

export default async function PaginaNovoRecebivel() {
  const perfil = await exigirPerfil();
  const supabase = createClient();

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome, tipo_pessoa, documento')
    .eq('ativo', true)
    .order('nome');

  return (
    <>
      <CabecalhoPagina
        titulo="Nova conta a receber"
        descricao="O valor é dividido automaticamente nas parcelas informadas"
      />
      {(clientes ?? []).length === 0 ? (
        <Aviso tom="alerta">
          Você ainda não tem clientes cadastrados. Cadastre um cliente antes
          de lançar uma conta a receber.
        </Aviso>
      ) : (
        <FormRecebivel
          clientes={clientes ?? []}
          travadoEmClinica={perfil.role === 'BALCAO'}
        />
      )}
    </>
  );
}
