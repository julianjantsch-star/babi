'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, Pencil } from 'lucide-react';
import { salvarCliente } from '@/app/actions/clientes';
import { Modal } from '@/components/ui/modal';
import { Botao } from '@/components/ui/button';
import { Campo, Selecao, AreaTexto } from '@/components/ui/campos';
import { Aviso } from '@/components/ui/cards';
import { Alternador } from '@/components/ui/alternador';
import { TIPOS_PESSOA, type Cliente, type TipoPessoa } from '@/lib/types';

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" carregando={pending} className="w-full" tamanho="lg">
      {pending ? 'Salvando…' : 'Salvar cliente'}
    </Botao>
  );
}

export function FormCliente({ cliente }: { cliente?: Cliente }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useFormState(salvarCliente, undefined);
  const [tipo, setTipo] = useState<TipoPessoa>(cliente?.tipo_pessoa ?? 'PF');
  const editando = !!cliente;

  return (
    <>
      {editando ? (
        <Botao variante="fantasma" tamanho="sm" onClick={() => setAberto(true)}>
          <Pencil className="h-4 w-4" /> Editar
        </Botao>
      ) : (
        <Botao onClick={() => setAberto(true)}>
          <Plus className="h-4 w-4" /> Novo cliente
        </Botao>
      )}

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? 'Editar cliente' : 'Novo cliente'}
      >
        <form action={acao} className="space-y-4">
          {cliente && <input type="hidden" name="id" value={cliente.id} />}
          <input type="hidden" name="tipo_pessoa" value={tipo} />

          {estado?.erro && <Aviso tom="erro">{estado.erro}</Aviso>}
          {estado?.ok && <Aviso tom="sucesso">{estado.ok}</Aviso>}

          <div>
            <p className="rotulo">Tipo de pessoa</p>
            <Alternador<TipoPessoa>
              nome="Tipo de pessoa" valor={tipo} aoMudar={setTipo}
              opcoes={TIPOS_PESSOA} compacto
            />
          </div>

          <Campo
            rotulo={tipo === 'PF' ? 'Nome completo' : 'Razão social'}
            name="nome" defaultValue={cliente?.nome} required maxLength={200}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo={tipo === 'PF' ? 'CPF' : 'CNPJ'}
              name="documento"
              inputMode="numeric"
              defaultValue={cliente?.documento ?? ''}
              placeholder={tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
              dica="Obrigatório para emitir NFS-e."
            />
            <Campo rotulo="Telefone" name="telefone" type="tel"
              defaultValue={cliente?.telefone ?? ''} />
          </div>

          <Campo rotulo="E-mail" name="email" type="email" inputMode="email"
            defaultValue={cliente?.email ?? ''}
            dica="Para onde vai a nota fiscal." />

          <details className="rounded-xl border border-slate-200 p-3" open={editando}>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Endereço (exigido pela NFS-e)
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Campo rotulo="CEP" name="cep" inputMode="numeric"
                  defaultValue={cliente?.cep ?? ''} />
                <Campo rotulo="Logradouro" name="logradouro"
                  className="sm:col-span-2" defaultValue={cliente?.logradouro ?? ''} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Campo rotulo="Número" name="numero" defaultValue={cliente?.numero ?? ''} />
                <Campo rotulo="Complemento" name="complemento"
                  defaultValue={cliente?.complemento ?? ''} />
                <Campo rotulo="Bairro" name="bairro" defaultValue={cliente?.bairro ?? ''} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Campo rotulo="Município" name="municipio"
                  defaultValue={cliente?.municipio ?? ''} />
                <Campo rotulo="Código IBGE" name="cod_municipio" inputMode="numeric"
                  defaultValue={cliente?.cod_municipio ?? ''}
                  dica="7 dígitos." />
                <Selecao rotulo="UF" name="uf" defaultValue={cliente?.uf ?? ''}>
                  <option value="">—</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
                    'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
                    .map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </Selecao>
              </div>
            </div>
          </details>

          <AreaTexto rotulo="Observações" name="observacoes"
            defaultValue={cliente?.observacoes ?? ''} />

          <Salvar />
        </form>
      </Modal>
    </>
  );
}
