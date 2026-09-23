import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { exigirPerfil } from '@/lib/auth/session';
import type { Emitente, ModeloContrato } from '@/lib/types';
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina';
import { Aviso } from '@/components/ui/cards';
import { FormContrato } from '@/components/contratos/form-contrato';

export const metadata: Metadata = { title: 'Novo contrato' };
export const dynamic = 'force-dynamic';

export default async function PaginaNovoContrato() {
  await exigirPerfil(['ADMIN', 'FINANCEIRO']);
  const supabase = createClient();

  const [{ data: clientes }, { data: emitentes }, { data: modelos }] = await Promise.all([
    supabase.from('clientes').select('id, nome, tipo_pessoa, documento')
      .eq('ativo', true).order('nome'),
    supabase.from('emitentes').select('*').eq('ativo', true).order('tipo_pessoa'),
    supabase.from('modelos_contrato').select('chave, completo'),
  ]);

  const incompletos = (modelos ?? [])
    .filter((m) => !m.completo)
    .map((m) => m.chave as ModeloContrato);

  return (
    <>
      <Link href="/contratos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium
          text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Contratos
      </Link>

      <CabecalhoPagina
        titulo="Novo contrato"
        descricao="O PDF e as parcelas do contas a receber são gerados juntos"
      />

      {(clientes ?? []).length === 0 ? (
        <Aviso tom="alerta">
          Nenhum cliente cadastrado. Cadastre o paciente em{' '}
          <Link href="/clientes" className="font-semibold underline">Clientes</Link>{' '}
          antes de emitir o contrato.
        </Aviso>
      ) : (
        <FormContrato
          clientes={clientes ?? []}
          emitentes={(emitentes ?? []) as Emitente[]}
          modelosIncompletos={incompletos}
        />
      )}
    </>
  );
}
